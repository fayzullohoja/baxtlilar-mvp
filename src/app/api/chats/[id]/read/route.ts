import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadChatRow } from "@/lib/chat/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { user, res } = await loadActiveUserApi({ allowPaused: true });
  if (res) return res;
  const { id } = await params;

  // F-008: loadChatRow возвращает null если есть блок — тогда /read даёт 404
  // и не помечает чужие сообщения прочитанными после блока.
  const chat = await loadChatRow(id, user.id);
  if (!chat) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  await supabaseAdmin()
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("chat_id", id)
    .neq("sender_id", user.id)
    .is("read_at", null);
  return NextResponse.json({ ok: true });
}
