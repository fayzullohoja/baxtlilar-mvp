"use client";
import { useEffect, type ReactNode } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { useFocusTrap } from "@/lib/admin/use-focus-trap";

/** Slide-over справа. Escape и клик по backdrop закрывают. */
export function Drawer({
  open,
  onClose,
  width = 480,
  children,
}: {
  open: boolean;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(open);

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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15,23,30,0.35)",
        }}
      />
      <div
        ref={trapRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        style={{
          position: "relative",
          width,
          maxWidth: "100%",
          background: ADMIN.surface,
          borderLeft: `1px solid ${ADMIN.border}`,
          boxShadow: "-12px 0 32px rgba(15,23,30,0.12)",
          overflowY: "auto",
          outline: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
