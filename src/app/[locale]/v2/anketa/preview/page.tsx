/**
 * V2 Anketa · Preview (Blueprint §3.3 B6).
 *
 * Показываем юзеру как его увидят ДРУГИЕ. Используем тот же
 * ProgressiveProfile что и в /main — это и есть pre-mutual вид.
 * Editorial-приём: «вот как ты звучишь со стороны».
 *
 * API: /api/onboarding/profile/publish — финальный transition в quiz.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { ProgressiveProfile } from "@/components/v2/ProgressiveProfile";
import { V2PublishButton } from "@/components/v2/PublishButton";
import type { ProfileForMatch } from "@/lib/v2/match-story";

export const dynamic = "force-dynamic";

async function loadOwnProfile(userId: string): Promise<ProfileForMatch | null> {
  const sb = supabaseAdmin();
  const { data: p } = await sb
    .from("user_profiles")
    .select(
      "display_name, city, values, birth_date, marital_status, has_children, " +
        "children_plan, religion, religion_importance, education, employment, bio, " +
        "partner_age_min, partner_age_max, geo_preference",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!p) return null;

  const { data: q } = await sb
    .from("quiz_results")
    .select("vector")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    display_name: (p.display_name as string) ?? "",
    city: (p.city as string) ?? null,
    values: (p.values as string[]) ?? [],
    birth_date: (p.birth_date as string) ?? null,
    marital_status: (p.marital_status as string) ?? null,
    has_children: (p.has_children as string) ?? null,
    children_plan: (p.children_plan as string) ?? null,
    religion: (p.religion as string) ?? null,
    religion_importance: (p.religion_importance as number) ?? null,
    education: (p.education as string) ?? null,
    employment: (p.employment as string) ?? null,
    bio: (p.bio as string) ?? null,
    partner_age_min: (p.partner_age_min as number) ?? null,
    partner_age_max: (p.partner_age_max as number) ?? null,
    geo_preference: (p.geo_preference as string) ?? null,
    vector: (q?.vector as Record<string, number>) ?? {},
  };
}

export default async function V2AnketaPreviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUserAtStep(locale, "profile_preview");
  const profile = await loadOwnProfile(user.id);

  return (
    <MiniAppShell
      eyebrow="Шаг 8 из 8 · Анкета"
      align="top"
      footer={<V2PublishButton />}
    >
      <Headline size="lg" as="h1">
        Так тебя увидят другие.
      </Headline>
      <Lead>
        До&nbsp;взаимного интереса не показываются фото, фамилия, возраст,
        работодатель. Только это — твой голос. Если выглядит правильно —
        публикуем.
      </Lead>

      <div
        style={{
          marginTop: "32px",
          paddingTop: "24px",
          borderTop: "1px solid var(--color-v2-ink-500)",
        }}
      >
        {profile ? (
          <ProgressiveProfile profile={profile} locale={locale} />
        ) : (
          <p
            style={{
              fontFamily: "var(--font-v2-body)",
              color: "var(--color-v2-ink-300)",
              fontSize: "14px",
            }}
          >
            Анкета пустая. Вернись и&nbsp;заполни шаги.
          </p>
        )}
      </div>

      {/* Spacer чтобы footer-CTA не накрывал контент */}
      <div style={{ height: "60px" }} />
    </MiniAppShell>
  );
}
