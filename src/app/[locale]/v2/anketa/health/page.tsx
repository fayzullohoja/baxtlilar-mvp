/**
 * §11 «Здоровье и особые обстоятельства» (ревью оунера 2026-07-14).
 * Между lifestyle и marriage. API: /api/onboarding/profile/health.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { loadAnketaDraft, draftSection } from "@/lib/onboarding/load-draft";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaHealthForm } from "@/components/v2/AnketaHealthForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaHealthPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUserAtStep(locale, "profile_health");
  const t = await getTranslations("Anketa");
  const draft = await loadAnketaDraft(user.id);
  const health = draftSection(draft, "health");

  return (
    <MiniAppShell eyebrow={t("health_eyebrow")} align="top" showBack>
      <Headline size="lg" as="h1">
        {t("health_title")}
      </Headline>
      <Lead>{t("health_intro")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaHealthForm
          locale={locale}
          initial={{
            health_openness: (health.health_openness as string) ?? "",
            medical_check_willingness:
              (health.medical_check_willingness as string) ?? "",
            substance_dependency_status:
              (health.substance_dependency_status as string) ?? "",
          }}
        />
      </div>
    </MiniAppShell>
  );
}
