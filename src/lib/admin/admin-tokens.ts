// TS-зеркало CSS-переменных из [data-ops="true"] блока в globals.css.
// Используется в inline `style` где var() неудобен (например передача в SVG fill).
// Держать в sync с globals.css.

export const ADMIN = {
  bg: "#fafaf8",
  surface: "#ffffff",
  surface2: "#f4f3ef",
  border: "#e5e3dd",
  borderStrong: "#c9c5bb",

  ink900: "#0a0908",
  ink700: "#3a3833",
  ink500: "#6e6a60",
  ink300: "#a8a499",

  accent: "#2d4a5c",
  accentHover: "#3a5d72",
  accentSoft: "rgba(45, 74, 92, 0.08)",

  success: "#2f7a4e",
  warning: "#b8732a",
  danger: "#b8475e",
  info: "#4a6a8a",

  fontSans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontMono: '"JetBrains Mono", "SF Mono", Menlo, monospace',
} as const;
