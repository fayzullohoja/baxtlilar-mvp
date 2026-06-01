import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/admin/password";
import { setAdminSession, type AdminRole } from "@/lib/admin/session";
import { isLoginThrottled, recordLoginAttempt } from "@/lib/admin/throttle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req);
  if (await isLoginThrottled(ip)) {
    return NextResponse.json({ ok: false, error: "throttled" }, { status: 429 });
  }

  const { login, password } = (await req.json().catch(() => ({}))) as {
    login?: string;
    password?: string;
  };
  if (!login || !password) {
    return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  }

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("id, role, password_hash")
    .eq("login", login)
    .maybeSingle();

  const ok = admin ? verifyPassword(password, admin.password_hash as string) : false;
  await recordLoginAttempt(ip, ok);
  if (!ok) return NextResponse.json({ ok: false, error: "invalid" }, { status: 401 });

  await setAdminSession({ adminId: admin!.id as string, role: admin!.role as AdminRole });
  return NextResponse.json({ ok: true });
}
