import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { containsContact } from "@/lib/profile/schemas";
import { notifyUser } from "@/lib/telegram/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadChat(id: string, userId: string) {
  const { data: chat } = await supabaseAdmin()
    .from("chats")
    .select("id, user_a, user_b")
    .eq("id", id)
    .maybeSingle();
  if (!chat || (chat.user_a !== userId && chat.user_b !== userId)) return null;
  return chat;
}

/** Дозагрузка сообщений для живого чата (опрос). ?after=<ISO> → сообщения с created_at >= after. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { user, res } = await loadActiveUserApi({ allowPaused: true });
  if (res) return res;
  const { id } = await params;
  const chat = await loadChat(id, user.id);
  if (!chat) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const after = new URL(req.url).searchParams.get("after");
  let q = supabaseAdmin()
    .from("chat_messages")
    .select("id, sender_id, body, created_at")
    .eq("chat_id", id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (after) q = q.gte("created_at", after);
  const { data } = await q;
  return NextResponse.json({ ok: true, messages: data ?? [] });
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
  const chat = await loadChat(id, user.id);
  if (!chat) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const { data: inserted } = await sb
    .from("chat_messages")
    .insert({ chat_id: id, sender_id: user.id, body: text })
    .select("id, sender_id, body, created_at")
    .single();
  await sb.from("chats").update({ last_message_at: new Date().toISOString() }).eq("id", id);

  const otherId = chat.user_a === user.id ? (chat.user_b as string) : (chat.user_a as string);
  const { data: other } = await sb.from("users").select("telegram_id").eq("id", otherId).maybeSingle();
  if (other) await notifyUser(other.telegram_id as number, "Новое сообщение в Baxtlilar.");
  return NextResponse.json({ ok: true, message: inserted });
}
