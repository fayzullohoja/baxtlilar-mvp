import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASONS = ["fake", "offensive", "contacts", "spam", "inappropriate", "other"];
// статусы «открытой» жалобы — те же, что в очереди модерации (/admin/reports)
const OPEN_REPORT_STATUSES = ["new", "in_progress", "requires_clarification", "escalated"];

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

  const sb = supabaseAdmin();

  // дедуп: один ОТКРЫТЫЙ репорт на пару (reporter,target). Иначе один пользователь
  // накрутит счётчик «жалоб: N» на странице модерации (по нему приоритизируют/банят) —
  // griefing; так счётчик отражает число РАЗНЫХ жалующихся, а не повторов одного.
  // Fail-open: если сам dedup-запрос упал — всё равно даём подать жалобу (safety).
  const dup = await sb
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("target_user_id", target_user_id)
    .in("status", OPEN_REPORT_STATUSES)
    .limit(1);
  if (dup.data && dup.data.length) return NextResponse.json({ ok: true, deduped: true });

  // Жалоба — safety-critical: нельзя отвечать «ok», если запись не легла в очередь
  // модерации (иначе сигнал о нарушении тихо теряется).
  const { error } = await sb.from("reports").insert({
    reporter_id: user.id,
    target_user_id,
    chat_id: chat_id ?? null,
    reason_code: reason,
    comment: comment?.slice(0, 1000) ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
