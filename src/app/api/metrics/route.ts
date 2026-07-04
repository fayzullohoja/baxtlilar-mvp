import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto/safe-equal";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapOne } from "@/lib/db/unwrap";
import { pool } from "@/lib/db/pool";
import { count5xxLast5min } from "@/lib/observability/five-xx-counter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OpsMetrics = {
  outbox: { depth: number; oldest_age_seconds: number; dead_letter: number };
  verification_queue_depth: number;
};

/**
 * OBS-4 — секрет-защищённые ops-метрики для внешнего монитора/алертов.
 * Доступ по X-Cron-Secret (или X-Metrics-Secret) == CRON_SECRET. Публичный
 * маршрут (isPublicApi) — не требует bx_session; защита секретом в роуте.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = env().CRON_SECRET;
  if (!secret)
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  const provided =
    req.headers.get("x-cron-secret") ?? req.headers.get("x-metrics-secret") ?? "";
  if (!safeEqual(provided, secret))
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let db: OpsMetrics | null = null;
  try {
    db = unwrapOne(await supabaseAdmin().rpc("get_ops_metrics")) as OpsMetrics | null;
  } catch {
    db = null; // БД недоступна — отдаём pool/5xx, метки БД = null (монитор увидит деградацию)
  }

  const p = pool();
  const poolMax = Number(process.env.PG_POOL_MAX ?? 15);

  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    pool: {
      total: p.totalCount,
      idle: p.idleCount,
      waiting: p.waitingCount,
      max: poolMax,
    },
    outbox: db?.outbox ?? null,
    verification_queue_depth: db?.verification_queue_depth ?? null,
    // OBS-5: single-instance, сбрасывается при рестарте (unhandled 5xx).
    five_xx_5min: count5xxLast5min(),
  });
}
