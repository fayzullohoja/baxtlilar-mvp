// OBS-1 — Next instrumentation hook. Регистрирует Sentry по runtime'у, но
// ТОЛЬКО если задан SENTRY_DSN (без него — полный no-op: DSN появится от
// учредителя, код уже готов). onRequestError обязателен в Next 16 App Router —
// иначе ошибки Server Components не доезжают.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Без инициализации (нет DSN) captureRequestError — безопасный no-op.
export const onRequestError = Sentry.captureRequestError;
