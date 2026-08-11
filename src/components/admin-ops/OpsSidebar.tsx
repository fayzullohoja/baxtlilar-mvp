"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconLayoutDashboard,
  IconShieldCheck,
  IconPhoto,
  IconFlag,
  IconUsers,
  IconChartBar,
  IconHistory,
  IconUserShield,
  IconSettings,
  IconLanguage,
  IconTicket,
  IconLogout,
} from "@tabler/icons-react";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { can, type Permission } from "@/lib/admin/permissions";
import type { ComponentType } from "react";

type Item = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; stroke?: number }>;
  // Пункт виден, если у роли есть это право. Без perm — виден всем админам.
  perm?: Permission;
  badge?: number;
};
type Group = { label: string; items: Item[] };

// ЕДИНАЯ навигация: только реально существующие рабочие страницы (без 404).
// Видимость через capability-map (та же, что гейтит сами страницы) — sidebar не
// расходится с доступом. Жалобы теперь видны модератору (Волна 7).
const GROUPS: Group[] = [
  {
    label: "ОБЗОР",
    items: [{ href: "/admin", label: "Дашборд", icon: IconLayoutDashboard }],
  },
  {
    label: "МОДЕРАЦИЯ",
    items: [
      { href: "/admin/queue/mine", label: "Верификации", icon: IconShieldCheck },
      { href: "/admin/photos", label: "Фото", icon: IconPhoto },
      { href: "/admin/reports", label: "Жалобы", icon: IconFlag, perm: "reports.triage" },
    ],
  },
  {
    label: "РЕЕСТР",
    items: [
      { href: "/admin/clients", label: "Клиенты", icon: IconUsers, perm: "clients.directory" },
      { href: "/admin/invites", label: "Приглашения", icon: IconTicket, perm: "invites.manage" },
    ],
  },
  {
    label: "АНАЛИТИКА",
    items: [
      { href: "/admin/analytics", label: "Аналитика", icon: IconChartBar, perm: "analytics.view" },
      { href: "/admin/audit", label: "Журнал", icon: IconHistory, perm: "audit.viewAll" },
    ],
  },
  {
    label: "СИСТЕМА",
    items: [
      { href: "/admin/content", label: "Тексты", icon: IconLanguage, perm: "i18n.edit" },
      { href: "/admin/staff", label: "Персонал", icon: IconUserShield, perm: "staff.manage" },
      { href: "/admin/settings", label: "Настройки", icon: IconSettings, perm: "settings.edit" },
    ],
  },
];

export function OpsSidebar({
  adminName,
  adminRole,
}: {
  adminName: string;
  adminRole: "moderator" | "superadmin";
}) {
  const path = usePathname();
  const isActive = (href: string) => {
    const base = href.split("?")[0];
    // /admin (дашборд) — точное совпадение, иначе подсветится на всех под-роутах.
    if (base === "/admin") return path === "/admin";
    return path?.startsWith(base) ?? false;
  };

  return (
    <nav
      style={{
        width: 220,
        height: "100vh",
        flexShrink: 0,
        borderRight: `1px solid ${ADMIN.border}`,
        background: ADMIN.surface,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        position: "sticky",
        top: 0,
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${ADMIN.border}`,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-v2-display)",
            fontSize: 18,
            color: ADMIN.ink900,
            letterSpacing: "-0.02em",
          }}
        >
          Baxtlilar Ops
        </div>
      </div>

      <div style={{ flex: 1, padding: "12px 0" }}>
        {GROUPS.map((g) => {
          const visibleItems = g.items.filter(
            (i) => !i.perm || can(adminRole, i.perm),
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={g.label} style={{ marginBottom: 16 }}>
              <div
                style={{
                  padding: "4px 20px",
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  color: ADMIN.ink500,
                  textTransform: "uppercase",
                }}
              >
                {g.label}
              </div>
              {visibleItems.map((it) => {
                const active = isActive(it.href);
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 20px",
                      fontSize: 13,
                      color: active ? ADMIN.ink900 : ADMIN.ink700,
                      background: active ? ADMIN.accentSoft : "transparent",
                      borderLeft: `2px solid ${
                        active ? ADMIN.accent : "transparent"
                      }`,
                      textDecoration: "none",
                    }}
                  >
                    <Icon size={18} stroke={1.5} />
                    <span style={{ flex: 1 }}>{it.label}</span>
                    {it.badge ? (
                      <span style={{ fontSize: 11, color: ADMIN.ink500 }}>
                        {it.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      <div
        style={{
          padding: "12px 20px",
          borderTop: `1px solid ${ADMIN.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: ADMIN.surface2,
            color: ADMIN.ink700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          {adminName.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              color: ADMIN.ink900,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {adminName}
          </div>
          <div style={{ fontSize: 11, color: ADMIN.ink500 }}>{adminRole}</div>
        </div>
        <form action="/api/admin/logout" method="POST">
          <button
            type="submit"
            aria-label="Logout"
            style={{
              background: "transparent",
              border: 0,
              color: ADMIN.ink500,
              cursor: "pointer",
              padding: 4,
            }}
          >
            <IconLogout size={16} stroke={1.5} />
          </button>
        </form>
      </div>
    </nav>
  );
}
