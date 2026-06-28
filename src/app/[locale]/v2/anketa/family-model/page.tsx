/**
 * V3 Sprint 2 — Экран 7 «Семейная модель».
 * Между values и marriage. API: /api/onboarding/profile/family-model.
 */

import { setRequestLocale } from "next-intl/server";
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

  return (
    <MiniAppShell eyebrow="Шаг 5 · Анкета" align="top">
      <Headline size="lg" as="h1">
        Как вижу нашу&nbsp;семью.
      </Headline>
      <Lead>
        Эти вопросы помогают подобрать партнёра, который смотрит на&nbsp;семью
        похоже. Здесь нет правильных ответов — есть только твой выбор.
      </Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaFamilyModelForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
