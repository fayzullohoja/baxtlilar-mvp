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
      <Headline size="lg" as="h1">
        {t('headline')}
      </Headline>
      <Lead>
        {t('intro_description')}
      </Lead>

      <div
        style={{
          marginTop: "32px",
          paddingTop: "24px",
          borderTop: "1px solid var(--color-v2-ink-500)",
        }}
      >
        <Step n={1} title={t('step_1_title')} body={t('step_1_body')} />
        <Step n={2} title={t('step_2_title')} body={t('step_2_body')} />
        <Step n={3} title={t('step_3_title')} body={t('step_3_body')} />
      </div>

      <div
        style={{
          marginTop: "32px",
          paddingTop: "20px",
          borderTop: "1px solid var(--color-v2-ink-500)",
          fontSize: "12px",
          color: "var(--color-v2-ink-400)",
          fontFamily: "var(--font-v2-body)",
          lineHeight: "1.55",
        }}
      >
        {t('privacy_footer')}
      </div>
    </MiniAppShell>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div
        style={{
          fontFamily: "var(--font-v2-display)",
          fontSize: "13px",
          letterSpacing: "0.1em",
          color: "var(--color-v2-ink-400)",
          marginBottom: "4px",
        }}
      >
        {String(n).padStart(2, "0")}
      </div>
      <div
        style={{
          fontFamily: "var(--font-v2-body)",
          fontSize: "17px",
          fontWeight: 500,
          color: "var(--color-v2-ink-100)",
          marginBottom: "4px",
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
  );
}
