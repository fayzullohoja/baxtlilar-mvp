import type { ReactNode } from "react";

/** Базовая обёртка экрана онбординга: бренд-карточка по центру. */
export function Screen({
  title,
  subtitle,
  children,
  footer,
  step,
  totalSteps,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  step?: number;
  totalSteps?: number;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm bg-baxt-card border border-baxt-border rounded-3xl shadow-sm p-7">
        {step && totalSteps ? (
          <div className="flex gap-1.5 mb-5" aria-label={`Шаг ${step} из ${totalSteps}`}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={
                  i < step
                    ? "h-1 flex-1 rounded-full bg-baxt-coral"
                    : "h-1 flex-1 rounded-full bg-baxt-border"
                }
              />
            ))}
          </div>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight mb-2">{title}</h1>
        {subtitle ? <p className="text-sm text-baxt-muted mb-6">{subtitle}</p> : null}
        {children}
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    </main>
  );
}

/** Основная коралловая кнопка. */
export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-full bg-baxt-coral hover:bg-baxt-coral-dk disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-full py-3 transition-colors"
    >
      {children}
    </button>
  );
}
