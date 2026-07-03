// OBS-1 — Sentry (edge runtime: proxy.ts/middleware). Тот же скраб, что и на
// Node: события middleware несут заголовки запроса.
import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability/scrub-event";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? "development",
  tracesSampleRate: 0.05,
  sendDefaultPii: false,
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
});
