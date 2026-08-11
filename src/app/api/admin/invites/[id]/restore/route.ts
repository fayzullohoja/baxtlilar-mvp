import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { trustedIp } from "@/lib/http/ip";
import { restoreInviteRight } from "@/lib/invite/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Кнопка «Восстановить право» в /admin/invites - симметричный ответ на вопрос
 * из ревью Task 8→10: "кто-то же должен снимать персональный запрет". Явное
 * действие оператора, не побочный эффект чего-то ещё.
 *
 * Только для строк, погашенных ИМЕННО этим разделом (disabled_reason="leak") -
 * тот же принцип фильтра, что у reviveBanDisabledCodes (Task 8): запрет,
 * поставленный по ДРУГОЙ причине, снимать здесь не должны (пока такой причины,
 * кроме "leak", в проекте нет - гейт всё равно ставим сразу, чтобы будущая
 * причина не открылась этой кнопкой случайно).
 *
 * Старую погашенную СТРОКУ кода не оживляем (см. docstring restoreInviteRight
 * в store.ts) - следующий заход человека на «Пригласить» сам выпустит
 * ensureCodeForUser'ом свежий код, раз персональный запрет снят.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "invites.manage"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const sb = supabaseAdmin();
  const { data: row, error: loadError } = await sb
    .from("invite_codes")
    .select("id, owner_id, disabled_reason")
    .eq("id", id)
    .maybeSingle();
  if (loadError) return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!row.owner_id)
    return NextResponse.json({ ok: false, error: "no_owner" }, { status: 400 });
  if (row.disabled_reason !== "leak")
    return NextResponse.json({ ok: false, error: "not_leak" }, { status: 409 });

  const ownerId = row.owner_id as string;
  try {
    await restoreInviteRight(ownerId);
  } catch (e) {
    console.error(`[admin/invites] снятие запрета для ${ownerId} провалилось:`, e);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  await adminAudit({
    adminId: session.adminId,
    action: "invite_right_restored",
    entity: "user",
    entityId: ownerId,
    oldValue: { invite_revoked_at: "set" },
    newValue: { invite_revoked_at: null },
    ip: trustedIp(req),
  });
  return NextResponse.json({ ok: true });
}
