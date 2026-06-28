/**
 * V2 Anketa · Values (Blueprint §3.3 B3).
 * API: /api/onboarding/profile/values.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaValuesForm } from "@/components/v2/AnketaValuesForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaValuesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_values");

  return (
    <MiniAppShell eyebrow="Шаг 4 из 8 · Анкета" align="top">
      <Headline size="lg" as="h1">
        Ценности и&nbsp;вера.
      </Headline>
      <Lead>
        Один из&nbsp;главных матчинг-сигналов. Не&nbsp;«какие правильные» —
        что для тебя сейчас важно, и насколько.
      </Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaValuesForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
