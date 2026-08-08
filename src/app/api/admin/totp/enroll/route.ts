import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/admin/guard";
import { generateTotpSecret, otpauthUri } from "@/lib/admin/totp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SEC-2b — старт enrollment. Требует активную admin-сессию. Генерирует секрет,
 * кладёт как pending (не активен, пока не подтверждён кодом), возвращает секрет
 * + otpauth-URI (клиент рисует QR / показывает ключ для ручного ввода).
 */
export async function POST(): Promise<NextResponse> {
  // SEC: через requireAdminApi (а не сырой getAdminSession) — иначе
  // деактивированный/удалённый админ с ещё живой 8-часовой кукой мог
  // привязать себе второй фактор: freshAdmin() тут не вызывался.
  const { session, res } = await requireAdminApi();
  if (res) return res;

  const sb = supabaseAdmin();
  const { data: admin } = await sb
    .from("admin_users")
    .select("login, totp_secret")
    .eq("id", session.adminId)
    .maybeSingle();
  if (!admin)
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (admin.totp_secret)
    return NextResponse.json({ ok: false, error: "already_enrolled" }, { status: 409 });

  const secret = generateTotpSecret();
  const { error } = await sb
    .from("admin_users")
    .update({ totp_pending_secret: secret })
    .eq("id", session.adminId);
  if (error)
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    secret,
    otpauth: otpauthUri(secret, admin.login as string),
  });
}
