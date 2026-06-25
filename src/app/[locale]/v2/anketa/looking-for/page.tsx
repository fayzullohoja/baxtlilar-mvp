/**
 * V2 Anketa · Looking-for (Blueprint §3.3 B4).
 * Гендер партнёра НЕ спрашиваем — auto-противоположный (см. API).
 * API: /api/onboarding/profile/looking-for.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaLookingForm } from "@/components/v2/AnketaLookingForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaLookingForPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_looking_for");

  return (
    <MiniAppShell eyebrow="Шаг 4 из 6 · Анкета" align="top">
      <Headline size="lg" as="h1">
        Кого ищешь.
      </Headline>
      <Lead>
        Возраст и&nbsp;география. Алгоритм использует их как фильтр, не как
        приговор — иногда «слегка вне» бывает интересным мэтчем, и&nbsp;он
        вас покажет с пометкой.
      </Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaLookingForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
