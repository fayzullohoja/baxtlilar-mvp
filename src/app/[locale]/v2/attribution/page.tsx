/**
 * V2 Attribution (Blueprint §3.3 B8) — последний шаг анкеты.
 * Источники для PO. Skip разрешён.
 * API: /api/onboarding/attribution → переход в tutorial_intro (V2 Sprint 1).
 */

import { setRequestLocale } from "next-intl/server";
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

  return (
    <MiniAppShell eyebrow="Почти готово" align="top">
      <div className="v2-screen-in">
        <Headline size="lg" as="h1">
          Откуда узнал про&nbsp;нас?
        </Headline>
        <Lead>
          Помогает нам понять что работает. Можно пропустить — не влияет на
          твою анкету.
        </Lead>

        <div style={{ marginTop: "32px" }}>
          <V2AttributionForm />
        </div>
      </div>
    </MiniAppShell>
  );
}
