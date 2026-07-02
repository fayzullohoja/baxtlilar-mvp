import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// OBS-2 (2026-07-02): health честно отражает готовность.
//
//  • readiness (по умолчанию): проверяет БД. db=false → HTTP 503, чтобы внешний
//    uptime-монитор и алерты видели реальную деградацию, а не «зелёный» 200.
//  • liveness (?live=1): процесс жив → всегда 200, без обращения к БД. Railway
//    healthcheckPath указывает СЮДА (см. railway.json) — иначе кратковременный
//    сбой БД валит healthcheck и Railway уходит в restart-loop веб-контейнера,
//    который DB-проблему не чинит.
//
// Анонимный ответ — только {ok, db, ts}. Без dbError/commit-SHA (recon-материал,
// F-117). Детали ошибки логируются на сервер.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("live") === "1") {
    return NextResponse.json({ ok: true, live: true, ts: new Date().toISOString() });
  }

  let db = false;
  try {
    const sb = supabaseAdmin();
    const { error } = await sb.from("users").select("id", { count: "exact", head: true }).limit(1);
    db = !error;
    if (error) console.error("[health] db check failed:", error.message);
  } catch (e) {
    db = false;
    console.error("[health] db check threw:", e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json(
    { ok: db, db, ts: new Date().toISOString() },
    { status: db ? 200 : 503 },
  );
}
