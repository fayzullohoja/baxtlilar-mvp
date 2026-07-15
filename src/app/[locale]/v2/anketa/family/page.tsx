/**
 * V2 Anketa · Family (Blueprint §3.3 B2).
 * API: /api/onboarding/profile/family.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAnketaDraft, draftSection } from "@/lib/onboarding/load-draft";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { anketaProgress } from "@/lib/onboarding/anketa-progress";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2AnketaFamilyForm } from "@/components/v2/AnketaFamilyForm";
import type { ChildInfo } from "@/components/v2/ChildrenDetails";
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

  const draft = await loadAnketaDraft(user.id);
  const family = draftSection(draft, "family");
  // 2026-07-12: пер-детей (пол+возраст) в extended.family.children. Легаси-фолбэк
  // — children_count (int) без пер-детей → форма развернёт в N детей без возраста.
  const savedChildren = Array.isArray(family.children)
    ? (family.children as ChildInfo[])
    : undefined;
  const legacyCount =
    typeof draft.children_count === "number" ? String(draft.children_count) : "";

  return (
    <MiniAppShell progress={anketaProgress("profile_family")} eyebrow={t("family_eyebrow")} align="top" showBack>
      <Headline size="lg" as="h1">{t("family_headline")}</Headline>
      <Lead>{t("family_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaFamilyForm
          locale={locale}
          gender={gender}
          initial={{
            marital_status: (draft.marital_status as string) ?? "",
            has_children: (draft.has_children as string) ?? "",
            future_children_plan: (draft.future_children_plan as string) ?? "",
            children_count: legacyCount,
            children: savedChildren,
            children_living: (family.children_living as string) ?? "",
          }}
        />
      </div>
    </MiniAppShell>
  );
}
