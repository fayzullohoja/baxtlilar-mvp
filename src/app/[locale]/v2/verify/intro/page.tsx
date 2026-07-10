/**
 * V2 Verification Intro (Blueprint §3.2 A3).
 *
 * Editorial вариант экрана между ботом и загрузкой паспорта. Объясняем
 * «зачем верификация», задаём ожидания по времени, и почему это работает
 * параллельно с анкетой (Shadow Active модель).
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { VerificationIntroCta } from "@/components/v2/VerificationIntroCta";
import { BIOMETRIC_CONSENT_TEXT } from "@/content/biometric-consent";

export const dynamic = "force-dynamic";

export default async function V2VerificationIntroPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Verify');
  await requireUserAtStep(locale, "verification_intro");

  return (
    <MiniAppShell
      eyebrow={t('step1_label')}
      align="top"
      footer={<VerificationIntroCta />}
    >
      <div className="v2-screen-in">
        <Headline size="lg" as="h1">
          {t('headline')}
        </Headline>
        <Lead>
          {t('intro_description')}
        </Lead>

        <div style={{ marginTop: "28px" }}>
          <Step n={1} title={t('step_1_title')} body={t('step_1_body')} tone="amber" />
          <Step n={2} title={t('step_2_title')} body={t('step_2_body')} tone="teal" />
          <Step n={3} title={t('step_3_title')} body={t('step_3_body')} tone="neutral" />
        </div>

        <div
          style={{
            marginTop: "24px",
            padding: "12px 14px",
            background: "var(--color-v2-chip-teal)",
            borderRadius: "14px",
            fontSize: "12.5px",
            fontWeight: 600,
            color: "var(--color-v2-chip-teal-ink)",
            fontFamily: "var(--font-v2-body)",
            lineHeight: "1.55",
          }}
        >
          {t('privacy_footer')}
        </div>

        {/* Согласие на биометрию (перенесено из бота 2026-07-10). Текст =
            @/content/biometric-consent (тот же, что записывается в consents).
            CTA «Даю согласие и продолжаю» → POST записывает согласие. */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px 16px",
            background: "#fff",
            border: "1px solid var(--color-v2-border)",
            borderRadius: "14px",
            fontFamily: "var(--font-v2-body)",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--color-v2-ink-100)",
              marginBottom: "6px",
            }}
          >
            {t('consent_heading')}
          </div>
          <div
            style={{
              fontSize: "13px",
              lineHeight: "1.55",
              color: "var(--color-v2-ink-300)",
            }}
          >
            {BIOMETRIC_CONSENT_TEXT[locale === "uz" ? "uz" : "ru"]}
          </div>
        </div>
      </div>
    </MiniAppShell>
  );
}

const STEP_TONES = {
  amber: {
    bg: "var(--color-v2-chip-amber)",
    ink: "var(--color-v2-chip-amber-ink)",
  },
  teal: {
    bg: "var(--color-v2-chip-teal)",
    ink: "var(--color-v2-chip-teal-ink)",
  },
  neutral: {
    bg: "var(--color-v2-chip)",
    ink: "var(--color-v2-chip-ink)",
  },
} as const;

function Step({
  n,
  title,
  body,
  tone = "neutral",
}: {
  n: number;
  title: string;
  body: string;
  tone?: keyof typeof STEP_TONES;
}) {
  const c = STEP_TONES[tone];
  return (
    <div
      className="v2-rise"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "14px",
        background: "#fff",
        borderRadius: "var(--v2-radius-card)",
        boxShadow: "var(--v2-shadow-card)",
        padding: "16px",
        marginBottom: "12px",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          flexShrink: 0,
          borderRadius: "var(--v2-radius-md)",
          background: c.bg,
          color: c.ink,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-v2-display)",
          fontWeight: 800,
          fontSize: "18px",
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-v2-body)",
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--color-v2-ink-100)",
            marginBottom: "4px",
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "var(--font-v2-body)",
            fontSize: "14px",
            lineHeight: "1.5",
            color: "var(--color-v2-ink-300)",
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}
