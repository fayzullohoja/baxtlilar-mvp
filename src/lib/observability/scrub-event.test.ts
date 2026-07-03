import { describe, it, expect } from "vitest";
import { scrubSentryEvent } from "./scrub-event";

// OBS-1 — PII-скраб перед отправкой в Sentry: куки сессий, кроновские/TG
// секреты и тела чувствительных роутов (onboarding = паспорт/селфи, admin,
// storage, auth) не должны покидать инстанс.

type AnyEvent = {
  request?: {
    url?: string;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
    data?: unknown;
  };
};

function ev(over: AnyEvent["request"] = {}): AnyEvent {
  return {
    request: {
      url: "https://baxtlilar.uz/api/interest",
      cookies: { bx_session: "secret-cookie" },
      headers: {
        cookie: "bx_session=secret-cookie",
        "x-cron-secret": "cron-secret",
        "x-telegram-bot-api-secret-token": "tg-secret",
        authorization: "Bearer x",
        "user-agent": "Mozilla",
      },
      data: { receiver_id: "u-1" },
      ...over,
    },
  };
}

describe("scrubSentryEvent", () => {
  it("куки и секретные заголовки удаляются всегда", () => {
    const out = scrubSentryEvent(ev()) as AnyEvent;
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.headers?.cookie).toBeUndefined();
    expect(out.request?.headers?.["x-cron-secret"]).toBeUndefined();
    expect(out.request?.headers?.["x-telegram-bot-api-secret-token"]).toBeUndefined();
    expect(out.request?.headers?.authorization).toBeUndefined();
    // нейтральные заголовки остаются (диагностическая ценность)
    expect(out.request?.headers?.["user-agent"]).toBe("Mozilla");
  });

  it("тело чувствительного роута (onboarding/admin/storage/auth) удаляется", () => {
    for (const url of [
      "https://baxtlilar.uz/api/onboarding/selfie",
      "https://baxtlilar.uz/api/admin/clients/x/ban",
      "https://baxtlilar.uz/api/storage/o/abc",
      "https://baxtlilar.uz/api/auth/bootstrap",
    ]) {
      const out = scrubSentryEvent(ev({ url, data: { passport: "AB1234567" } })) as AnyEvent;
      expect(out.request?.data, url).toBeUndefined();
    }
  });

  it("тело нечувствительного роута остаётся", () => {
    const out = scrubSentryEvent(ev()) as AnyEvent;
    expect(out.request?.data).toEqual({ receiver_id: "u-1" });
  });

  it("событие без request проходит как есть", () => {
    const out = scrubSentryEvent({} as AnyEvent);
    expect(out).toEqual({});
  });

  it("кривой url не роняет скраб (fail-closed: тело удаляется)", () => {
    const out = scrubSentryEvent(ev({ url: "::not-a-url::" })) as AnyEvent;
    expect(out.request?.data).toBeUndefined();
  });
});
