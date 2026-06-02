import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Заблокированы ли двое в ЛЮБУЮ сторону. limit(1) (а не maybeSingle) —
 * чтобы взаимная блокировка (две строки) корректно считалась блокировкой, а не ошибкой.
 */
export async function areBlocked(a: string, b: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
    .limit(1);
  return (data?.length ?? 0) > 0;
}
