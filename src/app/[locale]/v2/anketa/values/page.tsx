/**
 * V2 Anketa · Values (Blueprint §3.3 B3).
 * API: /api/onboarding/profile/values.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { loadAnketaDraft } from "@/lib/onboarding/load-draft";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { anketaProgress } from "@/lib/onboarding/anketa-progress";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaValuesForm } from "@/components/v2/AnketaValuesForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaValuesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUserAtStep(locale, "profile_values");
  const t = await getTranslations("Anketa");
  const draft = await loadAnketaDraft(user.id);

  return (
    <MiniAppShell progress={anketaProgress("profile_values")} eyebrow={t("values_eyebrow")} align="top" showBack>
      <Headline size="lg" as="h1">{t("values_headline")}</Headline>
      <Lead>{t("values_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaValuesForm
          locale={locale}
          initial={{
            religion: (draft.religion as string) ?? "",
            top_life_values: (draft.top_life_values as string[]) ?? [],
          }}
        />
      </div>
    </MiniAppShell>
  );
}
