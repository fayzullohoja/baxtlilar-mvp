/**
 * V3 Sprint 2 — Экран 8 «Ожидания от партнёра» (расширенный).
 * Между marriage и photos. API: /api/onboarding/profile/partner-extended.
 *
 * Заменяет legacy /v2/anketa/looking-for для V3 flow. Legacy остаётся
 * как fallback для users которые случайно попали в profile_looking_for.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaPartnerExtendedForm } from "@/components/v2/AnketaPartnerExtendedForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaPartnerExtendedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_partner_extended");

  return (
    <MiniAppShell eyebrow="Шаг 7 · Анкета" align="top">
      <Headline size="lg" as="h1">
        Кого ищу.
      </Headline>
      <Lead>
        Опиши важные критерии партнёра. Алгоритм учитывает совместимость
        ценностей сильнее, чем формальные параметры — но возраст и качества
        нужны для отсева.
      </Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaPartnerExtendedForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
