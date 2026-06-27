import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { blockUser } from "@/lib/safety/blocks";
import { requirePermissionForRequest } from "@/lib/v2/with-permission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Заблокировать/разблокировать пользователя (взаимное скрытие, без уведомления).
 * V2 gate: block_user (verified + paused). Shadow не блокирует — он никого
 * не видит, блокировать некого.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requirePermissionForRequest("block_user");
  if ("response" in gate) return gate.response;
  const { user } = gate;
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
  // blockUser также рвёт висящие pending-заявки между парой.
  const ok = await blockUser(user.id, target_id);
  if (!ok) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });

  return NextResponse.json({ ok: true, blocked: true });
}
