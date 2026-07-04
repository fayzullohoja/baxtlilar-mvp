import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/admin/password";
import { setAdminSession, setPendingTotp, type AdminRole } from "@/lib/admin/session";
import { isLoginThrottled, recordLoginAttempt } from "@/lib/admin/throttle";
import { adminAudit } from "@/lib/admin/guard";
import { trustedIp } from "@/lib/http/ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = trustedIp(req);

  const { login, password } = (await req.json().catch(() => ({}))) as {
    login?: string;
    password?: string;
  };
  if (!login || !password) {
    return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  }
  const loginKey = `login:${login}`;

  // ADM-2/SEC-2: лимит и по доверенному IP, и по учётке — брутфорс не обойти ротацией IP.
  if ((await isLoginThrottled(ip)) || (await isLoginThrottled(loginKey))) {
    return NextResponse.json({ ok: false, error: "throttled" }, { status: 429 });
  }

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("id, role, password_hash, totp_secret")
    .eq("login", login)
    .maybeSingle();

  const ok = admin ? verifyPassword(password, admin.password_hash as string) : false;
  if (!ok) {
    await recordLoginAttempt(ip, false);
    await recordLoginAttempt(loginKey, false);
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 401 });
  }
  await recordLoginAttempt(ip, true);

  // SEC-2c: если у аккаунта включён TOTP — пароль недостаточен. Выдаём
  // короткоживущую pending-cookie (не даёт доступа) и просим код. Enforcement
  // self-safe: срабатывает ТОЛЬКО для enrolled (totp_secret != null), поэтому
  // нет глобального флипа и self-lockout'а.
  if (admin!.totp_secret) {
    await setPendingTotp({ adminId: admin!.id as string, role: admin!.role as AdminRole });
    return NextResponse.json({ ok: true, totp_required: true });
  }

  // Bug #10 (2026-06-30, loop pass 2): recordLoginAttempt пишет в rate-limit
  // таблицу, но не в admin_audit_log. Compliance/forensics требует mirror в
  // audit. Не блокируем login на сбое аудита (rare, не критично).
  const adminId = admin!.id as string;
  const adminRole = admin!.role as AdminRole;
  try {
    await adminAudit({
      adminId,
      action: "login",
      entity: "admin",
      entityId: adminId,
      newValue: { role: adminRole },
      ip,
    });
  } catch (err) {
    console.error("[admin/login] adminAudit failed:", err);
  }

  await setAdminSession({ adminId, role: adminRole });
  return NextResponse.json({ ok: true });
}
