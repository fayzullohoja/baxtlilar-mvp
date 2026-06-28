/**
 * V2 Anketa · Appearance (2026-06-28 продуктовая поправка).
 * Шаг 2/8: рост / вес / родной язык / владею языками.
 * API: /api/onboarding/profile/appearance.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaAppearanceForm } from "@/components/v2/AnketaAppearanceForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaAppearancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_appearance");

  return (
    <MiniAppShell eyebrow="Шаг 2 из 8 · Анкета" align="top">
      <Headline size="lg" as="h1">
        О&nbsp;тебе вживую.
      </Headline>
      <Lead>
        Эти поля помогают подобрать тех, кто понимает&nbsp;тебя без перевода
        и&nbsp;живёт в&nbsp;похожем темпе.
      </Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaAppearanceForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
