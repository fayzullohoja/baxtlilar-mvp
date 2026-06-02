import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { containsContact } from "@/lib/profile/schemas";
import { notifyUser } from "@/lib/telegram/notify";
import { loadChatRow, getLiveState } from "@/lib/chat/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const { data: inserted } = await sb
    .from("chat_messages")
    .insert({ chat_id: id, sender_id: user.id, body: text })
    .select("id, sender_id, body, created_at, read_at")
    .single();
  // отправитель больше не «печатает» + обновляем время последнего сообщения
  const stopTyping = user.id === chat.user_a ? { typing_a_until: null } : { typing_b_until: null };
  await sb.from("chats").update({ last_message_at: new Date().toISOString(), ...stopTyping }).eq("id", id);

  const otherId = chat.user_a === user.id ? chat.user_b : chat.user_a;
  const { data: other } = await sb.from("users").select("telegram_id").eq("id", otherId).maybeSingle();
  if (other) await notifyUser(other.telegram_id as number, "Новое сообщение в Baxtlilar.");
  return NextResponse.json({ ok: true, message: inserted });
}
