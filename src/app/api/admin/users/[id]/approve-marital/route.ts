import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { trustedIp } from "@/lib/http/ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * F4 hard-gate (ревью оунера): оператор одобряет «чувствительное» семейное
 * положение (в процессе развода / в браке, но раздельно). До одобрения профиль
 * с needs_marital_review=true ПОЛНОСТЬЮ вне мэтчинга (гейт в get_recommendations
 * / is_matchable, миграция 20260711090000). Одобрение снимает флаг → профиль
 * снова виден.
 *
 * Контент-ревью — работа модератора, поэтому superadmin НЕ требуется (в отличие
 * от danger-zone). Идемпотентно: повторный вызов на уже снятом флаге → 409
 * not_flagged (нечего одобрять), не двойной аудит.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  const { id } = await params;

  const sb = supabaseAdmin();
  const { data: prof } = await sb
    .from("user_profiles")
    .select("user_id, needs_marital_review, marital_status")
    .eq("user_id", id)
    .maybeSingle();
  if (!prof)
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (prof.needs_marital_review !== true)
    return NextResponse.json({ ok: false, error: "not_flagged" }, { status: 409 });

  const { data: updated, error } = await sb
    .from("user_profiles")
    .update({ needs_marital_review: false })
    .eq("user_id", id)
    .eq("needs_marital_review", true) // guard against race / double-approve
    .select("user_id");
  if (error) {
    console.error("[approve-marital] update error:", error.message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
  // Гонка: другой оператор снял флаг между нашим SELECT и UPDATE → 0 строк.
  // Идемпотентно отвечаем ok, но НЕ пишем дубль в admin_audit_log.
  if (!updated || updated.length === 0)
    return NextResponse.json({ ok: true, already_cleared: true });

  await adminAudit({
    adminId: session.adminId,
    action: "marital_review_approved",
    entity: "user",
    entityId: id,
    newValue: { marital_status: prof.marital_status, needs_marital_review: false },
    ip: trustedIp(req),
  });
  return NextResponse.json({ ok: true });
}
