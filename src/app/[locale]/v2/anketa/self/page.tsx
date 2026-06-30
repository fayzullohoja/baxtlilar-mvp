/**
 * V3 Sprint 2 — Экран 3 «О себе».
 * bio + education + activity_field + employment_format.
 * API: /api/onboarding/profile/self.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaSelfForm } from "@/components/v2/AnketaSelfForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaSelfPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_self");
  const t = await getTranslations("Anketa");

  return (
    <MiniAppShell eyebrow={t("self_eyebrow")} align="top">
      <Headline size="lg" as="h1">{t("self_headline")}</Headline>
      <Lead>{t("self_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaSelfForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
