/**
 * V4 (2026-06-30) — Чат 2 — Анкета.md Экран 9 «Финансы и материальная стабильность».
 * Между profile_family_model и profile_lifestyle.
 * API: /api/onboarding/profile/finance.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { loadAnketaDraft, draftSection } from "@/lib/onboarding/load-draft";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaFinanceForm } from "@/components/v2/AnketaFinanceForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaFinancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUserAtStep(locale, "profile_finance");
  const t = await getTranslations("Anketa");
  const draft = await loadAnketaDraft(user.id);
  const finance = draftSection(draft, "finance");

  return (
    <MiniAppShell eyebrow={t("finance_eyebrow")} align="top" showBack>
      <Headline size="lg" as="h1">
        {t("finance_title")}
      </Headline>
      <Lead>{t("finance_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaFinanceForm
          locale={locale}
          initial={{
            income_source_stability:
              (finance.income_source_stability as string) ?? "",
            financial_stability_importance:
              (finance.financial_stability_importance as number | null) ?? null,
            family_finance_management:
              (finance.family_finance_management as string) ?? "",
            financial_priorities:
              (finance.financial_priorities as string[]) ?? [],
            monthly_income_range:
              (finance.monthly_income_range as string) ?? "",
            financial_obligations:
              (finance.financial_obligations as string) ?? "",
            housing_status: (finance.housing_status as string) ?? "",
          }}
        />
      </div>
    </MiniAppShell>
  );
}
