// OBS-1/9 — Sentry на клиенте (TG WebView). Гейт: NEXT_PUBLIC_SENTRY_DSN.
// CSP отдаёт connect-src 'self', поэтому события идут НЕ на *.ingest.sentry.io,
// а через same-origin tunnel /monitoring (rewrite создаёт withSentryConfig в
// next.config.ts). CSP не расширяем.
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tunnel: "/monitoring",
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
  });
}

// Требование @sentry/nextjs v10 для навигационных спанов App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
