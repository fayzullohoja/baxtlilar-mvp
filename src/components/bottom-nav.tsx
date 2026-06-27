"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * V2 BottomNav — editorial line-icons вместо эмодзи, токены v2 (бумага/чернила).
 * Активная вкладка — ink-100, неактивная — ink-400. Бейдж непрочитанных —
 * v2-accent.
 *
 * Маршруты ведут СРАЗУ на /v2/* (chats, settings), без захода на V1-redirect-
 * заглушки — убирает двойной редирект-хоп и мигание на каждом тапе (B2).
 */
const TABS = [
  { href: "/main", key: "feed" },
  { href: "/requests", key: "requests" },
  { href: "/v2/chats", key: "chats" },
  { href: "/v2/settings", key: "profile" },
] as const;

function Icon({ k }: { k: string }): ReactNode {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (k === "feed")
    return (
      <svg {...common} aria-hidden>
        <path d="M12 20s-6.5-4.35-9-8c-1.8-2.6.2-6 3.5-6 2 0 3.5 1.4 4.5 3 1-1.6 2.5-3 4.5-3 3.3 0 5.3 3.4 3.5 6-2.5 3.65-9 8-9 8z" />
      </svg>
    );
  if (k === "requests")
    return (
      <svg {...common} aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3.5 7.5l8.5 5.5 8.5-5.5" />
      </svg>
    );
  if (k === "chats")
    return (
      <svg {...common} aria-hidden>
        <path d="M21 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-5.4A8 8 0 1 1 21 11.5z" />
      </svg>
    );
  // profile
  return (
    <svg {...common} aria-hidden>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c0-3.8 3.4-5.8 7.5-5.8s7.5 2 7.5 5.8" />
    </svg>
  );
}

export function BottomNav({
  active,
  unread = 0,
}: {
  active: "feed" | "requests" | "chats" | "profile";
  unread?: number;
}) {
  const t = useTranslations("Nav");
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        marginLeft: "auto",
        marginRight: "auto",
        maxWidth: "var(--v2-max-width)",
        display: "flex",
        background: "var(--color-v2-paper)",
        borderTop: "1px solid var(--color-v2-border)",
        paddingBottom: "env(safe-area-inset-bottom)",
        fontFamily: "var(--font-v2-body)",
      }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "3px",
              padding: "9px 0 7px",
              fontSize: "11px",
              letterSpacing: "0.01em",
              color: isActive ? "var(--color-v2-ink-100)" : "var(--color-v2-ink-400)",
              textDecoration: "none",
            }}
          >
            <span style={{ position: "relative", lineHeight: 0 }}>
              <Icon k={tab.key} />
              {tab.key === "chats" && unread > 0 ? (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -7,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                    background: "var(--color-v2-accent)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </span>
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
