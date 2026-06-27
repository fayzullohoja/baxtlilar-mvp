import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Заблокированы ли двое в ЛЮБУЮ сторону. limit(1) (а не maybeSingle) —
 * чтобы взаимная блокировка (две строки) корректно считалась блокировкой, а не ошибкой.
 */
export async function areBlocked(a: string, b: string): Promise<boolean> {
  // blocker_id ∈ {a,b} AND blocked_id ∈ {a,b} — из-за check (blocker_id <> blocked_id)
  // совпадают ровно пары (a,b) и (b,a), т.е. блок в любую сторону.
  const { data } = await supabaseAdmin()
    .from("blocks")
    .select("blocker_id")
    .in("blocker_id", [a, b])
    .in("blocked_id", [a, b])
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * Заблокировать target от имени blocker: ставит строку blocks (идемпотентный
 * upsert) и рвёт висящие pending-заявки между парой (входящая от target →
 * declined, своя к target → withdrawn). Сообщения после этого глушит
 * areBlocked-гард на send. Возвращает false только если upsert самой блокировки
 * упал (safety-critical); teardown заявок — best-effort.
 *
 * Используется и в /api/block, и в /api/report (E1: жалоба должна обрывать
 * контакт — пользователь жмёт «Пожаловаться», ожидая, что сообщения прекратятся).
 */
export async function blockUser(blockerId: string, targetId: string): Promise<boolean> {
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("blocks")
    .upsert({ blocker_id: blockerId, blocked_id: targetId }, { onConflict: "blocker_id,blocked_id" });
  if (error) return false;
  await sb
    .from("match_requests")
    .update({ status: "declined" })
    .eq("sender_id", targetId)
    .eq("receiver_id", blockerId)
    .eq("status", "pending");
  await sb
    .from("match_requests")
    .update({ status: "withdrawn" })
    .eq("sender_id", blockerId)
    .eq("receiver_id", targetId)
    .eq("status", "pending");
  return true;
}
