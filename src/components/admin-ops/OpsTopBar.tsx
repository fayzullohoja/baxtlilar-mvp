"use client";
import Link from "next/link";
import { IconSearch } from "@tabler/icons-react";
import { ADMIN } from "@/lib/admin/admin-tokens";

// UX-DEADCTRL: раньше тут был disabled-«поиск» (⌘K «будет в Sprint 4») и мёртвый
// колокольчик уведомлений — оба выглядели интерактивными, но ничего не делали.
// Колокольчик убран; «поиск» стал реальной ссылкой на директорию (/admin/clients
// — там уже живой type-ahead с автофокусом). Для модератора страница редиректит
// на его очередь (graceful).
export function OpsTopBar() {
  return (
    <div
      style={{
        height: 48,
        flexShrink: 0,
        borderBottom: `1px solid ${ADMIN.border}`,
        background: ADMIN.surface,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
        position: "sticky",
        top: 0,
        zIndex: 5,
      }}
    >
      <Link
        href="/admin/clients"
        style={{
          flex: 1,
          maxWidth: 460,
          height: 32,
          background: ADMIN.bg,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 6,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: ADMIN.ink500,
          fontSize: 13,
          fontFamily: ADMIN.fontSans,
          textDecoration: "none",
        }}
      >
        <IconSearch size={14} stroke={1.5} />
        Найти клиента, кейс, ПИНФЛ…
      </Link>

      <div style={{ flex: 1 }} />
    </div>
  );
}
