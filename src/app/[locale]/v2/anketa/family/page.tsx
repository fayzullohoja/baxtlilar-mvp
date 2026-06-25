/**
 * V2 Anketa · Family (Blueprint §3.3 B2).
 * API: /api/onboarding/profile/family.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaFamilyForm } from "@/components/v2/AnketaFamilyForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaFamilyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_family");

  return (
    <MiniAppShell eyebrow="Шаг 2 из 6 · Анкета" align="top">
      <Headline size="lg" as="h1">
        Где ты сейчас в&nbsp;жизни.
      </Headline>
      <Lead>
        Это влияет на&nbsp;подбор. Если планы по&nbsp;детям не совпадают,
        алгоритм сразу скажет об&nbsp;этом — лучше узнать с&nbsp;первой
        анкеты, чем потом.
      </Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaFamilyForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
