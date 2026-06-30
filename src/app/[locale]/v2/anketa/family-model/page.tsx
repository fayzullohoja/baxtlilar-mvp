/**
 * V3 Sprint 2 — Экран 7 «Семейная модель».
 * Между values и marriage. API: /api/onboarding/profile/family-model.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaFamilyModelForm } from "@/components/v2/AnketaFamilyModelForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaFamilyModelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_family_model");
  const t = await getTranslations("Anketa");

  return (
    <MiniAppShell eyebrow={t("family_model_eyebrow")} align="top">
      <Headline size="lg" as="h1">{t("family_model_headline")}</Headline>
      <Lead>{t("family_model_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaFamilyModelForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
