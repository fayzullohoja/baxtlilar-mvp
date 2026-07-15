/**
 * V3 Sprint 2 — Экран 8 «Ожидания от партнёра» (расширенный).
 * Между marriage и photos. API: /api/onboarding/profile/partner-extended.
 *
 * Заменяет legacy /v2/anketa/looking-for для V3 flow. Legacy остаётся
 * как fallback для users которые случайно попали в profile_looking_for.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { loadAnketaDraft, draftSection } from "@/lib/onboarding/load-draft";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { anketaProgress } from "@/lib/onboarding/anketa-progress";
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
  const user = await requireUserAtStep(locale, "profile_partner_extended");
  const t = await getTranslations("Anketa");
  const draft = await loadAnketaDraft(user.id);
  const partner = draftSection(draft, "partner");

  return (
    <MiniAppShell progress={anketaProgress("profile_partner_extended")} eyebrow={t("partner_extended_eyebrow")} align="top" showBack>
      <Headline size="lg" as="h1">{t("partner_extended_headline")}</Headline>
      <Lead>{t("partner_extended_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaPartnerExtendedForm
          locale={locale}
          initial={{
            partner_age_min:
              draft.partner_age_min != null ? String(draft.partner_age_min) : "",
            partner_age_max:
              draft.partner_age_max != null ? String(draft.partner_age_max) : "",
            partner_height_min:
              draft.partner_height_min != null
                ? String(draft.partner_height_min)
                : "",
            partner_height_max:
              draft.partner_height_max != null
                ? String(draft.partner_height_max)
                : "",
            // Вес + национальность — COLD (extended.partner), гидрация для «Назад».
            partner_weight_min:
              partner.partner_weight_min != null
                ? String(partner.partner_weight_min)
                : "",
            partner_weight_max:
              partner.partner_weight_max != null
                ? String(partner.partner_weight_max)
                : "",
            partner_nationality_pref:
              (partner.partner_nationality_pref as string) ?? "",
            partner_nationality:
              (partner.partner_nationality as string[]) ?? [],
            partner_top_qualities:
              (draft.partner_top_qualities as string[]) ?? [],
            partner_religion_match:
              (draft.partner_religion_match as string) ?? "",
            partner_health_attitude:
              (partner.partner_health_attitude as string) ?? "",
            partner_preferred_countries:
              (draft.partner_preferred_countries as string[]) ?? [],
            partner_marital_pref:
              (partner.partner_marital_pref as string[]) ?? [],
            partner_children_pref:
              (partner.partner_children_pref as string) ?? "",
            partner_hard_criteria:
              (partner.partner_hard_criteria as string[]) ?? [],
            partner_origin_region_pref:
              (partner.partner_origin_region_pref as string) ?? "",
          }}
        />
      </div>
    </MiniAppShell>
  );
}
