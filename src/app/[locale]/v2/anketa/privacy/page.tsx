/**
 * V3 Sprint 3 — Экран 16 «Приватность» (MVP).
 *
 * После partner_extended, перед photos.
 * Только глобальный profile_visibility_mode (3 опции).
 * API: /api/onboarding/profile/privacy.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaPrivacyForm } from "@/components/v2/AnketaPrivacyForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaPrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_privacy");

  return (
    <MiniAppShell eyebrow="Шаг 8 · Анкета" align="top">
      <Headline size="lg" as="h1">
        Кто увидит мою анкету.
      </Headline>
      <Lead>
        Все профили проходят верификацию паспортом, так что случайных людей
        в&nbsp;ленте не&nbsp;будет. Здесь — как анкета будет вести себя
        в&nbsp;поиске.
      </Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaPrivacyForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
