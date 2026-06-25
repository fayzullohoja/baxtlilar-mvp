import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadChatRow } from "@/lib/chat/live";
import { requirePermissionForRequest } from "@/lib/v2/with-permission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPING_MS = 6000;

/**
 * Сигнал «я печатаю»: ставим typing_until = now + 6с на своей стороне. Эфемерно.
 * V2 gate: send_message (typing — это intent отправить сообщение).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const gate = await requirePermissionForRequest("send_message");
  if ("response" in gate) return gate.response;
  const { user } = gate;
  const { id } = await params;
  const chat = await loadChatRow(id, user.id);
  if (!chat) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const until = new Date(Date.now() + TYPING_MS).toISOString();
  const patch = user.id === chat.user_a ? { typing_a_until: until } : { typing_b_until: until };
  await supabaseAdmin().from("chats").update(patch).eq("id", id);
  return NextResponse.json({ ok: true });
}
