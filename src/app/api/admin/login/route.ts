import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/admin/password";
import { setAdminSession, type AdminRole } from "@/lib/admin/session";
import { isLoginThrottled, recordLoginAttempt } from "@/lib/admin/throttle";
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
    .select("id, role, password_hash")
    .eq("login", login)
    .maybeSingle();

  const ok = admin ? verifyPassword(password, admin.password_hash as string) : false;
  if (!ok) {
    await recordLoginAttempt(ip, false);
    await recordLoginAttempt(loginKey, false);
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 401 });
  }
  await recordLoginAttempt(ip, true);

  await setAdminSession({ adminId: admin!.id as string, role: admin!.role as AdminRole });
  return NextResponse.json({ ok: true });
}
