import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { verifyTotp } from "@/lib/admin/totp";
import { trustedIp } from "@/lib/http/ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SEC-2b — подтверждение enrollment: код из приложения должен сойтись с pending
 * секретом. Только тогда 2FA активируется (pending → totp_secret). После этого
 * логин аккаунта требует TOTP (self-safe enforcement).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // SEC: через requireAdminApi (а не сырой getAdminSession) — иначе
  // деактивированный/удалённый админ с ещё живой 8-часовой кукой мог
  // привязать себе второй фактор: freshAdmin() тут не вызывался.
  const { session, res } = await requireAdminApi();
  if (res) return res;

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: admin } = await sb
    .from("admin_users")
    .select("totp_pending_secret")
    .eq("id", session.adminId)
    .maybeSingle();

  const pending = admin?.totp_pending_secret as string | null | undefined;
  if (!pending)
    return NextResponse.json({ ok: false, error: "no_pending_enrollment" }, { status: 400 });

  if (!verifyTotp(pending, code.trim()))
    return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 401 });

  const { error } = await sb
    .from("admin_users")
    .update({
      totp_secret: pending,
      totp_enrolled_at: new Date().toISOString(),
      totp_pending_secret: null,
    })
    .eq("id", session.adminId);
  if (error)
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });

  try {
    await adminAudit({
      adminId: session.adminId,
      action: "totp_enroll",
      entity: "admin",
      entityId: session.adminId,
      newValue: { enrolled: true },
      ip: trustedIp(req),
    });
  } catch (err) {
    console.error("[admin/totp/enroll/verify] adminAudit failed:", err);
  }

  return NextResponse.json({ ok: true });
}
