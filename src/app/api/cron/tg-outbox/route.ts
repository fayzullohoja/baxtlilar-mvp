import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto/safe-equal";
import { processOutboxBatch } from "@/lib/v2/tg-outbox-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V2 Phase A · Sprint 6 — cron endpoint для drain tg_outbox.
 *
 * Триггерится внешним cron'ом (Railway scheduled job / GitHub Actions / etc.)
 * с заголовком X-Cron-Secret = env CRON_SECRET.
 *
 * Без CRON_SECRET → 503 (нельзя случайно открыть наружу).
 * Невалидный секрет → 401.
 * Пустая очередь → 200 { processed: 0 }.
 *
 * Рекомендуемая частота вызова: каждые 30-60 секунд.
 * Limit = 50 событий за тик — достаточно для текущего объёма.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const cronSecret = env().CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "cron_not_configured" },
      { status: 503 },
    );
  }

  const provided = req.headers.get("x-cron-secret");
  // SEC-5: constant-time — plain !== утекает секрет по таймингу.
  if (!safeEqual(provided ?? "", cronSecret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const stats = await processOutboxBatch(50);
  return NextResponse.json({ ok: true, ...stats });
}

/** GET для health-check (без секрета — только статус). */
export async function GET(): Promise<NextResponse> {
  const configured = Boolean(env().CRON_SECRET);
  return NextResponse.json({ ok: true, configured });
}
