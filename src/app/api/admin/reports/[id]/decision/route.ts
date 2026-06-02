import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { trustedIp } from "@/lib/http/ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// допустимые переходы статуса жалобы (complaint_status)
const ALLOWED = ["in_progress", "action_taken", "not_confirmed", "escalated", "closed"] as const;
type Status = (typeof ALLOWED)[number];

/** Решение модератора по жалобе: смена статуса + запись в админ-аудит. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  const { id } = await params;
  const { status, reason } = (await req.json().catch(() => ({}))) as { status?: Status; reason?: string };
  if (!status || !ALLOWED.includes(status))
    return NextResponse.json({ ok: false, error: "bad_status" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: report } = await sb.from("reports").select("id, target_user_id").eq("id", id).maybeSingle();
  if (!report) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  await sb.from("reports").update({ status }).eq("id", id);
  await adminAudit({
    adminId: session.adminId,
    action: `report_${status}`,
    entity: "report",
    entityId: id,
    newValue: { target_user_id: report.target_user_id },
    reason,
    ip: trustedIp(req),
  });
  return NextResponse.json({ ok: true });
}
