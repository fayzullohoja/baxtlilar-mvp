"use client";

import { useEffect, type ReactNode } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  width?: number;
};

export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  width = 480,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15, 23, 30, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: `${width}px`,
          maxWidth: "100%",
          background: ADMIN.surface,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          boxShadow: "0 12px 32px rgba(15,23,30,0.18)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${ADMIN.border}`,
            fontSize: 15,
            fontWeight: 500,
            color: ADMIN.ink900,
          }}
        >
          {title}
        </div>
        <div
          style={{
            padding: "16px 20px",
            color: ADMIN.ink700,
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          {children}
        </div>
        <div
          style={{
            padding: "12px 20px",
            borderTop: `1px solid ${ADMIN.border}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          {actions}
        </div>
      </div>
    </div>
  );
}
