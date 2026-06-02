import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Дневные лимиты MVP (OD-6): антиспам, защита аудитории — не монетизация.
// views — зарезервирован (просмотры пока не лимитируются), interests — активен.
export const DAILY_LIMITS = { interests: 5, views: 30 } as const;

/**
 * Атомарно проверить и увеличить дневную квоту (Postgres RPC bump_quota, граница суток Asia/Tashkent).
 * true = разрешено (увеличили), false = лимит исчерпан. Без гонок read-modify-write.
 */
export async function checkAndIncrement(userId: string, kind: "interests" | "views"): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("bump_quota", {
    p_user: userId,
    p_kind: kind,
    p_limit: DAILY_LIMITS[kind],
  });
  if (error) return false;
  return data === true;
}
