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

  const { data: u } = await supabaseAdmin()
    .from("users")
    .select("quiz_completion")
    .eq("id", id)
    .maybeSingle();
  // Вернуть в active, если онбординг был завершён; иначе — назад в onboarding.
  const restored = u?.quiz_completion === "completed" ? "active" : "onboarding";

  await supabaseAdmin().from("users").update({ blocked_at: null, blocked_reason: null }).eq("id", id);
  await transition(id, { lifecycle_state: restored }, "unbanned", {
    kind: "admin",
    id: session.adminId,
  });
  await adminAudit({
    adminId: session.adminId,
    action: "unban_user",
    entity: "user",
    entityId: id,
    newValue: { lifecycle_state: restored },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
  return NextResponse.json({ ok: true });
}
