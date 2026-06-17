import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASONS = ["fake", "offensive", "contacts", "spam", "inappropriate", "other"];

/** Пожаловаться на пользователя/чат (анонимно для нарушителя) → очередь модерации. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadActiveUserApi({ allowPaused: true });
  if (res) return res;
  const { target_user_id, reason_code, comment, chat_id } = (await req.json().catch(() => ({}))) as {
    target_user_id?: string;
    reason_code?: string;
    comment?: string;
    chat_id?: string;
  };
  if (!target_user_id || target_user_id === user.id)
    return NextResponse.json({ ok: false, error: "bad_target" }, { status: 400 });
  const reason = REASONS.includes(reason_code ?? "") ? reason_code : "other";

  // Жалоба — safety-critical: нельзя отвечать «ok», если запись не легла в очередь
  // модерации (иначе сигнал о нарушении тихо теряется).
  const { error } = await supabaseAdmin().from("reports").insert({
    reporter_id: user.id,
    target_user_id,
    chat_id: chat_id ?? null,
    reason_code: reason,
    comment: comment?.slice(0, 1000) ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
