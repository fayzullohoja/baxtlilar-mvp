import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getAdminSession, type AdminSession } from "./session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type AdminRow = { id: string; login: string; role: "superadmin" | "moderator" };

/** Для admin-страниц: вернуть сессию или редирект на /admin/login. */
export async function requireAdmin(): Promise<AdminSession> {
  const s = await getAdminSession();
  if (!s) redirect("/admin/login");
  return s!;
}

/** Для admin API-роутов: вернуть { session } или { res: 401 }. */
export async function requireAdminApi(): Promise<
  { session: AdminSession; res?: undefined } | { session?: undefined; res: NextResponse }
> {
  const s = await getAdminSession();
  if (!s) return { res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  // проверяем, что админ ещё существует
  const { data } = await supabaseAdmin().from("admin_users").select("id").eq("id", s.adminId).maybeSingle();
  if (!data) return { res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  return { session: s };
}

/** Записать действие админа в audit log. */
export async function adminAudit(params: {
  adminId: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  ip?: string;
}): Promise<void> {
  await supabaseAdmin().from("admin_audit_log").insert({
    admin_id: params.adminId,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId ?? null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    reason: params.reason ?? null,
    ip: params.ip ?? null,
  });
}
