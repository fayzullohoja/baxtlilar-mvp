import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMiniProfiles } from "@/lib/profile/mini";

export type ChatListRow = {
  chatId: string;
  otherId: string;
  name: string;
  photoUrl: string | null;
  lastBody: string | null;
  lastAt: string | null;
  mine: boolean; // последнее сообщение — моё
  unread: number;
};

type Raw = {
  chat_id: string;
  other_id: string;
  last_body: string | null;
  last_at: string | null;
  last_sender: string | null;
  unread: number;
};

/** Список диалогов пользователя: собеседник + последнее сообщение + непрочитанные. */
export async function getChatList(userId: string): Promise<ChatListRow[]> {
  const { data } = await supabaseAdmin().rpc("get_chat_list", { p_user: userId });
  const rows = (data ?? []) as Raw[];
  const minis = await getMiniProfiles(rows.map((r) => r.other_id));
  return rows.map((r) => ({
    chatId: r.chat_id,
    otherId: r.other_id,
    name: minis[r.other_id]?.name ?? "",
    photoUrl: minis[r.other_id]?.photoUrl ?? null,
    lastBody: r.last_body,
    lastAt: r.last_at,
    mine: r.last_sender === userId,
    unread: r.unread,
  }));
}

/** Суммарное число непрочитанных входящих (для бейджа в навигации). */
export async function getUnreadTotal(userId: string): Promise<number> {
  const { data } = await supabaseAdmin().rpc("get_unread_total", { p_user: userId });
  return (data as number) ?? 0;
}
