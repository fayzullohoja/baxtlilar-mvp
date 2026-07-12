import { notFound } from "next/navigation";
import { requireAdmin, adminAudit } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { loadCase } from "@/lib/admin/load-case";
import { loadReasonTemplates } from "@/lib/admin/load-reason-templates";
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

  // ADMIN-1: кейс-студия раскрывает паспорт/селфи (signed URLs). Модератор
  // вправе открыть ТОЛЬКО свой кейс (assignee=me) или неназначенный (чтобы
  // взять в работу). Чужой назначенный кейс → notFound. Superadmin — всегда.
  // Без этого любой модератор читал документы любого юзера по прямой ссылке
  // /admin/cases/<id>, минуя scope-модель очереди.
  if (
    !can(session.role, "queue.viewAll") &&
    c.assignee_id &&
    c.assignee_id !== session.adminId
  ) {
    notFound();
  }

  // SG-09 / KVKK: логируем ГРАНТИРОВАННЫЙ просмотр чувствительных данных
  // (паспорт/селфи/телефон). Раньше аудит писался только на write-действиях —
  // read-путь паспортов не оставлял следа для forensic-расследования.
  await adminAudit({
    adminId: session.adminId,
    action: "case_view",
    entity: "verification_case",
    entityId: id,
    newValue: { user_id: c.user.id },
  });

  const [{ data: admin }, reasonTemplates] = await Promise.all([
    supabaseAdmin()
      .from("admin_users")
      .select("login")
      .eq("id", session.adminId)
      .maybeSingle(),
    loadReasonTemplates("verification", "ru"),
  ]);

  return (
    <OpsShell
      adminName={admin?.login ?? "—"}
      adminRole={session.role}
    >
      <CaseStudio
        loadedCase={c}
        currentAdminId={session.adminId}
        reasonTemplates={reasonTemplates}
      />
    </OpsShell>
  );
}
