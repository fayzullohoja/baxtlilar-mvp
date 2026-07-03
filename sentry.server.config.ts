// OBS-1 — Sentry (Node runtime). Загружается из src/instrumentation.ts ТОЛЬКО
// при заданном SENTRY_DSN — без него весь observability-слой no-op.
import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability/scrub-event";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? "development",
  // Ошибки — главное; перфоманс-трейсы дозируем (OBS-9: <= 0.1).
  tracesSampleRate: 0.05,
  // КРИТИЧНО (PII): инстанс хранит паспорта/селфи. Автосбор PII выключен,
  // остальное дочищает scrub (куки, секретные заголовки, тела onboarding/admin/
  // storage/auth).
  sendDefaultPii: false,
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
});
