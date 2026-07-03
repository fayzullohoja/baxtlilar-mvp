/**
 * V2 Match of the Day — выбирает ОДНОГО кандидата на сегодня и возвращает
 * editorial-пакет: его профиль + match story.
 *
 * Источник истины (продуктовое решение): см. memory
 * [[project-baxtlilar-v2-matching-model]] — 1 рекомендация в раз,
 * а не лента.
 *
 * Алгоритм MVP:
 *   1. Используем существующий getRecommendations(viewerId, 1) — он уже
 *      делает SQL-фильтрацию (пол, возраст, гео) + JS-скоринг.
 *   2. Тянем полный профиль кандидата (поля которых нет в RPC).
 *   3. Генерируем MatchStory.
 *
 * Возвращает null если кандидатов нет — UI покажет empty state «алгоритм
 * ищет, заходи позже».
 *
 * Future: добавить "match locking" — раз в день один и тот же match
 * (через user_daily_match таблицу) чтобы избежать "рулетки" при F5.
 */

import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRecommendations } from "@/lib/matching/recommend";
import { generateMatchStory, type ProfileForMatch, type MatchStory } from "./match-story";

export type MatchOfTheDay = {
  /** Полный профиль кандидата для прогрессивного раскрытия. */
  candidate: {
    user_id: string;
    profile: ProfileForMatch;
  };
  /** Editorial-объяснение почему этот мэтч. */
  story: MatchStory;
};

async function loadFullProfile(userId: string): Promise<ProfileForMatch | null> {
  const sb = supabaseAdmin();

  const { data: p, error: pe } = await sb
    .from("user_profiles")
    .select(
      "display_name, city, top_life_values, birth_date, marital_status, has_children, " +
        "future_children_plan, religion, education, bio, " +
        "partner_age_min, partner_age_max, geo_preference",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (pe || !p) return null;

  const { data: q } = await sb
    .from("quiz_results")
    .select("vector")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    display_name: (p.display_name as string) ?? "",
    city: (p.city as string) ?? null,
    top_life_values: (p.top_life_values as string[]) ?? [],
    birth_date: (p.birth_date as string) ?? null,
    marital_status: (p.marital_status as string) ?? null,
    has_children: (p.has_children as string) ?? null,
    future_children_plan: (p.future_children_plan as string) ?? null,
    religion: (p.religion as string) ?? null,
    education: (p.education as string) ?? null,
    bio: (p.bio as string) ?? null,
    partner_age_min: (p.partner_age_min as number) ?? null,
    partner_age_max: (p.partner_age_max as number) ?? null,
    geo_preference: (p.geo_preference as string) ?? null,
    vector: (q?.vector as Record<string, number>) ?? {},
  };
}

export async function getMatchOfTheDay(viewerId: string): Promise<MatchOfTheDay | null> {
  // Top-1 кандидат через существующий скоринг.
  const candidates = await getRecommendations(viewerId, 1);
  if (!candidates.length) return null;
  const top = candidates[0];

  const [viewerProfile, candidateProfile] = await Promise.all([
    loadFullProfile(viewerId),
    loadFullProfile(top.user_id),
  ]);
  if (!viewerProfile || !candidateProfile) return null;

  // MATCH-3: relax-уровень кандидата прокидывается в story — если возрастной
  // диапазон был расширен, история честно об этом говорит.
  const story = generateMatchStory(viewerProfile, candidateProfile, top.relaxLevel);

  return {
    candidate: { user_id: top.user_id, profile: candidateProfile },
    story,
  };
}
