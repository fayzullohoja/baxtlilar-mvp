import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Волна 7 Фаза 2: деактивировать/реактивировать аккаунт. staff.manage (super).
// Инварианты (нельзя себя / последнего активного super) — в RPC (race-safe).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "staff.manage"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { active?: boolean };
  if (typeof body.active !== "boolean")
    return NextResponse.json({ ok: false, error: "bad_active" }, { status: 400 });

  const { data, error } = await supabaseAdmin().rpc("admin_set_staff_active", {
    p_actor: session.adminId,
    p_target: id,
    p_active: body.active,
  });
  if (error) {
    console.error("[staff/active] RPC error:", error.message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
  const r = data as { ok: boolean; error?: string };
  if (!r.ok) return NextResponse.json(r, { status: r.error === "not_found" ? 404 : 400 });
  return NextResponse.json({ ok: true });
}
