import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { user, res } = await loadActiveUserApi({ allowPaused: true });
  if (res) return res;
  const { id } = await params;
  const sb = supabaseAdmin();

  const { data: chat } = await sb.from("chats").select("user_a, user_b").eq("id", id).maybeSingle();
  if (!chat || (chat.user_a !== user.id && chat.user_b !== user.id))
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  await sb
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("chat_id", id)
    .neq("sender_id", user.id)
    .is("read_at", null);
  return NextResponse.json({ ok: true });
}
