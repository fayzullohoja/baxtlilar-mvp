import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Housekeeping cron — собирает rare-frequency задачи в одном вызове.
 * Триггер: Railway scheduled job, X-Cron-Secret = env CRON_SECRET.
 * Рекомендуемая частота: 1 раз в час (для cleanups) — 6h+ тоже норм.
 *
 * Задачи:
 *  1. gc_start_token_uses (Bug #12) — чистит истёкшие start tokens (TTL=600s).
 *  2. admin_sla_reclaim_stale_cases (Bug #11) — снимает 7d-старые claim'ы.
 *
 * Обе задачи independent: одна падает — другая выполняется.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const cronSecret = env().CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  }

  const provided = req.headers.get("x-cron-secret");
  if (provided !== cronSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const results: { task: string; ok: boolean; result?: unknown; error?: string }[] = [];

  // Task 1: garbage-collect истёкшие start_token_uses.
  try {
    const { data, error } = await sb.rpc("gc_start_token_uses");
    if (error) throw error;
    results.push({ task: "gc_start_token_uses", ok: true, result: data });
  } catch (err) {
    results.push({
      task: "gc_start_token_uses",
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  // Task 2: reclaim stale verification cases (7-day idle → re-queue).
  try {
    const { data, error } = await sb.rpc("admin_sla_reclaim_stale_cases", {
      p_max_idle_hours: 168,
    });
    if (error) throw error;
    results.push({ task: "admin_sla_reclaim_stale_cases", ok: true, result: data });
  } catch (err) {
    results.push({
      task: "admin_sla_reclaim_stale_cases",
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 });
}

/** GET для health-check (без секрета — только статус). */
export async function GET(): Promise<NextResponse> {
  const configured = Boolean(env().CRON_SECRET);
  return NextResponse.json({ ok: true, configured });
}
