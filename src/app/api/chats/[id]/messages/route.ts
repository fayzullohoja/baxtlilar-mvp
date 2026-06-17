import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { containsContact } from "@/lib/profile/schemas";
import { notifyUser } from "@/lib/telegram/notify";
import { loadChatRow, getLiveState } from "@/lib/chat/live";
import { areBlocked } from "@/lib/safety/blocks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 10_000; // окно антифлуда
const RATE_MAX = 10; // не больше 10 сообщений за 10с в один чат

/**
 * Дозагрузка живого состояния чата (фолбэк-опрос, когда нет SSE).
 * ?after=<ISO> → новые сообщения; всегда возвращает read_through (галочки) и typing.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { user, res } = await loadActiveUserApi({ allowPaused: true });
  if (res) return res;
  const { id } = await params;
  const chat = await loadChatRow(id, user.id);
  if (!chat) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const after = new URL(req.url).searchParams.get("after");
  const state = await getLiveState(id, user.id, chat, after);
  return NextResponse.json({ ok: true, ...state });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { user, res } = await loadActiveUserApi({ allowPaused: true });
  if (res) return res;
  const { id } = await params;
  const { body } = (await req.json().catch(() => ({}))) as { body?: string };
  const text = (body ?? "").trim();
  if (!text) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ ok: false, error: "too_long" }, { status: 400 });
  // анти-спам: не даём передавать контакты в чате
  if (containsContact(text))
    return NextResponse.json({ ok: false, error: "contact_blocked" }, { status: 400 });

  const sb = supabaseAdmin();
  const chat = await loadChatRow(id, user.id);
  if (!chat) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const otherIdEarly = chat.user_a === user.id ? chat.user_b : chat.user_a;
  // блокировка в любую сторону → не отправляем и не уведомляем
  if (await areBlocked(user.id, otherIdEarly))
    return NextResponse.json({ ok: false, error: "blocked" }, { status: 403 });

  // антифлуд: не более RATE_MAX сообщений за RATE_WINDOW_MS в этом чате от одного отправителя
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count: recent } = await sb
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", id)
    .eq("sender_id", user.id)
    .gte("created_at", since);
  if ((recent ?? 0) >= RATE_MAX)
    return NextResponse.json({ ok: false, error: "too_fast" }, { status: 429 });

  // дебаунс пуша: уведомляем только если у получателя ещё НЕТ непрочитанных от меня (первое в серии)
  const { count: unreadFromMe } = await sb
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", id)
    .eq("sender_id", user.id)
    .is("read_at", null);
  const shouldPush = (unreadFromMe ?? 0) === 0;

  const { data: inserted, error: insertErr } = await sb
    .from("chat_messages")
    .insert({ chat_id: id, sender_id: user.id, body: text })
    .select("id, sender_id, body, created_at, read_at")
    .single();
  // Нельзя отвечать «ok», если вставка не прошла: пользователь увидит, что
  // сообщение «отправлено», а его нет (потеря данных). Не трогаем чат/пуш на сбое.
  if (insertErr || !inserted)
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 500 });
  // отправитель больше не «печатает» + обновляем время последнего сообщения
  const stopTyping = user.id === chat.user_a ? { typing_a_until: null } : { typing_b_until: null };
  await sb.from("chats").update({ last_message_at: new Date().toISOString(), ...stopTyping }).eq("id", id);

  if (shouldPush) {
    const { data: other } = await sb
      .from("users")
      .select("telegram_id, lifecycle_state")
      .eq("id", otherIdEarly)
      .maybeSingle();
    // Не пушим тому, кто удалил аккаунт (строка обезличена, но telegram_id сохранён
    // для аудита) — иначе удалившийся продолжает получать уведомления в Telegram.
    if (other && other.lifecycle_state !== "deleted")
      await notifyUser(other.telegram_id as number, "Новое сообщение в Baxtlilar.");
  }
  return NextResponse.json({ ok: true, message: inserted });
}
