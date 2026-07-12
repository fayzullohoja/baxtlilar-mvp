import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// QZ-3: добавить внутреннюю заметку модератора к кейсу. author = текущий админ.
// Таблица case_notes уже была, но UI/эндпоинта не было — заметки некуда писать.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { body?: string };
  const text = (body.body ?? "").trim();
  if (text.length < 1 || text.length > 2000) {
    return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  // Кейс должен существовать (FK всё равно поймает, но так — чистый 404).
  const { data: kase } = await supabaseAdmin()
    .from("verification_cases")
    .select("id, assignee_id")
    .eq("id", id)
    .maybeSingle();
  if (!kase) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  // Scope-гейт как в соседних case-мутациях (draft/decision/blocking-reject):
  // модератор пишет заметку только в СВОЙ (заклейменный) кейс; superadmin — в любой.
  // Без этого — write-IDOR: заметки в чужие/закрытые кейсы (RLS выключен).
  if (!can(session.role, "queue.viewAll") && kase.assignee_id !== session.adminId) {
    return NextResponse.json({ ok: false, error: "not_claimed_by_you" }, { status: 403 });
  }

  const { error } = await supabaseAdmin()
    .from("case_notes")
    .insert({ case_id: id, author_id: session.adminId, body: text });
  if (error) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
