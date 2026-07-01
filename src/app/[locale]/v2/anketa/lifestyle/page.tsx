/**
 * V4 (2026-06-30) — Чат 2 — Анкета.md Экран 10 «Образ жизни и привычки».
 * Между finance и marriage. API: /api/onboarding/profile/lifestyle.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaLifestyleForm } from "@/components/v2/AnketaLifestyleForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaLifestylePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_lifestyle");
  const t = await getTranslations("Anketa");

  return (
    <MiniAppShell eyebrow={t("lifestyle_eyebrow")} align="top">
      <Headline size="lg" as="h1">
        {t("lifestyle_title")}
      </Headline>
      <Lead>{t("lifestyle_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaLifestyleForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
