import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { loadInviteRows } from "@/lib/admin/load-invites";
import { InvitesManager } from "./InvitesManager";

export const dynamic = "force-dynamic";

// Task 10: раздел «Приглашения» - рабочий инструмент модератора: увидеть все
// коды, понять кто кого привёл, погасить утёкший код, выпустить мастер-код.
// invites.manage (super) - по образцу /admin/staff (staff/page.tsx).
export default async function InvitesPage() {
  const session = await requireAdmin();
  if (!can(session.role, "invites.manage")) notFound();

  const sb = supabaseAdmin();
  const { data: me } = await sb
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const rows = await loadInviteRows();

  return (
    <OpsShell adminName={me?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Приглашения</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 20 }}>
        Все коды-приглашения: кто выпустил, кого привёл, что погашено и почему.
        Кнопка «Погасить» закрывает и саму строку кода, и право человека
        получить новый - без этого гашение отменяло бы само себя при первом же
        заходе человека на экран «Пригласить».
      </p>
      <InvitesManager rows={rows} />
    </OpsShell>
  );
}
