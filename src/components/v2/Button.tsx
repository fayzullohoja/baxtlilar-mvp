/**
 * V2 Button — primary CTA + secondary / ghost / trust variants.
 *
 * V3 Visual DNA (Baxtlilar.dc.html): primary — гранатовый градиент с мягкой
 * тенью, weight 800, radius 18; secondary — белая с hairline-бортом; trust —
 * бирюзовый градиент (шаги верификации «дальше»); ghost — текстовая.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "trust";

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
    fontWeight: 800,
    letterSpacing: "-0.01em",
    padding: "17px 24px",
    borderRadius: "var(--v2-radius-lg)",
    border: "1.5px solid transparent",
    cursor: rest.disabled ? "not-allowed" : "pointer",
    transition: "background-color 0.15s ease, color 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease",
    width: fullWidth ? "100%" : "auto",
  };

  let variantStyles: React.CSSProperties = {};
  if (variant === "primary") {
    variantStyles = rest.disabled
      ? {
          background: "var(--color-v2-disabled-bg)",
          color: "var(--color-v2-disabled-ink)",
        }
      : {
          background: "var(--v2-grad-primary)",
          color: "#fff7f0",
          boxShadow: "var(--v2-shadow-cta)",
        };
  } else if (variant === "trust") {
    variantStyles = rest.disabled
      ? {
          background: "var(--color-v2-disabled-bg)",
          color: "var(--color-v2-disabled-ink)",
        }
      : {
          background: "var(--v2-grad-teal)",
          color: "#ffffff",
          boxShadow: "var(--v2-shadow-cta-teal)",
        };
  } else if (variant === "secondary") {
    variantStyles = {
      background: "#ffffff",
      color: "var(--color-v2-ink-400)",
      borderColor: "var(--color-v2-ink-500)",
      fontWeight: 700,
      opacity: rest.disabled ? 0.5 : 1,
    };
  } else if (variant === "ghost") {
    variantStyles = {
      background: "transparent",
      color: "var(--color-v2-ink-400)",
      fontWeight: 700,
      opacity: rest.disabled ? 0.5 : 1,
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
