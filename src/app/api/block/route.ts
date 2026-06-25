import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
  const { error } = await sb
    .from("blocks")
    .upsert({ blocker_id: user.id, blocked_id: target_id }, { onConflict: "blocker_id,blocked_id" });
  if (error) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });

  // Блок рвёт висящие интересы между парой (как при удалении аккаунта, итер.5):
  // входящая заявка нарушителя → declined (исчезает из «Запросов», её нельзя принять
  // в «призрак»-чат), своя к нему → withdrawn. Только pending — историю не трогаем.
  await sb
    .from("match_requests")
    .update({ status: "declined" })
    .eq("sender_id", target_id)
    .eq("receiver_id", user.id)
    .eq("status", "pending");
  await sb
    .from("match_requests")
    .update({ status: "withdrawn" })
    .eq("sender_id", user.id)
    .eq("receiver_id", target_id)
    .eq("status", "pending");

  return NextResponse.json({ ok: true, blocked: true });
}
