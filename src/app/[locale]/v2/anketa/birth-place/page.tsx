/**
 * V3 Sprint 1 — Экран 2 «Место рождения / родной регион».
 * Между basic и appearance/self. API: /api/onboarding/profile/birth-place.
 *
 * Цель экрана: понять родной регион юзера для культурной совместимости.
 * Это НЕ паспортная формальность — мы спрашиваем мягко («где ты родился»),
 * без точного адреса.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { loadAnketaDraft } from "@/lib/onboarding/load-draft";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { anketaProgress } from "@/lib/onboarding/anketa-progress";
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
  const user = await requireUserAtStep(locale, "profile_birth_place");
  const t = await getTranslations("Anketa");
  const draft = await loadAnketaDraft(user.id);

  return (
    <MiniAppShell progress={anketaProgress("profile_birth_place")} eyebrow={t("birthplace_eyebrow")} align="top" showBack>
      <Headline size="lg" as="h1">{t("birthplace_headline")}</Headline>
      <Lead>{t("birthplace_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaBirthPlaceForm
          locale={locale}
          initial={{
            birth_country: (draft.birth_country as string) ?? "UZ",
            birth_region: (draft.birth_region as string) ?? "",
            birth_district: (draft.birth_district as string) ?? "",
            birth_city: (draft.birth_city as string) ?? "",
          }}
        />
      </div>
    </MiniAppShell>
  );
}
