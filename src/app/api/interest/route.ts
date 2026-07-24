import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DAILY_LIMITS } from "@/lib/matching/quota";
import { tryDeliverNow } from "@/lib/v2/tg-outbox-worker";
import { areBlocked } from "@/lib/safety/blocks";
import { containsContact } from "@/lib/profile/schemas";
import { requirePermissionForRequest } from "@/lib/v2/with-permission";
import { assertFeatureEnabledForRequest } from "@/lib/features/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTO_DECLINE_HOURS = 72;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // C-033 kill switch: отправка интересов выключается без деплоя. Гейтим только
  // ОТПРАВКУ — приём/резолв уже отправленных (/requests/[id]/decision) не трогаем,
  // чтобы in-flight интересы могли завершиться.
  const off = await assertFeatureEnabledForRequest("interests");
  if (off) return off;

  // V2 Phase A: единый permission gate (вместо ручной проверки роли).
  const gate = await requirePermissionForRequest("send_interest");
  if ("response" in gate) return gate.response;
  const { user } = gate;

  const sb = supabaseAdmin();

  const { receiver_id, message } = (await req.json().catch(() => ({}))) as {
    receiver_id?: string;
    message?: string;
  };
  if (!receiver_id || receiver_id === user.id)
    return NextResponse.json({ ok: false, error: "bad_target" }, { status: 400 });

  // Та же анти-контакт политика, что и в чате (инвариант 1): нельзя протаскивать
  // телефон/мессенджер/ссылку в сопроводительном сообщении интереса — иначе фильтр
  // чата обходится через заявку, которую получатель видит в «Запросах».
  if (message && containsContact(message))
    return NextResponse.json({ ok: false, error: "contact_blocked" }, { status: 400 });

  const { data: target } = await sb
    .from("users")
    .select("id, telegram_id, lifecycle_state")
    .eq("id", receiver_id)
    .maybeSingle();
  if (!target || target.lifecycle_state !== "active")
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 404 });

  if (await areBlocked(user.id, receiver_id))
    return NextResponse.json({ ok: false, error: "blocked" }, { status: 403 });

  // MATCH-1: получатель должен быть реально совместим (approved + published +
  // взаимный пол + взаимный возрастной диапазон — те же предикаты, что в
  // get_recommendations). Без этого интерес по произвольному UUID (из ссылки/
  // старого фида/перебора) обходил всю matchability, вплоть до одного пола.
  const { data: matchable } = await sb.rpc("is_matchable", {
    p_sender: user.id,
    p_receiver: receiver_id,
  });
  if (!matchable)
    return NextResponse.json({ ok: false, error: "not_eligible" }, { status: 403 });

  // вся логика (встречный матч / дубль / отказ / квота / вставка) атомарно в одной транзакции
  const { data, error } = await sb.rpc("process_interest", {
    p_sender: user.id,
    p_receiver: receiver_id,
    p_message: message?.slice(0, 300) ?? null,
    p_hours: AUTO_DECLINE_HOURS,
    p_limit: DAILY_LIMITS.interests,
  });
  if (error) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  const row = (Array.isArray(data) ? data[0] : data) as
    | { result?: string; chat_id?: string; outbox_id?: string }
    | undefined;

  switch (row?.result) {
    // C-032: уведомление уже зафиксировано в транзакции process_interest (не
    // dual-write). Здесь только best-effort мгновенная доставка; cron — фолбэк.
    case "mutual":
      await tryDeliverNow(row.outbox_id ?? null);
      return NextResponse.json({ ok: true, mutual: true, next: `/chats/${row.chat_id}` });
    case "sent":
      await tryDeliverNow(row.outbox_id ?? null);
      return NextResponse.json({ ok: true, mutual: false });
    case "blocked":
      return NextResponse.json({ ok: false, error: "blocked" }, { status: 403 });
    case "daily_limit":
      return NextResponse.json({ ok: false, error: "daily_limit" }, { status: 429 });
    case "already_sent":
      return NextResponse.json({ ok: false, error: "already_sent" }, { status: 409 });
    case "declined_block":
      return NextResponse.json({ ok: false, error: "declined" }, { status: 409 });
    default:
      return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
