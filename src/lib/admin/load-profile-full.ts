import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapOne } from "@/lib/db/unwrap";

// PT-1/PT-6 — единый серверный загрузчик ПОЛНОЙ анкеты V4 для админки.
// Тянет все hot-колонки user_profiles (select *), extended jsonb (cold-секции:
// finance/lifestyle/family/living/bio/children/partner) и квиз (Big Five vector
// + сырые ответы). БЕЗ visibility-gating — модератор обязан видеть всё, включая
// sensitive (finance/alcohol/drugs). Один источник для карточки и будущих
// ops-действий.

export type ExtendedShape = {
  finance?: Record<string, unknown>;
  lifestyle?: Record<string, unknown>;
  health?: Record<string, unknown>;
  family?: Record<string, unknown>;
  living?: Record<string, unknown>;
  bio?: Record<string, unknown>;
  children?: Record<string, unknown>;
  partner?: Record<string, unknown>;
};

export type FullProfile = {
  profile: Record<string, unknown>;
  extended: ExtendedShape;
  quizVector: Record<string, number> | null;
  quizAnswers: { question_id: string; answer_value: number }[];
  quizCompletedAt: string | null;
};

export async function loadFullProfile(userId: string): Promise<FullProfile | null> {
  const sb = supabaseAdmin();
  const p = unwrapOne(await sb
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle());
  if (!p) return null;

  const [{ data: q }, { data: qa }] = await Promise.all([
    sb.from("quiz_results").select("vector, completed_at").eq("user_id", userId).maybeSingle(),
    sb.from("quiz_answers").select("question_id, answer_value").eq("user_id", userId),
  ]);

  const profile = p as Record<string, unknown>;
  const extended = (profile.extended as ExtendedShape | null) ?? {};

  return {
    profile,
    extended,
    quizVector: (q?.vector as Record<string, number> | null) ?? null,
    quizAnswers: (qa as { question_id: string; answer_value: number }[] | null) ?? [],
    quizCompletedAt: (q?.completed_at as string | null) ?? null,
  };
}
