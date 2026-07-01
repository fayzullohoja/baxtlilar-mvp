/**
 * V4 (2026-06-30) — Чат 2 — Анкета.md Экран 9 «Финансы и материальная стабильность».
 * Между profile_family_model и profile_lifestyle.
 * API: /api/onboarding/profile/finance.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
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
  await requireUserAtStep(locale, "profile_finance");
  const t = await getTranslations("Anketa");

  return (
    <MiniAppShell eyebrow={t("finance_eyebrow")} align="top">
      <Headline size="lg" as="h1">
        {t("finance_title")}
      </Headline>
      <Lead>{t("finance_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaFinanceForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
