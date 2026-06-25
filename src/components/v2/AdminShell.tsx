/**
 * V2 AdminShell — editorial sidebar layout для админ-панели.
 *
 * Источник: Blueprint §4.0 «Общие принципы».
 *
 * DNA: широкий sidebar slate-100 фон + light-paper main. Serif заголовки,
 * sans nav. Без bright accents — только ink для active state.
 */

import Link from "next/link";
import { LogoutButton } from "../admin/logout-button";

const NAV: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "Дашборд" },
  { href: "/admin/verifications", label: "Верификация" },
  { href: "/admin/photos", label: "Фото" },
  { href: "/admin/reports", label: "Жалобы" },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/analytics", label: "Демография" },
  { href: "/admin/audit", label: "Журнал" },
];

const SIDEBAR_BG = "#0f1417";
const SIDEBAR_FG = "#e6e2db";
const SIDEBAR_MUTED = "#7a7672";
const ACCENT = "#d4c8b3";

export function V2AdminShell({
  children,
  active,
  role,
}: {
  children: React.ReactNode;
  active: string;
  role?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "var(--font-v2-body)",
        background: "var(--color-v2-paper)",
        color: "var(--color-v2-ink-100)",
      }}
    >
      <aside
        style={{
          width: "260px",
          flexShrink: 0,
          background: SIDEBAR_BG,
          color: SIDEBAR_FG,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "32px 28px 24px",
            borderBottom: `1px solid rgba(230, 226, 219, 0.08)`,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-v2-display)",
              fontSize: "20px",
              letterSpacing: "-0.01em",
              color: "#fff",
            }}
          >
            Baxtlilar
          </div>
          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: SIDEBAR_MUTED,
              marginTop: "4px",
            }}
          >
            Админ-панель
          </div>
        </div>

        <nav style={{ flex: 1, padding: "16px 0" }}>
          {NAV.map((n) => {
            const isActive = active === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                style={{
                  display: "block",
                  padding: "10px 28px",
                  fontSize: "14px",
                  color: isActive ? "#fff" : SIDEBAR_FG,
                  background: isActive ? "rgba(212, 200, 179, 0.08)" : "transparent",
                  borderLeft: `2px solid ${isActive ? ACCENT : "transparent"}`,
                  textDecoration: "none",
                  fontWeight: isActive ? 500 : 400,
                  transition: "background 0.12s ease",
                }}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div
          style={{
            padding: "16px 28px 24px",
            borderTop: `1px solid rgba(230, 226, 219, 0.08)`,
            fontSize: "11px",
            color: SIDEBAR_MUTED,
          }}
        >
          <div style={{ marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Роль · {role ?? "—"}
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: "48px 56px",
          overflow: "auto",
        }}
      >
        {children}
      </main>
    </div>
  );
}

/**
 * Headline H1 для admin страниц — editorial serif.
 */
export function AdminH1({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <header style={{ marginBottom: "40px" }}>
      <h1
        style={{
          fontFamily: "var(--font-v2-display)",
          fontSize: "36px",
          lineHeight: "1.1",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: "var(--color-v2-ink-100)",
          margin: 0,
        }}
      >
        {children}
      </h1>
      {subtitle ? (
        <p
          style={{
            marginTop: "10px",
            fontSize: "15px",
            color: "var(--color-v2-ink-300)",
            fontFamily: "var(--font-v2-body)",
            lineHeight: "1.55",
            maxWidth: "640px",
          }}
        >
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

/** Card-метрика для дашборда. */
export function MetricCard({
  href,
  label,
  value,
  accent,
}: {
  href: string;
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "28px 24px",
        background: "var(--color-v2-paper)",
        border: `1px solid ${accent ? "var(--color-v2-ink-300)" : "var(--color-v2-ink-500)"}`,
        borderRadius: "var(--v2-radius-md)",
        textDecoration: "none",
        color: "inherit",
        transition: "border-color 0.12s ease, background 0.12s ease",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-v2-display)",
          fontSize: "36px",
          lineHeight: "1",
          fontWeight: 500,
          color: "var(--color-v2-ink-100)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: "10px",
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--color-v2-ink-400)",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        {label}
      </div>
    </Link>
  );
}
