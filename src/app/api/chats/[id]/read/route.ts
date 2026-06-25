import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadChatRow } from "@/lib/chat/live";
import { requirePermissionForRequest } from "@/lib/v2/with-permission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** V2 gate: view_chat_list (verified + paused читают/помечают свои чаты). */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const gate = await requirePermissionForRequest("view_chat_list");
  if ("response" in gate) return gate.response;
  const { user } = gate;
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
