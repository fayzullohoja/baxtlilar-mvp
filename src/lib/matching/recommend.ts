import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedPhotoUrls } from "@/lib/uploads/storage";
import { ageFromDate } from "@/lib/profile/schemas";
import { scoreCandidate, type ScoreInput } from "./score";

export type Candidate = {
  user_id: string;
  display_name: string;
  age: number;
  city: string;
  photoUrl: string | null;
  score: number;
  /** 0 = strict; 1 = возраст зрителя ±5; 2 = + сняты candidate-side prefs. */
  relaxLevel: number;
};

// MATCH-2 — degradation ladder: на малом пуле строгие взаимные возрастные
// диапазоны дают пустой фид навсегда. Вместо этого пробуем уровни релаксации
// (см. миграцию 20260703000000): расширение честно доносится в match story.
const MAX_RELAX_LEVEL = 2;

/** Лента рекомендаций: жёсткие фильтры (SQL) + скоринг/сортировка (JS). */
export async function getRecommendations(viewerId: string, limit = 20): Promise<Candidate[]> {
  const sb = supabaseAdmin();

  // V3 (2026-06-30, Bug #3): `values` column was dropped in Sprint 3 cleanup —
  // selecting it returns null silently and recommendations break for ALL users.
  // Use `top_life_values` (the V3 replacement). RPC migration applied separately.
  const { data: vp } = await sb
    .from("user_profiles")
    .select("city, top_life_values, birth_date")
    .eq("user_id", viewerId)
    .maybeSingle();
  const { data: vq } = await sb.from("quiz_results").select("vector").eq("user_id", viewerId).maybeSingle();
  if (!vp) return [];
  const viewer: ScoreInput = {
    age: vp.birth_date ? ageFromDate(vp.birth_date as string) : 30,
    city: (vp.city as string) ?? "",
    values: (vp.top_life_values as string[]) ?? [],
    vector: (vq?.vector as Record<string, number>) ?? {},
  };

  let list: Record<string, unknown>[] = [];
  for (let level = 0; level <= MAX_RELAX_LEVEL; level++) {
    const { data: rows, error } = await sb.rpc("get_recommendations", {
      p_viewer: viewerId,
      p_limit: 100,
      p_relax_level: level,
    });
    // Ошибка RPC — системный сбой, а не «пусто»: не молотим оставшиеся уровни.
    if (error || !rows) return [];
    if ((rows as unknown[]).length) {
      list = rows as Record<string, unknown>[];
      break;
    }
  }
  if (!list.length) return [];
  const urls = await signedPhotoUrls(list.map((r) => r.main_photo_path as string | null));

  const scored: Candidate[] = list.map((r) => {
    const cand: ScoreInput = {
      age: (r.age as number) ?? 30,
      city: (r.city as string) ?? "",
      values: (r.vals as string[]) ?? [],
      vector: (r.vector as Record<string, number>) ?? {},
    };
    const path = r.main_photo_path as string | null;
    return {
      user_id: r.user_id as string,
      display_name: (r.display_name as string) ?? "",
      age: cand.age,
      city: cand.city,
      photoUrl: path ? (urls[path] ?? null) : null,
      score: scoreCandidate(viewer, cand),
      relaxLevel: (r.relax_level as number) ?? 0,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
