"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  IconShieldCheck,
  IconLock,
  IconUsers,
  IconChevronRight,
  IconShieldLock,
} from "@tabler/icons-react";

/**
 * V3 Sprint 3 round 3 — Branded welcome (single screen).
 *
 * Заменяет 3-экранную editorial серию (mission/safety/rules) на одну
 * брендированную страницу с логотипом, языковым переключателем, иконками
 * фич и крупным CTA. Дизайн от учредителя (2026-06-29 тест-проход).
 *
 * V4 «Живой Baxtlilar» (Baxtlilar.dc.html): hero-градиент на весь экран,
 * кремовый serif-заголовок, белая карточка фич, кремовый CTA.
 */
export function WelcomeBranded({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations('Welcome');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/onboarding/welcome", { method: "POST" });
      const d = (await r.json()) as { ok: boolean; next?: string; error?: string };
      if (d.ok && d.next) {
        router.replace(d.next);
        return;
      }
      setErr(d.error ?? "failed");
    } catch {
      setErr("network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      data-v2="true"
      className="v2-screen-in"
      style={{
        minHeight: "100vh",
        background: "var(--v2-grad-hero)",
        position: "relative",
        overflow: "hidden",
        padding: "0 24px 32px",
      }}
    >
      {/* Decorative cream hearts in background */}
      <DecorativeHearts />

      {/* Language switcher */}
      <LanguageSwitcher current={locale} />

      {/* Logo */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: "44px",
          marginBottom: "16px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Logo />
      </div>

      {/* Brand title */}
      <h1
        style={{
          textAlign: "center",
          fontSize: "34px",
          color: "#FFF7F0",
          margin: "8px 0 12px",
          letterSpacing: "-0.02em",
          position: "relative",
          zIndex: 1,
        }}
      >
        Baxtlilar
      </h1>

      <p
        style={{
          textAlign: "center",
          fontSize: "14px",
          color: "#FFF7F0",
          margin: "0 0 6px",
          padding: "0 8px",
          fontWeight: 600,
          lineHeight: 1.45,
          position: "relative",
          zIndex: 1,
        }}
      >
        {t('subtitle')}
      </p>

      <p
        style={{
          textAlign: "center",
          fontSize: "13px",
          color: "rgba(255, 247, 240, 0.85)",
          margin: "10px 0 28px",
          padding: "0 16px",
          lineHeight: 1.5,
          position: "relative",
          zIndex: 1,
        }}
      >
        {t('tagline')}
      </p>

      {/* Features list */}
      <div
        className="v2-rise"
        style={{
          background: "#fff",
          borderRadius: "var(--v2-radius-card)",
          padding: "8px 0",
          marginBottom: "20px",
          boxShadow: "var(--v2-shadow-card-lg)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <FeatureRow
          icon={<IconShieldCheck size={22} stroke={2} />}
          title={t('feature_verified_title')}
          subtitle={t('feature_verified_subtitle')}
          tone="teal"
        />
        <Divider />
        <FeatureRow
          icon={<IconLock size={22} stroke={2} />}
          title={t('feature_privacy_title')}
          subtitle={t('feature_privacy_subtitle')}
          tone="teal"
        />
        <Divider />
        <FeatureRow
          icon={<IconUsers size={22} stroke={2} />}
          title={t('feature_respect_title')}
          subtitle={t('feature_respect_subtitle')}
          tone="amber"
        />
      </div>

      {/* CTA */}
      <button
        onClick={start}
        disabled={busy}
        style={{
          width: "100%",
          height: "56px",
          background: "#FFF7F0",
          color: "var(--color-v2-accent)",
          border: 0,
          borderRadius: "var(--v2-radius-lg)",
          fontSize: "16px",
          fontWeight: 800,
          letterSpacing: "-0.01em",
          cursor: busy ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          boxShadow: "0 10px 24px rgba(42, 26, 46, 0.28)",
          marginBottom: "20px",
          position: "relative",
          zIndex: 1,
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "…" : t('start_registration')}
        {!busy ? <IconChevronRight size={20} stroke={2.5} /> : null}
      </button>

      {/* Bottom safety note — teal privacy plate */}
      <div
        style={{
          background: "var(--color-v2-chip-teal)",
          borderRadius: "14px",
          padding: "14px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          marginBottom: "14px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <IconShieldLock
          size={20}
          stroke={2}
          style={{ color: "var(--color-v2-teal)", flexShrink: 0, marginTop: 1 }}
        />
        <div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--color-v2-chip-teal-ink)",
              marginBottom: "3px",
            }}
          >
            {t('safety_title')}
          </div>
          <div
            style={{
              fontSize: "11.5px",
              fontWeight: 600,
              color: "var(--color-v2-chip-teal-ink)",
              opacity: 0.85,
              lineHeight: 1.45,
            }}
          >
            {t('safety_subtitle')}
          </div>
        </div>
      </div>

      {/* Footer note удалён (ревью оунера): к welcome-экрану юзер приходит уже
          ПОСЛЕ принятия оферты/согласий в боте — «rules_footer» был избыточен. */}

      {err ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "#FBE7E4",
            borderLeft: "3px solid var(--color-v2-danger)",
            borderRadius: 12,
            fontSize: 12,
            color: "#9A4B46",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {t('error_transition')}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function Logo() {
  return (
    <div
      style={{
        width: 88,
        height: 88,
        borderRadius: "50%",
        background: "var(--v2-grad-brand)",
        border: "3px solid rgba(255, 247, 240, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        boxShadow: "0 10px 26px rgba(42, 26, 46, 0.3)",
      }}
    >
      <span
        style={{
          fontSize: "44px",
          fontWeight: 800,
          color: "#FFF7F0",
          fontFamily: "var(--font-v2-display)",
          lineHeight: 1,
        }}
      >
        B
      </span>
      {/* Small heart in corner */}
      <div
        style={{
          position: "absolute",
          bottom: -2,
          right: -2,
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "#FFF7F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 6px rgba(42, 26, 46, 0.25)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-v2-accent)">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </div>
    </div>
  );
}

function LanguageSwitcher({ current }: { current: string }) {
  const langs = [
    { code: "ru", label: "RU" },
    { code: "uz", label: "UZ" },
    { code: "tr", label: "TR" },
  ];
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 24,
        display: "flex",
        gap: "4px",
        background: "#FFF7F0",
        padding: "4px",
        borderRadius: "999px",
        boxShadow: "0 2px 8px rgba(42, 26, 46, 0.18)",
        zIndex: 2,
      }}
    >
      {langs.map((l) => (
        <Link
          key={l.code}
          href="/v2/welcome"
          locale={l.code}
          style={{
            padding: "6px 12px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 700,
            background:
              current === l.code ? "var(--color-v2-accent)" : "transparent",
            color:
              current === l.code ? "#FFF7F0" : "var(--color-v2-ink-400)",
            textDecoration: "none",
            letterSpacing: "0.04em",
            transition: "all 0.15s ease",
          }}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

function FeatureRow({
  icon,
  title,
  subtitle,
  tone = "teal",
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone?: "teal" | "amber";
}) {
  const tileBg =
    tone === "amber" ? "var(--color-v2-chip-amber)" : "var(--color-v2-chip-teal)";
  const tileInk =
    tone === "amber"
      ? "var(--color-v2-chip-amber-ink)"
      : "var(--color-v2-chip-teal-ink)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--v2-radius-md)",
          background: tileBg,
          color: tileInk,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "var(--color-v2-ink-100)",
            marginBottom: "3px",
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--color-v2-ink-400)",
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        marginLeft: "76px",
        marginRight: "18px",
        height: 1,
        background: "var(--color-v2-border)",
      }}
    />
  );
}

function DecorativeHearts() {
  return (
    <>
      <DeoHeart top={64} left={20} opacity={0.18} size={22} />
      <DeoHeart top={180} left={-12} opacity={0.12} size={36} />
      <DeoHeart top={90} left={null} right={-10} opacity={0.14} size={32} />
      <DeoHeart top={300} left={null} right={16} opacity={0.16} size={20} />
    </>
  );
}

function DeoHeart({
  top,
  left,
  right,
  opacity,
  size,
}: {
  top: number;
  left?: number | null;
  right?: number;
  opacity: number;
  size: number;
}) {
  const style: React.CSSProperties = {
    position: "absolute",
    top,
    opacity,
    pointerEvents: "none",
  };
  if (left !== undefined && left !== null) style.left = left;
  if (right !== undefined) style.right = right;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="#FFF7F0"
      style={style}
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}
