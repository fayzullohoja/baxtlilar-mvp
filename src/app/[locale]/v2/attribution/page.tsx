/**
 * V2 Attribution (Blueprint §3.3 B8) — последний шаг анкеты.
 * Источники для PO. Skip разрешён.
 * API: /api/onboarding/attribution → переход в tutorial_intro (V2 Sprint 1).
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AttributionForm } from "@/components/v2/AttributionForm";

export const dynamic = "force-dynamic";

export default async function V2AttributionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "attribution");
  const t = await getTranslations("Onboarding");

  return (
    <MiniAppShell eyebrow={t("attr_eyebrow")} align="top" showBack>
      <div className="v2-screen-in">
        <Headline size="lg" as="h1">
          {t("attr_title")}
        </Headline>
        <Lead>{t("attr_subtitle")}</Lead>

        <div style={{ marginTop: "32px" }}>
          <V2AttributionForm />
        </div>
      </div>
    </MiniAppShell>
  );
}
