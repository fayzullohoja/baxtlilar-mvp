"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const STYLES: Record<
  Variant,
  { bg: string; fg: string; border: string; hoverBg: string }
> = {
  primary: {
    bg: ADMIN.accent,
    fg: "#ffffff",
    border: ADMIN.accent,
    hoverBg: ADMIN.accentHover,
  },
  secondary: {
    bg: ADMIN.surface,
    fg: ADMIN.ink900,
    border: ADMIN.border,
    hoverBg: ADMIN.surface2,
  },
  danger: {
    bg: ADMIN.surface,
    fg: ADMIN.danger,
    border: ADMIN.danger,
    hoverBg: "#fcf0f3",
  },
  ghost: {
    bg: "transparent",
    fg: ADMIN.ink700,
    border: "transparent",
    hoverBg: ADMIN.surface2,
  },
};

export function Button({
  variant = "secondary",
  size = "md",
  children,
  style,
  ...rest
}: ButtonProps) {
  const s = STYLES[variant];
  const h = size === "sm" ? 28 : 32;
  return (
    <button
      {...rest}
      style={{
        height: h,
        padding: size === "sm" ? "0 10px" : "0 14px",
        fontFamily: ADMIN.fontSans,
        fontSize: 13,
        fontWeight: 500,
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        borderRadius: 6,
        cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.5 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        transition: "background 0.12s ease",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!rest.disabled) e.currentTarget.style.background = s.hoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = s.bg;
      }}
    >
      {children}
    </button>
  );
}
