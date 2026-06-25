import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureChat } from "@/lib/matching/chat";
import { notifyUser } from "@/lib/telegram/notify";
import { requirePermissionForRequest } from "@/lib/v2/with-permission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "accept" | "decline" | "withdraw";

/**
 * V2 gate: view_received_interests (есть только у verified).
 * Sender's withdraw — тоже verified-only. Shadow попадает в 403.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const gate = await requirePermissionForRequest("view_received_interests");
  if ("response" in gate) return gate.response;
  const { user } = gate;
  const { id } = await params;
  const { action } = (await req.json().catch(() => ({}))) as { action?: Action };
  if (!["accept", "decline", "withdraw"].includes(action ?? ""))
    return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: r } = await sb
    .from("match_requests")
    .select("id, sender_id, receiver_id, status, auto_decline_at")
    .eq("id", id)
    .maybeSingle();
  if (!r) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (r.status !== "pending")
    return NextResponse.json({ ok: false, error: "not_pending" }, { status: 409 });

  // Все переходы — условный UPDATE по status='pending' + RETURNING: атомарно (без
  // гонки двойного accept) и с проверкой ошибки (не отвечаем «ok» на тихий сбой БД).
  if (action === "withdraw") {
    if (r.sender_id !== user.id) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    const { data: upd, error } = await sb
      .from("match_requests")
      .update({ status: "withdrawn" })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");
    if (error) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
    if (!upd?.length) return NextResponse.json({ ok: false, error: "not_pending" }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  // accept / decline — только получатель
  if (r.receiver_id !== user.id)
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  if (new Date(r.auto_decline_at as string).getTime() < Date.now()) {
    await sb.from("match_requests").update({ status: "expired" }).eq("id", id).eq("status", "pending");
    return NextResponse.json({ ok: false, error: "expired" }, { status: 409 });
  }

  if (action === "decline") {
    const { data: upd, error } = await sb
      .from("match_requests")
      .update({ status: "declined" })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");
    if (error) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
    if (!upd?.length) return NextResponse.json({ ok: false, error: "not_pending" }, { status: 409 });
    return NextResponse.json({ ok: true }); // отправителя НЕ уведомляем (бережём)
  }

  // accept — чат и уведомление ТОЛЬКО если условный UPDATE реально применился
  // (иначе при гонке/сбое мог бы создаться чат, а заявка осталась бы pending).
  const { data: acc, error: accErr } = await sb
    .from("match_requests")
    .update({ status: "accepted" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (accErr) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  if (!acc?.length) return NextResponse.json({ ok: false, error: "not_pending" }, { status: 409 });
  const chatId = await ensureChat(r.sender_id as string, r.receiver_id as string);
  const { data: sender } = await sb
    .from("users")
    .select("telegram_id")
    .eq("id", r.sender_id as string)
    .maybeSingle();
  if (sender) await notifyUser(sender.telegram_id as number, "Ваш интерес принят — чат открыт в Baxtlilar.");
  return NextResponse.json({ ok: true, next: `/chats/${chatId}` });
}
