import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkAndIncrement } from "@/lib/matching/quota";
import { ensureChat } from "@/lib/matching/chat";
import { notifyUser } from "@/lib/telegram/notify";
import { areBlocked } from "@/lib/safety/blocks";

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

  // получатель активен и опубликован?
  const { data: target } = await sb
    .from("users")
    .select("id, telegram_id, lifecycle_state")
    .eq("id", receiver_id)
    .maybeSingle();
  if (!target || target.lifecycle_state !== "active")
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 404 });

  // блокировка в любую сторону
  if (await areBlocked(user.id, receiver_id))
    return NextResponse.json({ ok: false, error: "blocked" }, { status: 403 });

  // встречный pending → взаимный интерес: открыть чат
  const { data: reverse } = await sb
    .from("match_requests")
    .select("id")
    .eq("sender_id", receiver_id)
    .eq("receiver_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (reverse) {
    await sb.from("match_requests").update({ status: "accepted" }).eq("id", reverse.id as string);
    const chatId = await ensureChat(user.id, receiver_id);
    await notifyUser(target.telegram_id as number, "Ваш интерес взаимен — чат открыт в Baxtlilar.");
    return NextResponse.json({ ok: true, mutual: true, next: `/chats/${chatId}` });
  }

  // уже есть активный запрос между нами?
  const { data: existing } = await sb
    .from("match_requests")
    .select("id, status")
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiver_id})`)
    .in("status", ["pending", "accepted"])
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: false, error: "already_sent" }, { status: 409 });

  if (!(await checkAndIncrement(user.id, "interests")))
    return NextResponse.json({ ok: false, error: "daily_limit" }, { status: 429 });

  const autoDecline = new Date(Date.now() + AUTO_DECLINE_HOURS * 3600_000).toISOString();
  await sb.from("match_requests").insert({
    sender_id: user.id,
    receiver_id,
    message: message?.slice(0, 300) ?? null,
    auto_decline_at: autoDecline,
  });
  await notifyUser(target.telegram_id as number, "У вас новый интерес в Baxtlilar. Откройте «Запросы».");
  return NextResponse.json({ ok: true, mutual: false });
}
