import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DAILY_LIMITS } from "@/lib/matching/quota";
import { notifyUser } from "@/lib/telegram/notify";
import { areBlocked } from "@/lib/safety/blocks";
import { containsContact } from "@/lib/profile/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTO_DECLINE_HOURS = 72;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadActiveUserApi();
  if (res) return res;
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

  // вся логика (встречный матч / дубль / отказ / квота / вставка) атомарно в одной транзакции
  const { data, error } = await sb.rpc("process_interest", {
    p_sender: user.id,
    p_receiver: receiver_id,
    p_message: message?.slice(0, 300) ?? null,
    p_hours: AUTO_DECLINE_HOURS,
    p_limit: DAILY_LIMITS.interests,
  });
  if (error) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  const row = (Array.isArray(data) ? data[0] : data) as { result?: string; chat_id?: string } | undefined;

  switch (row?.result) {
    case "mutual":
      await notifyUser(target.telegram_id as number, "Ваш интерес взаимен — чат открыт в Baxtlilar.");
      return NextResponse.json({ ok: true, mutual: true, next: `/chats/${row.chat_id}` });
    case "sent":
      await notifyUser(target.telegram_id as number, "У вас новый интерес в Baxtlilar. Откройте «Запросы».");
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
