import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Анонимный health — только {ok, db, ts}. Без dbError / commit-SHA — это
// recon-материал (схема, версия деплоя). См. F-117 (security-audit 2026-06-19).
// Подробности (текст ошибки, коммит) логируются на сервер.
export async function GET() {
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
  return NextResponse.json({ ok: true, db, ts: new Date().toISOString() });
}
