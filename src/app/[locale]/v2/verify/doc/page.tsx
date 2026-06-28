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

export const dynamic = "force-dynamic";

export default async function V2DocPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "doc_upload");

  return (
    <MiniAppShell eyebrow="Шаг 1 · Паспорт" align="top">
      <Headline size="lg" as="h1">
        Страница с&nbsp;фотографией.
      </Headline>
      <Lead>
        Сними страницу паспорта с твоим фото и&nbsp;подписью. Только её —
        не нужно показывать прописку или другие развороты.
      </Lead>

      {/* Visual hint */}
      <div style={{ marginTop: "28px" }}>
        <PassportVisualHint />
      </div>

      <div style={{ marginTop: "28px" }}>
        <Requirements />
      </div>

      <div style={{ marginTop: "32px" }}>
        <UploadField
          endpoint="/api/onboarding/document"
          uploadLabel="Сфотографировать или выбрать файл"
          capture="environment"
        />
      </div>

      <div
        style={{
          marginTop: "28px",
          paddingTop: "20px",
          borderTop: "1px solid var(--color-v2-ink-500)",
          fontSize: "12px",
          color: "var(--color-v2-ink-400)",
          fontFamily: "var(--font-v2-body)",
          lineHeight: "1.55",
        }}
      >
        Фото доступно только модератору и&nbsp;хранится в шифрованном
        хранилище. После одобрения профиля файл удаляется через 30 дней.
      </div>
    </MiniAppShell>
  );
}

/** Визуальная подсказка как должен выглядеть скан паспорта. */
function PassportVisualHint() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
      }}
    >
      <PassportExampleCard variant="good" label="Так — хорошо" />
      <PassportExampleCard variant="bad" label="Так — не пройдёт" />
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
  const accent = isGood ? "#2a6f4a" : "#b8362a";
  const accentBg = isGood ? "rgba(42, 111, 74, 0.06)" : "rgba(184, 54, 42, 0.06)";

  return (
    <div
      style={{
        background: accentBg,
        border: `1px solid ${accent}33`,
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
          fontWeight: 600,
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
        stroke="#2a6f4a"
        strokeWidth="1.6"
      />
      {/* Photo area */}
      <rect x="12" y="14" width="24" height="30" rx="2" fill="#2a6f4a" opacity="0.15" />
      <circle cx="24" cy="24" r="5" fill="#2a6f4a" opacity="0.5" />
      <path d="M16 38 Q24 32 32 38" stroke="#2a6f4a" strokeWidth="1.2" opacity="0.5" fill="none" />
      {/* Text lines */}
      <line x1="42" y1="16" x2="86" y2="16" stroke="#2a6f4a" strokeWidth="1.3" />
      <line x1="42" y1="22" x2="80" y2="22" stroke="#2a6f4a" strokeWidth="1.3" />
      <line x1="42" y1="28" x2="84" y2="28" stroke="#2a6f4a" strokeWidth="1.3" opacity="0.7" />
      <line x1="42" y1="34" x2="78" y2="34" stroke="#2a6f4a" strokeWidth="1.3" opacity="0.7" />
      {/* MRZ lines */}
      <line x1="12" y1="50" x2="88" y2="50" stroke="#2a6f4a" strokeWidth="1.3" opacity="0.6" />
      <line x1="12" y1="56" x2="88" y2="56" stroke="#2a6f4a" strokeWidth="1.3" opacity="0.6" />
      {/* Checkmark badge */}
      <circle cx="86" cy="8" r="7" fill="#2a6f4a" />
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
          stroke="#b8362a"
          strokeWidth="1.6"
        />
        {/* Glare */}
        <rect x="20" y="18" width="50" height="22" fill="#b8362a" opacity="0.25" />
        <line x1="14" y1="48" x2="74" y2="48" stroke="#b8362a" strokeWidth="1.2" opacity="0.5" />
      </g>
      {/* X badge */}
      <circle cx="86" cy="8" r="7" fill="#b8362a" />
      <path
        d="M83 5 L89 11 M89 5 L83 11"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Requirements() {
  const items = [
    "Лицо хорошо видно",
    "Резкий фокус — буквы читаются",
    "Без бликов и&nbsp;тени поперёк",
    "Без редактирования — без фильтров, рамок и&nbsp;обложек",
  ];
  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--color-v2-ink-400)",
          marginBottom: "10px",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        Требования
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
