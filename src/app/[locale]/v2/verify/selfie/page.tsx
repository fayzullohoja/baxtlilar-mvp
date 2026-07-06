/**
 * V3 Sprint 3 round 3 — Selfie verification (без «паспорта в кадре»).
 *
 * Изменения от учредителя (2026-06-29 тест-проход):
 * - Title: «Селфи с паспортом» → «Селфи для верификации»
 * - Description: без инструкции держать паспорт рядом с лицом
 *   (модератор сверяет селфи с уже загруженным фото паспорта отдельно)
 * - Добавлен визуальный пример как должно выглядеть селфи
 *
 * Existing API: /api/onboarding/selfie.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { UploadField } from "@/components/v2/UploadField";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function V2SelfiePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "selfie_upload");
  const t = await getTranslations('Verify');

  return (
    <MiniAppShell eyebrow={t('eyebrow')} align="top">
      <div className="v2-screen-in">
      <Headline size="lg" as="h1">
        {t('title')}
      </Headline>
      <Lead>
        {t('description')}
      </Lead>

      {/* Visual hint */}
      <div className="v2-rise" style={{ marginTop: "28px" }}>
        <SelfieVisualHint goodLabel={t('example_good')} badLabel={t('example_bad')} />
      </div>

      <div style={{ marginTop: "28px" }}>
        <Requirements
          title={t('requirements_title')}
          items={[t('req_1'), t('req_2'), t('req_3'), t('req_4')]}
        />
      </div>

      <div style={{ marginTop: "32px" }}>
        <UploadField
          endpoint="/api/onboarding/selfie"
          uploadLabel={t('upload_label')}
          capture="user"
        />
      </div>

      <div
        style={{
          marginTop: "28px",
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
        {t('footer_note')}
      </div>
      </div>
    </MiniAppShell>
  );
}

/** Визуальная подсказка: 2 примера (хорошо vs плохо) с SVG-силуэтами лица. */
function SelfieVisualHint({ goodLabel, badLabel }: { goodLabel: string; badLabel: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
      }}
    >
      <ExampleCard variant="good" label={goodLabel} />
      <ExampleCard variant="bad" label={badLabel} />
    </div>
  );
}

function ExampleCard({
  variant,
  label,
}: {
  variant: "good" | "bad";
  label: string;
}) {
  const isGood = variant === "good";
  const accent = isGood ? "#0d6b6f" : "#B5322B";
  const accentBg = isGood ? "#EAF7F6" : "#FBE7E4";
  const accentBorder = isGood
    ? "rgba(21, 154, 160, 0.25)"
    : "rgba(181, 50, 43, 0.25)";

  return (
    <div
      style={{
        background: accentBg,
        border: `1px solid ${accentBorder}`,
        borderRadius: "var(--v2-radius-md)",
        padding: "12px 10px 10px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          height: 84,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isGood ? <GoodFaceSvg /> : <BadFaceSvg />}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: "11px",
          fontWeight: 700,
          color: accent,
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function GoodFaceSvg() {
  return (
    <svg width="62" height="78" viewBox="0 0 62 78" fill="none">
      {/* Head outline */}
      <ellipse
        cx="31"
        cy="32"
        rx="18"
        ry="22"
        stroke="var(--color-v2-teal)"
        strokeWidth="1.6"
        fill="white"
      />
      {/* Eyes */}
      <circle cx="24" cy="30" r="1.6" fill="var(--color-v2-teal)" />
      <circle cx="38" cy="30" r="1.6" fill="var(--color-v2-teal)" />
      {/* Smile */}
      <path
        d="M24 39 Q31 44 38 39"
        stroke="var(--color-v2-teal)"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      {/* Shoulders */}
      <path
        d="M12 76 Q31 58 50 76"
        stroke="var(--color-v2-teal)"
        strokeWidth="1.6"
        fill="none"
      />
      {/* Checkmark badge */}
      <circle cx="50" cy="22" r="8" fill="var(--color-v2-teal)" />
      <path
        d="M46 22 L49 25 L54 19"
        stroke="white"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BadFaceSvg() {
  return (
    <svg width="62" height="78" viewBox="0 0 62 78" fill="none">
      {/* Head outline — slightly cropped */}
      <ellipse
        cx="31"
        cy="32"
        rx="18"
        ry="22"
        stroke="var(--color-v2-danger)"
        strokeWidth="1.6"
        fill="white"
      />
      {/* Mask/sunglasses bar */}
      <rect
        x="14"
        y="26"
        width="34"
        height="8"
        fill="var(--color-v2-danger)"
        rx="2"
      />
      {/* Mouth covered */}
      <rect x="20" y="38" width="22" height="6" fill="var(--color-v2-danger)" opacity="0.4" />
      {/* Shoulders */}
      <path
        d="M12 76 Q31 58 50 76"
        stroke="var(--color-v2-danger)"
        strokeWidth="1.6"
        fill="none"
      />
      {/* X badge */}
      <circle cx="50" cy="22" r="8" fill="var(--color-v2-danger)" />
      <path
        d="M46 18 L54 26 M54 18 L46 26"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Requirements({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "var(--color-v2-accent)",
          marginBottom: "10px",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        {title}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              fontFamily: "var(--font-v2-body)",
              fontSize: "14px",
              lineHeight: "1.55",
              color: "var(--color-v2-ink-200)",
              marginBottom: "8px",
              paddingLeft: "14px",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                top: "10px",
                width: "5px",
                height: "1px",
                background: "var(--color-v2-ink-300)",
              }}
            />
            <span dangerouslySetInnerHTML={{ __html: item }} />
          </li>
        ))}
      </ul>
    </div>
  );
}
