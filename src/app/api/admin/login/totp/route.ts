import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getPendingTotp,
  setAdminSession,
  clearPendingTotp,
} from "@/lib/admin/session";
import { isLoginThrottled, recordLoginAttempt } from "@/lib/admin/throttle";
import { adminAudit } from "@/lib/admin/guard";
import { verifyTotp } from "@/lib/admin/totp";
import { trustedIp } from "@/lib/http/ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SEC-2c шаг 2 — подтверждение TOTP после верного пароля. Требует pending-cookie
 * (её ставит /api/admin/login при enrolled-аккаунте). Троттлинг по adminId.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = trustedIp(req);
  const pending = await getPendingTotp();
  if (!pending)
    return NextResponse.json({ ok: false, error: "no_pending" }, { status: 401 });

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });

  const totpKey = `totp:${pending.adminId}`;
  if (await isLoginThrottled(totpKey))
    return NextResponse.json({ ok: false, error: "throttled" }, { status: 429 });

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("id, role, totp_secret")
    .eq("id", pending.adminId)
    .maybeSingle();

  const secret = admin?.totp_secret as string | null | undefined;
  if (!secret || !verifyTotp(secret, code.trim())) {
    await recordLoginAttempt(totpKey, false);
    return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 401 });
  }
  await recordLoginAttempt(totpKey, true);

  await clearPendingTotp();
  await setAdminSession({ adminId: pending.adminId, role: pending.role });
  try {
    await adminAudit({
      adminId: pending.adminId,
      action: "login_totp",
      entity: "admin",
      entityId: pending.adminId,
      newValue: { role: pending.role },
      ip,
    });
  } catch (err) {
    console.error("[admin/login/totp] adminAudit failed:", err);
  }
  return NextResponse.json({ ok: true });
}
