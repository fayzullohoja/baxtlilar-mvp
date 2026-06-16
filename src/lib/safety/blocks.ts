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
