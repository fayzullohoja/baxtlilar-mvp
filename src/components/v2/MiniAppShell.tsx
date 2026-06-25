/**
 * V2 MiniAppShell — top-level wrapper для всех V2 экранов мини-аппы.
 *
 * Editorial Premium DNA:
 *   - off-white paper фон
 *   - щедрый whitespace
 *   - one object per screen (центрирование, max-width 420px)
 *   - serif headlines + sans body
 *
 * Применяется ко всем `/v2/*` страницам через layout.tsx или прямо в page.tsx.
 */

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Если задан — рендерится мелким моноширинным шрифтом сверху (контекст шага) */
  eyebrow?: string;
  /** Footer как правило содержит CTA-кнопку */
  footer?: ReactNode;
  /** Прижать контент сверху (default: center) */
  align?: "top" | "center";
};

export function MiniAppShell({
  children,
  eyebrow,
  footer,
  align = "center",
}: Props) {
  return (
    <div
      data-v2="true"
      className="min-h-screen flex flex-col"
      style={{
        background: "var(--color-v2-paper)",
        color: "var(--color-v2-ink-100)",
        fontFamily: "var(--font-v2-body)",
      }}
    >
      <main
        className={`flex-1 flex flex-col ${
          align === "center" ? "justify-center" : "justify-start pt-12"
        }`}
        style={{
          maxWidth: "var(--v2-max-width)",
          width: "100%",
          margin: "0 auto",
          padding: "0 var(--v2-screen-padding)",
        }}
      >
        {eyebrow ? (
          <div
            className="mb-6 text-[11px] uppercase tracking-[0.12em]"
            style={{
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-mono)",
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        {children}
      </main>
      {footer ? (
        <div
          style={{
            maxWidth: "var(--v2-max-width)",
            width: "100%",
            margin: "0 auto",
            padding: "24px var(--v2-screen-padding) 32px",
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
