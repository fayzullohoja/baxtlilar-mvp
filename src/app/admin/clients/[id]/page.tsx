import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { loadClient } from "@/lib/admin/load-client";
import { ClientHero } from "./ClientHero";
import { IdentityTab } from "./IdentityTab";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin();

  const { id } = await params;
  const c = await loadClient(id);
  if (!c) notFound();

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  return (
    <OpsShell
      adminName={admin?.login ?? "—"}
      adminRole={session.role}
    >
      <ClientHero client={c} />
      <IdentityTab identity={c.identity} />
    </OpsShell>
  );
}
