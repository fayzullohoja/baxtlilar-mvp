import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Заблокировать пользователя (взаимное скрытие, без уведомления). */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadActiveUserApi({ allowPaused: true });
  if (res) return res;
  const { target_id } = (await req.json().catch(() => ({}))) as { target_id?: string };
  if (!target_id || target_id === user.id)
    return NextResponse.json({ ok: false, error: "bad_target" }, { status: 400 });

  await supabaseAdmin()
    .from("blocks")
    .upsert({ blocker_id: user.id, blocked_id: target_id }, { onConflict: "blocker_id,blocked_id" });
  return NextResponse.json({ ok: true });
}
