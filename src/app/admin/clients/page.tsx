import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { searchClients } from "@/lib/admin/load-clients-search";
import { ClientsScreen } from "./ClientsScreen";
import { ADMIN } from "@/lib/admin/admin-tokens";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireAdmin();
  // F-120: директория = browse-anyone PII (ПИНФЛ/паспорт/телефон). Super-only,
  // как /admin/users в проде. Модератор работает из своей очереди.
  if (session.role !== "superadmin") redirect("/admin/queue/mine");

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const { rows } = await searchClients("", 50);

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Клиенты</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 24 }}>
        Поиск по ФИО, ПИНФЛ, паспорту, телефону, @username
      </p>
      <ClientsScreen initial={rows} />
    </OpsShell>
  );
}
