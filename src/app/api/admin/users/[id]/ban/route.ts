import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { tryTransition } from "@/lib/state-machine/transitions";
import { trustedIp } from "@/lib/http/ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  // ADM-1: блокировка — действие супер-админа
  if (session.role !== "superadmin")
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };
  if (!reason?.trim())
    return NextResponse.json({ ok: false, error: "reason_required" }, { status: 400 });

  // M18: blocked_at/reason в том же атомарном переходе (не отдельный UPDATE, иначе ломается
  // оптимистичный concurrency transition_user)
  const tr = await tryTransition(
    id,
    { lifecycle_state: "blocked", blocked_at: new Date().toISOString(), blocked_reason: reason },
    `banned: ${reason}`,
    { kind: "admin", id: session.adminId },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  await adminAudit({
    adminId: session.adminId,
    action: "ban_user",
    entity: "user",
    entityId: id,
    reason,
    ip: trustedIp(req),
  });
  return NextResponse.json({ ok: true });
}
