/**
 * V2 Headline — editorial-serif заголовки. Главный visual-приём концепта.
 *
 * Использовать вместо обычных <h1>/<h2>. Serif всегда, никаких bold sans.
 */

import type { ReactNode } from "react";

type Size = "xl" | "lg" | "md" | "sm";

type Props = {
  children: ReactNode;
  size?: Size;
  as?: "h1" | "h2" | "h3" | "div";
  className?: string;
  style?: React.CSSProperties;
};

const SIZE: Record<Size, { fontSize: string; lineHeight: string }> = {
  xl: { fontSize: "44px", lineHeight: "1.05" },
  lg: { fontSize: "32px", lineHeight: "1.1" },
  md: { fontSize: "24px", lineHeight: "1.2" },
  sm: { fontSize: "18px", lineHeight: "1.3" },
};

export function Headline({
  children,
  size = "lg",
  as: Tag = "h1",
  className = "",
  style,
}: Props) {
  const dims = SIZE[size];
  return (
    <Tag
      className={className}
      style={{
        fontFamily: "var(--font-v2-display)",
        fontWeight: 500,
        letterSpacing: "-0.02em",
        color: "var(--color-v2-ink-100)",
        ...dims,
        ...(style ?? {}),
      }}
    >
      {children}
    </Tag>
  );
}

/** Subtitle / body lead — sans, normal weight, ink-300. */
export function Lead({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <p
      className={className}
      style={{
        fontFamily: "var(--font-v2-body)",
        fontSize: "16px",
        lineHeight: "1.55",
        color: "var(--color-v2-ink-300)",
        marginTop: "12px",
        ...(style ?? {}),
      }}
    >
      {children}
    </p>
  );
}
