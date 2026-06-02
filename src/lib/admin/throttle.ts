import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;

/** Залогировать попытку входа (для rate-limit по IP). */
export async function recordLoginAttempt(ip: string, success: boolean): Promise<void> {
  await supabaseAdmin().from("admin_login_attempts").insert({ ip, success });
}

/** true, если с IP было >= MAX_FAILS неудач за последние 15 минут. */
export async function isLoginThrottled(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await supabaseAdmin()
    .from("admin_login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("success", false)
    .gte("created_at", since);
  if (error) return true; // fail-closed: при сбое БД считаем заблокированным, не пускаем брутфорс
  return (count ?? 0) >= MAX_FAILS;
}
