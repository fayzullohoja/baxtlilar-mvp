import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { trustedIp } from "@/lib/http/ip";
import { loadInviteRows } from "@/lib/admin/load-invites";
import { createMasterCode } from "@/lib/invite/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Раздел «Приглашения» (Task 10) - рабочий инструмент модератора: увидеть все
 * коды, понять кто кого привёл, погасить утёкший код, выпустить мастер-код.
 * Гейт по образцу src/app/api/admin/staff/route.ts - invites.manage (super),
 * см. обоснование в src/lib/admin/permissions.ts.
 */
export async function GET(): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "invites.manage"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const rows = await loadInviteRows();
  return NextResponse.json({ ok: true, rows });
}

/**
 * Выпустить мастер-код (owner_id пуст, для оффлайн-встреч) - `label`
 * ОБЯЗАТЕЛЕН: это единственное, что потом объясняет, зачем код вообще
 * существует, когда его найдут в списке через полгода.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "invites.manage"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { label?: string };
  const label = (body.label ?? "").trim();
  if (!label) return NextResponse.json({ ok: false, error: "label_required" }, { status: 400 });

  let code: string;
  try {
    code = await createMasterCode(label);
  } catch (e) {
    console.error("[admin/invites] выпуск мастер-кода провалился:", e);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  await adminAudit({
    adminId: session.adminId,
    action: "invite_master_code_created",
    entity: "invite_code",
    newValue: { code, label },
    reason: label,
    ip: trustedIp(req),
  });
  return NextResponse.json({ ok: true, code });
}
