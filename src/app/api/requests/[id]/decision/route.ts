import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tryDeliverNow } from "@/lib/v2/tg-outbox-worker";
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

  // C-026: accept атомарно ОДНОЙ RPC — статус + чат + enqueue уведомления в одной
  // транзакции (устраняет неатомарный accept с рукописным откатом и dual-write
  // потерю уведомления). Лок пары внутри RPC сериализует со встречным
  // process_interest → без второго чата.
  const { data: accData, error: accErr } = await sb.rpc("accept_interest", {
    p_request: id,
    p_receiver: user.id,
  });
  if (accErr) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  const acc = (Array.isArray(accData) ? accData[0] : accData) as
    | { result?: string; chat_id?: string; outbox_id?: string }
    | undefined;

  switch (acc?.result) {
    case "accepted":
      // outbox-строка уже зафиксирована в транзакции RPC; здесь только
      // best-effort мгновенная доставка. Cron tg-outbox — retry-safe фолбэк.
      await tryDeliverNow(acc.outbox_id ?? null);
      return NextResponse.json({ ok: true, next: `/chats/${acc.chat_id}` });
    case "expired":
      return NextResponse.json({ ok: false, error: "expired" }, { status: 409 });
    case "forbidden":
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    case "not_found":
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    case "not_pending":
    default:
      return NextResponse.json({ ok: false, error: "not_pending" }, { status: 409 });
  }
}
