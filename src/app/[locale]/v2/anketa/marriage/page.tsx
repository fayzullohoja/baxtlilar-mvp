/**
 * V2 Anketa · Marriage (2026-06-28 продуктовая поправка).
 * Шаг 5/8: формат проживания после брака. Required для serious-marriage платформы.
 * API: /api/onboarding/profile/marriage.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { loadAnketaDraft } from "@/lib/onboarding/load-draft";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Gender } from "@/lib/profile/gender-wording";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { anketaProgress } from "@/lib/onboarding/anketa-progress";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaMarriageForm } from "@/components/v2/AnketaMarriageForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaMarriagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUserAtStep(locale, "profile_marriage");
  const t = await getTranslations("Anketa");
  const draft = await loadAnketaDraft(user.id);

  // Пол — для gender-wording проживания после брака (ревью 1.11).
  const { data: prof } = await supabaseAdmin()
    .from("user_profiles")
    .select("gender")
    .eq("user_id", user.id)
    .maybeSingle();
  const gender: Gender | null =
    prof?.gender === "m" || prof?.gender === "f" ? (prof.gender as Gender) : null;

  return (
    <MiniAppShell progress={anketaProgress("profile_marriage")} eyebrow={t("marriage_eyebrow")} align="top" showBack>
      <Headline size="lg" as="h1">{t("marriage_headline")}</Headline>
      <Lead>{t("marriage_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaMarriageForm
          locale={locale}
          gender={gender}
          initial={{
            post_marriage_living: (draft.post_marriage_living as string) ?? "",
            marriage_readiness: (draft.marriage_readiness as string) ?? "",
            relocation_readiness: (draft.relocation_readiness as string) ?? "",
          }}
        />
      </div>
    </MiniAppShell>
  );
}
