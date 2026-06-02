import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getAdminSession, type AdminSession } from "./session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type AdminRow = { id: string; login: string; role: "superadmin" | "moderator" };

/** Свежие данные админа из БД (роль авторитетна тут, не в куке). null → удалён. */
async function freshAdmin(adminId: string): Promise<{ id: string; role: "superadmin" | "moderator" } | null> {
  const { data } = await supabaseAdmin().from("admin_users").select("id, role").eq("id", adminId).maybeSingle();
  return data ? { id: data.id as string, role: data.role as "superadmin" | "moderator" } : null;
}

/** Для admin-страниц: вернуть сессию (роль — из БД) или редирект на /admin/login. */
export async function requireAdmin(): Promise<AdminSession> {
  const s = await getAdminSession();
  if (!s) redirect("/admin/login");
  const fresh = await freshAdmin(s!.adminId);
  if (!fresh) redirect("/admin/login");
  return { ...s!, role: fresh!.role };
}

/** Для admin API-роутов: вернуть { session } (роль — из БД) или { res: 401 }. */
export async function requireAdminApi(): Promise<
  { session: AdminSession; res?: undefined } | { session?: undefined; res: NextResponse }
> {
  const s = await getAdminSession();
  if (!s) return { res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  // роль и существование берём из БД — снятие прав/удаление действует сразу, а не после перелогина
  const fresh = await freshAdmin(s.adminId);
  if (!fresh) return { res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  return { session: { ...s, role: fresh.role } };
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
