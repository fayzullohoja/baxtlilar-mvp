import { notFound } from "next/navigation";
import { requireAdmin, adminAudit } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { loadCase } from "@/lib/admin/load-case";
import { loadReasonTemplates } from "@/lib/admin/load-reason-templates";
import { getMergedMessages } from "@/lib/i18n/overrides";
import { optLabelOf, optTranslatorFromMessages } from "@/lib/profile/option-label";
import { GENDER, CITIZENSHIP } from "@/lib/profile/options";
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

  // Self-declared лейблы (пол/гражданство) — через тот же оверлей, что и мини-апп
  // (конструктор Tier 2), иначе экран сверки показывал бы БАЗУ мимо правок оунера.
  // CaseStudio клиентский → резолвим здесь (сервер) и прокидываем строками.
  const tOpt = optTranslatorFromMessages((await getMergedMessages("ru")).Options);
  const sd = c.self_declared;
  const selfDeclaredLabels = {
    gender: sd.gender ? optLabelOf(tOpt, GENDER, sd.gender, "ru") : null,
    citizenship: sd.citizenship ? optLabelOf(tOpt, CITIZENSHIP, sd.citizenship, "ru") : null,
  };

  return (
    <OpsShell
      adminName={admin?.login ?? "—"}
      adminRole={session.role}
    >
      <CaseStudio
        loadedCase={c}
        currentAdminId={session.adminId}
        reasonTemplates={reasonTemplates}
        selfDeclaredLabels={selfDeclaredLabels}
      />
    </OpsShell>
  );
}
