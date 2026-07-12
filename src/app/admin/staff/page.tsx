import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StaffManager, type StaffRow } from "./StaffManager";

export const dynamic = "force-dynamic";

// Волна 7 Фаза 2: управление персоналом. staff.manage (super).
export default async function StaffPage() {
  const session = await requireAdmin();
  if (!can(session.role, "staff.manage")) notFound();
  const sb = supabaseAdmin();

  const { data: me } = await sb
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const rows = unwrapRows(
    await sb
      .from("admin_users")
      .select("id, login, role, active, created_at, totp_secret")
      .order("created_at", { ascending: true }),
  ).map(
    (r): StaffRow => ({
      id: r.id as string,
      login: r.login as string,
      role: r.role as "superadmin" | "moderator",
      active: r.active !== false,
      created_at: r.created_at as string,
      totp: !!r.totp_secret,
    }),
  );

  return (
    <OpsShell adminName={me?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Персонал</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 20 }}>
        Аккаунты администраторов и модераторов. Нельзя разжаловать/деактивировать
        себя или последнего активного суперадмина.
      </p>
      <StaffManager rows={rows} currentAdminId={session.adminId} />
    </OpsShell>
  );
}
