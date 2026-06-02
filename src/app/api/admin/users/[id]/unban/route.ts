import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
  if (session.role !== "superadmin")
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const { data: u } = await supabaseAdmin()
    .from("users")
    .select("quiz_completion")
    .eq("id", id)
    .maybeSingle();
  // Вернуть в active, если онбординг был завершён; иначе — назад в onboarding.
  const restored = u?.quiz_completion === "completed" ? "active" : "onboarding";

  // M18: снимаем blocked_at/blocked_reason в том же атомарном переходе
  const tr = await tryTransition(
    id,
    { lifecycle_state: restored, blocked_at: null, blocked_reason: null },
    "unbanned",
    { kind: "admin", id: session.adminId },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  await adminAudit({
    adminId: session.adminId,
    action: "unban_user",
    entity: "user",
    entityId: id,
    newValue: { lifecycle_state: restored },
    ip: trustedIp(req),
  });
  return NextResponse.json({ ok: true });
}
