/**
 * V2 Document Upload (Blueprint §3.2 A4).
 *
 * Editorial passport upload. Camera-first для mobile (back camera).
 * Existing API: /api/onboarding/document.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { UploadField } from "@/components/v2/UploadField";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function V2DocPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "doc_upload");
  const t = await getTranslations("Verify");

  return (
    <MiniAppShell eyebrow={t('step_eyebrow')} align="top">
      <div className="v2-screen-in">
      <Headline size="lg" as="h1">
        {t('page_title')}
      </Headline>
      <Lead>{t('page_description')}</Lead>

      {/* Visual hint */}
      <div className="v2-rise" style={{ marginTop: "28px" }}>
        <PassportVisualHint goodLabel={t('good_example')} badLabel={t('bad_example')} />
      </div>

      <div style={{ marginTop: "28px" }}>
        <Requirements
          title={t('requirements_title')}
          items={[t('req_face'), t('req_focus'), t('req_glare'), t('req_no_editing')]}
        />
      </div>

      <div style={{ marginTop: "32px" }}>
        {/* Без capture — документ можно выбрать из галереи/файлов ИЛИ снять камерой
            (нативный пикер даёт выбор). Форс-камера убрана по запросу оунера. */}
        <UploadField
          endpoint="/api/onboarding/document"
          uploadLabel={t('upload_label')}
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
        {t('privacy_footer')}
      </div>
      </div>
    </MiniAppShell>
  );
}

/** Визуальная подсказка как должен выглядеть скан паспорта. */
function PassportVisualHint({ goodLabel, badLabel }: { goodLabel: string; badLabel: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
      }}
    >
      <PassportExampleCard variant="good" label={goodLabel} />
      <PassportExampleCard variant="bad" label={badLabel} />
    </div>
  );
}

function PassportExampleCard({
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
        {isGood ? <GoodPassportSvg /> : <BadPassportSvg />}
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

function GoodPassportSvg() {
  return (
    <svg width="100" height="68" viewBox="0 0 100 68" fill="none">
      {/* Passport page */}
      <rect
        x="6"
        y="6"
        width="88"
        height="56"
        rx="4"
        fill="white"
        stroke="var(--color-v2-teal)"
        strokeWidth="1.6"
      />
      {/* Photo area */}
      <rect x="12" y="14" width="24" height="30" rx="2" fill="var(--color-v2-teal)" opacity="0.15" />
      <circle cx="24" cy="24" r="5" fill="var(--color-v2-teal)" opacity="0.5" />
      <path d="M16 38 Q24 32 32 38" stroke="var(--color-v2-teal)" strokeWidth="1.2" opacity="0.5" fill="none" />
      {/* Text lines */}
      <line x1="42" y1="16" x2="86" y2="16" stroke="var(--color-v2-teal)" strokeWidth="1.3" />
      <line x1="42" y1="22" x2="80" y2="22" stroke="var(--color-v2-teal)" strokeWidth="1.3" />
      <line x1="42" y1="28" x2="84" y2="28" stroke="var(--color-v2-teal)" strokeWidth="1.3" opacity="0.7" />
      <line x1="42" y1="34" x2="78" y2="34" stroke="var(--color-v2-teal)" strokeWidth="1.3" opacity="0.7" />
      {/* MRZ lines */}
      <line x1="12" y1="50" x2="88" y2="50" stroke="var(--color-v2-teal)" strokeWidth="1.3" opacity="0.6" />
      <line x1="12" y1="56" x2="88" y2="56" stroke="var(--color-v2-teal)" strokeWidth="1.3" opacity="0.6" />
      {/* Checkmark badge */}
      <circle cx="86" cy="8" r="7" fill="var(--color-v2-teal)" />
      <path
        d="M83 8 L85.5 10.5 L89 6.5"
        stroke="white"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BadPassportSvg() {
  return (
    <svg width="100" height="68" viewBox="0 0 100 68" fill="none">
      {/* Passport page — tilted + cropped */}
      <g transform="rotate(-12 50 34)">
        <rect
          x="6"
          y="10"
          width="80"
          height="50"
          rx="4"
          fill="white"
          stroke="var(--color-v2-danger)"
          strokeWidth="1.6"
        />
        {/* Glare */}
        <rect x="20" y="18" width="50" height="22" fill="var(--color-v2-danger)" opacity="0.25" />
        <line x1="14" y1="48" x2="74" y2="48" stroke="var(--color-v2-danger)" strokeWidth="1.2" opacity="0.5" />
      </g>
      {/* X badge */}
      <circle cx="86" cy="8" r="7" fill="var(--color-v2-danger)" />
      <path
        d="M83 5 L89 11 M89 5 L83 11"
        stroke="white"
        strokeWidth="1.6"
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
