import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Дневные лимиты MVP (OD-6): антиспам, защита аудитории — не монетизация.
export const DAILY_LIMITS = { interests: 5, views: 30 } as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Проверить и инкрементировать дневную квоту по типу.
 * Возвращает false, если лимит исчерпан (тогда инкремента нет).
 */
export async function checkAndIncrement(
  userId: string,
  kind: "interests" | "views",
): Promise<boolean> {
  const sb = supabaseAdmin();
  const d = today();
  const col = kind === "interests" ? "interests_sent" : "views_count";
  const limit = DAILY_LIMITS[kind];

  const { data: row } = await sb
    .from("daily_request_quotas")
    .select("interests_sent, views_count")
    .eq("user_id", userId)
    .eq("on_date", d)
    .maybeSingle();

  const current = (row?.[col] as number | undefined) ?? 0;
  if (current >= limit) return false;

  await sb
    .from("daily_request_quotas")
    .upsert(
      {
        user_id: userId,
        on_date: d,
        interests_sent: kind === "interests" ? current + 1 : (row?.interests_sent ?? 0),
        views_count: kind === "views" ? current + 1 : (row?.views_count ?? 0),
      },
      { onConflict: "user_id,on_date" },
    );
  return true;
}
