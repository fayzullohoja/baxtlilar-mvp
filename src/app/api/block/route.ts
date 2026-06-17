import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Заблокировать/разблокировать пользователя (взаимное скрытие, без уведомления). */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadActiveUserApi({ allowPaused: true });
  if (res) return res;
  const { target_id, action } = (await req.json().catch(() => ({}))) as {
    target_id?: string;
    action?: "block" | "unblock";
  };
  if (!target_id || target_id === user.id)
    return NextResponse.json({ ok: false, error: "bad_target" }, { status: 400 });

  const sb = supabaseAdmin();
  if (action === "unblock") {
    const { error } = await sb.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", target_id);
    if (error) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
    return NextResponse.json({ ok: true, blocked: false });
  }
  // Блокировка — safety-critical: нельзя отвечать «blocked», если upsert не прошёл
  // (иначе пользователь думает, что оградился от нарушителя, а на деле нет).
  const { error } = await sb
    .from("blocks")
    .upsert({ blocker_id: user.id, blocked_id: target_id }, { onConflict: "blocker_id,blocked_id" });
  if (error) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  return NextResponse.json({ ok: true, blocked: true });
}
