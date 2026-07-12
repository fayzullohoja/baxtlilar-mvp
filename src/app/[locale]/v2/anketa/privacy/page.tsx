/**
 * V3 Sprint 3 — Экран 16 «Приватность» (MVP).
 *
 * После partner_extended, перед photos.
 * Только глобальный profile_visibility_mode (3 опции).
 * API: /api/onboarding/profile/privacy.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { loadAnketaDraft } from "@/lib/onboarding/load-draft";
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
  const user = await requireUserAtStep(locale, "profile_privacy");
  const t = await getTranslations("Anketa");
  const draft = await loadAnketaDraft(user.id);

  return (
    <MiniAppShell eyebrow={t("privacy_eyebrow")} align="top" showBack>
      <Headline size="lg" as="h1">{t("privacy_headline")}</Headline>
      <Lead>{t("privacy_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaPrivacyForm
          locale={locale}
          initial={{
            profile_visibility_mode:
              (draft.profile_visibility_mode as string) ?? "verified_only",
          }}
        />
      </div>
    </MiniAppShell>
  );
}
