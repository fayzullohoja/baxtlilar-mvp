/**
 * V3 Sprint 1 — Экран 2 «Место рождения / родной регион».
 * Между basic и appearance/self. API: /api/onboarding/profile/birth-place.
 *
 * Цель экрана: понять родной регион юзера для культурной совместимости.
 * Это НЕ паспортная формальность — мы спрашиваем мягко («где ты родился»),
 * без точного адреса.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaBirthPlaceForm } from "@/components/v2/AnketaBirthPlaceForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaBirthPlacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_birth_place");

  return (
    <MiniAppShell eyebrow="Шаг 2 из 8 · Анкета" align="top">
      <Headline size="lg" as="h1">
        Откуда ты родом.
      </Headline>
      <Lead>
        Родной регион — про культурный и семейный контекст. Точный адрес
        не&nbsp;нужен.
      </Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaBirthPlaceForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
