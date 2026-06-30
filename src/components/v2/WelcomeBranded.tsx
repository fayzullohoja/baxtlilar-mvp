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
  IconHeartHandshake,
} from "@tabler/icons-react";

/**
 * V3 Sprint 3 round 3 — Branded welcome (single screen).
 *
 * Заменяет 3-экранную editorial серию (mission/safety/rules) на одну
 * брендированную страницу с логотипом, языковым переключателем, иконками
 * фич и крупным CTA. Дизайн от учредителя (2026-06-29 тест-проход).
 *
 * V1 brand tokens: baxt-coral / baxt-pink-bg / baxt-navy.
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
      style={{
        minHeight: "100vh",
        background: "var(--color-baxt-pink-bg)",
        position: "relative",
        overflow: "hidden",
        padding: "0 24px 32px",
      }}
    >
      {/* Decorative pink hearts in background */}
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
          fontSize: "32px",
          fontWeight: 700,
          color: "var(--color-baxt-navy)",
          margin: "8px 0 12px",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
          color: "var(--color-baxt-navy)",
          margin: "0 0 6px",
          padding: "0 8px",
          fontWeight: 500,
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
          color: "var(--color-baxt-muted)",
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
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "8px 0",
          marginBottom: "20px",
          boxShadow: "0 2px 12px rgba(31, 58, 95, 0.06)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <FeatureRow
          icon={<IconShieldCheck size={22} stroke={2} />}
          title={t('feature_verified_title')}
          subtitle={t('feature_verified_subtitle')}
        />
        <Divider />
        <FeatureRow
          icon={<IconLock size={22} stroke={2} />}
          title={t('feature_privacy_title')}
          subtitle={t('feature_privacy_subtitle')}
        />
        <Divider />
        <FeatureRow
          icon={<IconUsers size={22} stroke={2} />}
          title={t('feature_respect_title')}
          subtitle={t('feature_respect_subtitle')}
        />
      </div>

      {/* CTA */}
      <button
        onClick={start}
        disabled={busy}
        style={{
          width: "100%",
          height: "56px",
          background: "var(--color-baxt-coral)",
          color: "white",
          border: 0,
          borderRadius: "999px",
          fontSize: "16px",
          fontWeight: 600,
          cursor: busy ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          boxShadow: "0 4px 14px rgba(226, 82, 107, 0.35)",
          marginBottom: "20px",
          position: "relative",
          zIndex: 1,
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "…" : t('start_registration')}
        {!busy ? <IconChevronRight size={20} stroke={2.5} /> : null}
      </button>

      {/* Bottom safety note */}
      <div
        style={{
          background: "white",
          borderRadius: "12px",
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
          style={{ color: "var(--color-baxt-coral)", flexShrink: 0, marginTop: 1 }}
        />
        <div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-baxt-navy)",
              marginBottom: "3px",
            }}
          >
            {t('safety_title')}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--color-baxt-muted)",
              lineHeight: 1.45,
            }}
          >
            {t('safety_subtitle')}
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div
        style={{
          textAlign: "center",
          fontSize: "11px",
          color: "var(--color-baxt-muted)",
          padding: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <IconHeartHandshake size={14} stroke={2} />
        {t('rules_footer')}
      </div>

      {err ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "rgba(180, 50, 50, 0.08)",
            border: "1px solid rgba(180, 50, 50, 0.3)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--color-baxt-coral-dk)",
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
        background: "var(--color-baxt-coral)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        boxShadow: "0 6px 20px rgba(226, 82, 107, 0.35)",
      }}
    >
      <span
        style={{
          fontSize: "44px",
          fontWeight: 800,
          color: "white",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
          background: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 6px rgba(31, 58, 95, 0.15)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-baxt-coral)">
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
  ];
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 24,
        display: "flex",
        gap: "4px",
        background: "white",
        padding: "4px",
        borderRadius: "999px",
        boxShadow: "0 2px 8px rgba(31, 58, 95, 0.08)",
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
            fontWeight: 600,
            background:
              current === l.code ? "var(--color-baxt-coral)" : "transparent",
            color:
              current === l.code ? "white" : "var(--color-baxt-muted)",
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
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
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
          borderRadius: "12px",
          background: "var(--color-baxt-coral-bg)",
          color: "var(--color-baxt-coral)",
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
            fontWeight: 600,
            color: "var(--color-baxt-navy)",
            marginBottom: "3px",
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--color-baxt-muted)",
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
        background: "var(--color-baxt-border)",
        opacity: 0.4,
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
      fill="var(--color-baxt-coral)"
      style={style}
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}
