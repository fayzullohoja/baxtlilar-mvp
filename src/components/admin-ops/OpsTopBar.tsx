"use client";
import { IconCommand, IconBell } from "@tabler/icons-react";
import { ADMIN } from "@/lib/admin/admin-tokens";

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
      <button
        type="button"
        disabled
        title="Cmd+K — будет в Sprint 4"
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
          cursor: "not-allowed",
        }}
      >
        <IconCommand size={14} stroke={1.5} />
        Найти клиента, кейс, ПИНФЛ…
        <span style={{ marginLeft: "auto", fontSize: 11, color: ADMIN.ink300 }}>
          ⌘K
        </span>
      </button>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        disabled
        aria-label="Notifications"
        style={{
          background: "transparent",
          border: 0,
          color: ADMIN.ink500,
          cursor: "not-allowed",
          padding: 6,
        }}
      >
        <IconBell size={18} stroke={1.5} />
      </button>
    </div>
  );
}
