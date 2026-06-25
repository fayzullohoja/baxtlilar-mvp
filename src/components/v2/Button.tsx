/**
 * V2 Button — primary CTA + secondary / ghost variants.
 *
 * Один аметистовый акцент. Никаких градиентов / shadow-glow / confetti.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
  fullWidth?: boolean;
};

export function Button({
  children,
  variant = "primary",
  fullWidth = true,
  className = "",
  style,
  ...rest
}: Props) {
  const base: React.CSSProperties = {
    fontFamily: "var(--font-v2-body)",
    fontSize: "16px",
    fontWeight: 500,
    letterSpacing: "-0.01em",
    padding: "16px 24px",
    borderRadius: "var(--v2-radius-md)",
    border: "1px solid transparent",
    cursor: rest.disabled ? "not-allowed" : "pointer",
    opacity: rest.disabled ? 0.4 : 1,
    transition: "background-color 0.15s ease, color 0.15s ease, transform 0.1s ease",
    width: fullWidth ? "100%" : "auto",
  };

  let variantStyles: React.CSSProperties = {};
  if (variant === "primary") {
    variantStyles = {
      background: "var(--color-v2-ink-100)",
      color: "var(--color-v2-paper)",
    };
  } else if (variant === "secondary") {
    variantStyles = {
      background: "transparent",
      color: "var(--color-v2-ink-100)",
      borderColor: "var(--color-v2-ink-100)",
    };
  } else if (variant === "ghost") {
    variantStyles = {
      background: "transparent",
      color: "var(--color-v2-ink-300)",
    };
  }

  return (
    <button
      className={className}
      style={{ ...base, ...variantStyles, ...(style ?? {}) }}
      {...rest}
    >
      {children}
    </button>
  );
}
