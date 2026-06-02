import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type LiveMsg = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};
export type ChatRow = {
  id: string;
  user_a: string;
  user_b: string;
  typing_a_until: string | null;
  typing_b_until: string | null;
};
export type LiveState = { messages: LiveMsg[]; read_through: string | null; typing: boolean };

/** Загрузить чат с полями typing и проверить участие. null → нет доступа. */
export async function loadChatRow(chatId: string, userId: string): Promise<ChatRow | null> {
  const { data } = await supabaseAdmin()
    .from("chats")
    .select("id, user_a, user_b, typing_a_until, typing_b_until")
    .eq("id", chatId)
    .maybeSingle();
  const chat = data as ChatRow | null;
  if (!chat || (chat.user_a !== userId && chat.user_b !== userId)) return null;
  return chat;
}

/**
 * Живое состояние чата для участника `me`:
 *  - messages: новые сообщения (created_at >= after), с read_at;
 *  - read_through: до какого времени собеседник прочитал МОИ сообщения (для галочек ✓✓);
 *  - typing: печатает ли собеседник прямо сейчас.
 */
export async function getLiveState(
  chatId: string,
  me: string,
  chat: ChatRow,
  after?: string | null,
): Promise<LiveState> {
  const sb = supabaseAdmin();

  let mq = sb
    .from("chat_messages")
    .select("id, sender_id, body, created_at, read_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (after) mq = mq.gte("created_at", after);
  const { data: messages } = await mq;

  // последнее из МОИХ сообщений, которое собеседник прочитал
  const { data: rt } = await sb
    .from("chat_messages")
    .select("created_at")
    .eq("chat_id", chatId)
    .eq("sender_id", me)
    .not("read_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // печатает собеседник (его поле typing): если я user_a → смотрю typing_b_until, иначе typing_a_until
  const peerUntil = me === chat.user_a ? chat.typing_b_until : chat.typing_a_until;
  const typing = !!peerUntil && new Date(peerUntil).getTime() > Date.now();

  return {
    messages: (messages ?? []) as LiveMsg[],
    read_through: (rt?.created_at as string) ?? null,
    typing,
  };
}
