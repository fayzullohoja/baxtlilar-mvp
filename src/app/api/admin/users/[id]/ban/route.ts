import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transition } from "@/lib/state-machine/transitions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  const { id } = await params;
  const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };
  if (!reason?.trim())
    return NextResponse.json({ ok: false, error: "reason_required" }, { status: 400 });

  await supabaseAdmin()
    .from("users")
    .update({ blocked_at: new Date().toISOString(), blocked_reason: reason })
    .eq("id", id);
  await transition(id, { lifecycle_state: "blocked" }, `banned: ${reason}`, {
    kind: "admin",
    id: session.adminId,
  });
  await adminAudit({
    adminId: session.adminId,
    action: "ban_user",
    entity: "user",
    entityId: id,
    reason,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
  return NextResponse.json({ ok: true });
}
