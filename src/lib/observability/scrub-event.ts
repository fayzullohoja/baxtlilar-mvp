/**
 * OBS-1 — PII-скраб Sentry-событий (server/edge). Инстанс держит паспорта и
 * селфи; в Sentry не должны уезжать: session-куки, кроновский/TG секреты и
 * тела чувствительных роутов. sendDefaultPii:false выключает автосбор, этот
 * скраб — страховка на случай явных attach'ей SDK.
 *
 * Без зависимостей от @sentry/* типов: событие структурно (request-поля),
 * чтобы юнит-тест не тянул SDK.
 */

const SENSITIVE_HEADERS = [
  "cookie",
  "set-cookie",
  "authorization",
  "x-cron-secret",
  "x-telegram-bot-api-secret-token",
];

// Тела этих роутов содержат документы/ПД/секреты — режем целиком.
const SENSITIVE_BODY_RE = /^\/api\/(onboarding|admin|storage|auth)(\/|$)/;

type ScrubbableEvent = {
  request?: {
    url?: string;
    cookies?: unknown;
    headers?: Record<string, string>;
    data?: unknown;
  };
};

export function scrubSentryEvent<E extends ScrubbableEvent>(event: E): E {
  const req = event.request;
  if (!req) return event;

  delete req.cookies;

  if (req.headers) {
    for (const h of Object.keys(req.headers)) {
      if (SENSITIVE_HEADERS.includes(h.toLowerCase())) delete req.headers[h];
    }
  }

  if (req.data !== undefined) {
    let sensitive = true; // fail-closed: не смогли разобрать url — тело не шлём
    if (req.url) {
      try {
        // без base: не-абсолютный/битый url кидает → остаёмся fail-closed
        sensitive = SENSITIVE_BODY_RE.test(new URL(req.url).pathname);
      } catch {
        sensitive = true;
      }
    }
    if (sensitive) delete req.data;
  }

  return event;
}
