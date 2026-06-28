/**
 * V3 Sprint 2 — Экран 3 «О себе».
 * bio + education + activity_field + employment_format.
 * API: /api/onboarding/profile/self.
 */

import { setRequestLocale } from "next-intl/server";
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

  return (
    <MiniAppShell eyebrow="Шаг 3 из 8 · Анкета" align="top">
      <Headline size="lg" as="h1">
        О тебе вживую.
      </Headline>
      <Lead>
        Расскажи о себе, укажи образование и сферу деятельности. Это поможет
        другим понять характер и серьёзность намерений.
      </Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaSelfForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
