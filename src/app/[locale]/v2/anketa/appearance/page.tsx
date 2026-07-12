/**
 * V2 Anketa · Appearance (2026-06-28 продуктовая поправка).
 * Шаг 2/8: рост / вес / родной язык / владею языками.
 * API: /api/onboarding/profile/appearance.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { loadAnketaDraft, draftSection } from "@/lib/onboarding/load-draft";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaAppearanceForm } from "@/components/v2/AnketaAppearanceForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaAppearancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUserAtStep(locale, "profile_appearance");
  const t = await getTranslations("Anketa");
  const draft = await loadAnketaDraft(user.id);

  return (
    <MiniAppShell eyebrow={t("appearance_eyebrow")} align="top" showBack>
      <Headline size="lg" as="h1">{t("appearance_headline")}</Headline>
      <Lead>{t("appearance_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaAppearanceForm
          locale={locale}
          initial={{
            height_cm:
              typeof draft.height_cm === "number" ? draft.height_cm : undefined,
            weight_kg:
              typeof draft.weight_kg === "number" ? draft.weight_kg : undefined,
            native_language: (draft.native_language as string) ?? "",
            languages: (draft.languages as string[]) ?? [],
            other_language:
              (draftSection(draft, "langs").other_language as string) ?? "",
          }}
        />
      </div>
    </MiniAppShell>
  );
}
