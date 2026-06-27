import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { loadCase } from "@/lib/admin/load-case";
import { CaseStudio } from "./CaseStudio";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin();

  const { id } = await params;
  const c = await loadCase(id);
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
      <CaseStudio loadedCase={c} currentAdminId={session.adminId} />
    </OpsShell>
  );
}
