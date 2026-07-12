import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { hashPassword } from "@/lib/admin/password";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Волна 7 Фаза 2: создать аккаунт админа. staff.manage (super). Пароль хешируется
// здесь (scrypt) и передаётся в RPC готовым. Аудит пишет сама RPC.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  if (!can(session.role, "staff.manage"))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    login?: string;
    password?: string;
    role?: string;
  };
  const login = (body.login ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const role = body.role ?? "";
  if (login.length < 3)
    return NextResponse.json({ ok: false, error: "bad_login" }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json({ ok: false, error: "weak_password" }, { status: 400 });
  if (role !== "superadmin" && role !== "moderator")
    return NextResponse.json({ ok: false, error: "bad_role" }, { status: 400 });

  const { data, error } = await supabaseAdmin().rpc("admin_create_staff", {
    p_actor: session.adminId,
    p_login: login,
    p_password_hash: hashPassword(password),
    p_role: role,
  });
  if (error) {
    console.error("[staff/create] RPC error:", error.message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
  const r = data as { ok: boolean; error?: string; id?: string };
  if (!r.ok) return NextResponse.json(r, { status: r.error === "login_taken" ? 409 : 400 });
  return NextResponse.json({ ok: true, id: r.id });
}
