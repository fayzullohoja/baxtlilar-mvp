/**
 * V3 Sprint 2 — Экран 7 «Семейная модель».
 * Между values и marriage. API: /api/onboarding/profile/family-model.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaFamilyModelForm } from "@/components/v2/AnketaFamilyModelForm";
import type { Gender } from "@/lib/profile/gender-wording";

export const dynamic = "force-dynamic";

export default async function V2AnketaFamilyModelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUserAtStep(locale, "profile_family_model");
  const t = await getTranslations("Anketa");

  // Пол нужен для gender-wording (М-юзер видит «В основном жена», Ж — «муж»).
  // Живёт в user_profiles, не в users. Один column, single row — почти бесплатно.
  const { data: prof } = await supabaseAdmin()
    .from("user_profiles")
    .select("gender")
    .eq("user_id", user.id)
    .maybeSingle();
  const gender: Gender | null =
    prof?.gender === "m" || prof?.gender === "f" ? (prof.gender as Gender) : null;

  return (
    <MiniAppShell eyebrow={t("family_model_eyebrow")} align="top">
      <Headline size="lg" as="h1">{t("family_model_headline")}</Headline>
      <Lead>{t("family_model_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaFamilyModelForm locale={locale} gender={gender} />
      </div>
    </MiniAppShell>
  );
}
