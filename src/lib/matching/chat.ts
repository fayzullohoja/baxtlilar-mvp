import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Нормализованная пара (user_a < user_b) — соответствует CHECK/UNIQUE в схеме. */
export function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Гарантированно вернуть chat_id для пары (создать или взять существующий — гонку ловим). */
export async function ensureChat(u1: string, u2: string): Promise<string> {
  const [user_a, user_b] = normalizePair(u1, u2);
  const sb = supabaseAdmin();

  const { data: existing } = await sb
    .from("chats")
    .select("id")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await sb
    .from("chats")
    .insert({ user_a, user_b })
    .select("id")
    .single();
  if (created) return created.id as string;

  // гонка: пара уже создана параллельно — перечитываем
  if (error) {
    const { data: race } = await sb
      .from("chats")
      .select("id")
      .eq("user_a", user_a)
      .eq("user_b", user_b)
      .single();
    if (race) return race.id as string;
    throw new Error(`ensureChat failed: ${error.message}`);
  }
  throw new Error("ensureChat: no chat");
}
