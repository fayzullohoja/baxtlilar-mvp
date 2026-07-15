/**
 * V2 Anketa · Экран 6 «Родители и участие семьи» (2026-07-12).
 * Между family и values. API: /api/onboarding/profile/parents.
 * Данные COLD → extended.parents; гидрация для кнопки «Назад».
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { loadAnketaDraft, draftSection } from "@/lib/onboarding/load-draft";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { anketaProgress } from "@/lib/onboarding/anketa-progress";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaParentsForm } from "@/components/v2/AnketaParentsForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaParentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUserAtStep(locale, "profile_parents");
  const t = await getTranslations("Anketa");

  const draft = await loadAnketaDraft(user.id);
  const parents = draftSection(draft, "parents");

  return (
    <MiniAppShell progress={anketaProgress("profile_parents")} eyebrow={t("parents_eyebrow")} align="top" showBack>
      <Headline size="lg" as="h1">{t("parents_headline")}</Headline>
      <Lead>{t("parents_lead")}</Lead>

      <div style={{ marginTop: "28px" }}>
        <V2AnketaParentsForm locale={locale} initial={parents} />
      </div>
    </MiniAppShell>
  );
}
