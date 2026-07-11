/**
 * V2 Anketa · Family (Blueprint §3.3 B2).
 * API: /api/onboarding/profile/family.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaFamilyForm } from "@/components/v2/AnketaFamilyForm";
import type { Gender } from "@/lib/profile/gender-wording";

export const dynamic = "force-dynamic";

export default async function V2AnketaFamilyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUserAtStep(locale, "profile_family");
  const t = await getTranslations("Anketa");

  // Пол нужен для gender-wording семейного положения (М: «Холост» / Ж: «Не была
  // в браке»; вдовец/вдова). Один column, single row — почти бесплатно.
  const { data: prof } = await supabaseAdmin()
    .from("user_profiles")
    .select("gender")
    .eq("user_id", user.id)
    .maybeSingle();
  const gender: Gender | null =
    prof?.gender === "m" || prof?.gender === "f" ? (prof.gender as Gender) : null;

  return (
    <MiniAppShell eyebrow={t("family_eyebrow")} align="top">
      <Headline size="lg" as="h1">{t("family_headline")}</Headline>
      <Lead>{t("family_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaFamilyForm locale={locale} gender={gender} />
      </div>
    </MiniAppShell>
  );
}
