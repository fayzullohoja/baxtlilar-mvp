/**
 * V2 Anketa · Marriage (2026-06-28 продуктовая поправка).
 * Шаг 5/8: формат проживания после брака. Required для serious-marriage платформы.
 * API: /api/onboarding/profile/marriage.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaMarriageForm } from "@/components/v2/AnketaMarriageForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaMarriagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_marriage");

  return (
    <MiniAppShell eyebrow="Шаг 5 из 8 · Анкета" align="top">
      <Headline size="lg" as="h1">
        Как видишь&nbsp;будущую жизнь.
      </Headline>
      <Lead>
        Один из&nbsp;важнейших вопросов для семьи. Можно изменить позже —
        но&nbsp;сейчас выбери то, что чувствуешь как своё.
      </Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaMarriageForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
