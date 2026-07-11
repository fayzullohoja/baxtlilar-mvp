import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DZ-3: сброс онбординга (стирает анкету/фото/паспорт/квиз/СОГЛАСИЯ, возвращает
// на старт). Superadmin-only. Аудит + guard blocked/pending_ban — в RPC.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (session.role !== "superadmin")
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = (body.reason ?? "").trim();
  if (reason.length < 3)
    return NextResponse.json({ ok: false, error: "reason_required" }, { status: 400 });

  const { data, error } = await supabaseAdmin().rpc("admin_restart_onboarding", {
    p_user_id: id,
    p_admin_id: session.adminId,
    p_reason: reason,
  });
  if (error) {
    console.error("[restart-onboarding] RPC error:", error.message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
  const r = data as { ok: boolean; error?: string };
  if (!r.ok)
    return NextResponse.json(r, { status: r.error === "not_found" ? 404 : 409 });
  return NextResponse.json({ ok: true });
}
