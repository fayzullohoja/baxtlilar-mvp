import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Полный сохранённый профиль (все hot-колонки + extended jsonb) — для гидрации
 * форм анкеты, чтобы кнопка «Назад» показывала уже введённые ответы, а не пустую
 * форму. Возвращает {} если строки ещё нет.
 */
export type AnketaDraft = Record<string, unknown> & {
  extended?: Record<string, unknown> | null;
};

export async function loadAnketaDraft(userId: string): Promise<AnketaDraft> {
  const { data } = await supabaseAdmin()
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as AnketaDraft | null) ?? {};
}

/** Секция extended (self/langs/family/finance/partner/lifestyle) или {}. */
export function draftSection(
  draft: AnketaDraft,
  section: string,
): Record<string, unknown> {
  const ext = (draft.extended as Record<string, unknown> | null) ?? {};
  return (ext[section] as Record<string, unknown>) ?? {};
}
