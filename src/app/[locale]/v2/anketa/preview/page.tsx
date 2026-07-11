/**
 * V2 Anketa · Preview (Blueprint §3.3 B6).
 *
 * Показываем юзеру как его увидят ДРУГИЕ. Используем тот же
 * ProgressiveProfile что и в /main — это и есть pre-mutual вид.
 * Editorial-приём: «вот как ты звучишь со стороны».
 *
 * API: /api/onboarding/profile/publish — финальный transition в quiz.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { ProgressiveProfile } from "@/components/v2/ProgressiveProfile";
import { toProgressiveView } from "@/lib/v2/progressive-view";
import { V2PublishButton } from "@/components/v2/PublishButton";
import type { ProfileForMatch } from "@/lib/v2/match-story";

export const dynamic = "force-dynamic";

async function loadOwnProfile(userId: string): Promise<ProfileForMatch | null> {
  const sb = supabaseAdmin();
  const { data: p } = await sb
    .from("user_profiles")
    .select(
      "display_name, city, top_life_values, birth_date, marital_status, has_children, " +
        "future_children_plan, religion, education, bio, " +
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
    top_life_values: (p.top_life_values as string[]) ?? [],
    birth_date: (p.birth_date as string) ?? null,
    marital_status: (p.marital_status as string) ?? null,
    has_children: (p.has_children as string) ?? null,
    future_children_plan: (p.future_children_plan as string) ?? null,
    religion: (p.religion as string) ?? null,
    education: (p.education as string) ?? null,
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
  const t = await getTranslations("Anketa");
  const profile = await loadOwnProfile(user.id);

  return (
    <MiniAppShell
      eyebrow={t("preview_eyebrow")}
      align="top"
      footer={<V2PublishButton verificationStatus={user.verification_status} />}
    >
      <Headline size="lg" as="h1">{t("preview_headline")}</Headline>
      <Lead>{t("preview_lead")}</Lead>

      <div
        className="v2-rise"
        style={{
          marginTop: "32px",
          paddingTop: "24px",
          borderTop: "1px solid var(--color-v2-ink-500)",
        }}
      >
        {profile ? (
          <ProgressiveProfile
            profile={toProgressiveView({
              ...profile,
              verification_status: user.verification_status,
            })}
            locale={locale}
          />
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

      {/* Приватность анкеты — что видно / что скрыто (ревью оунера Экран 14). */}
      <div
        style={{
          marginTop: "24px",
          padding: "14px 16px",
          background: "var(--color-v2-chip-teal)",
          borderRadius: "14px",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        <div
          style={{
            fontSize: "13.5px",
            fontWeight: 700,
            color: "var(--color-v2-chip-teal-ink)",
            marginBottom: "4px",
          }}
        >
          {t("preview_privacy_heading")}
        </div>
        <div
          style={{
            fontSize: "12.5px",
            lineHeight: 1.55,
            color: "var(--color-v2-chip-teal-ink)",
          }}
        >
          {t("preview_privacy_body")}
        </div>
      </div>

      {/* Spacer чтобы footer-CTA не накрывал контент */}
      <div style={{ height: "60px" }} />
    </MiniAppShell>
  );
}
