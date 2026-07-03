import { describe, it, expect, beforeEach } from "vitest";
import {
  TokenBucketLimiter,
  classifyPath,
  checkRateLimit,
  resetRateLimitersForTests,
} from "./rate-limit";

// SEC-3a — глобальный rate-limit: token-bucket per-IP + per-session,
// жёсткое ведро на bootstrap, health/webhook/cron/storage исключены.

describe("TokenBucketLimiter", () => {
  it("burst до capacity проходит, capacity+1 — нет", () => {
    const l = new TokenBucketLimiter({ capacity: 3, refillPerSec: 1 });
    const t = 1_000_000;
    expect(l.take("k", t)).toBe(true);
    expect(l.take("k", t)).toBe(true);
    expect(l.take("k", t)).toBe(true);
    expect(l.take("k", t)).toBe(false);
  });

  it("токены восстанавливаются со временем", () => {
    const l = new TokenBucketLimiter({ capacity: 2, refillPerSec: 1 });
    const t = 1_000_000;
    l.take("k", t);
    l.take("k", t);
    expect(l.take("k", t)).toBe(false);
    // через 1.5с — ровно один токен
    expect(l.take("k", t + 1_500)).toBe(true);
    expect(l.take("k", t + 1_500)).toBe(false);
  });

  it("токены не накапливаются выше capacity", () => {
    const l = new TokenBucketLimiter({ capacity: 2, refillPerSec: 10 });
    const t = 1_000_000;
    // долгий простой не даёт больше 2 токенов
    expect(l.take("k", t + 60_000)).toBe(true);
    expect(l.take("k", t + 60_000)).toBe(true);
    expect(l.take("k", t + 60_000)).toBe(false);
  });

  it("ключи независимы", () => {
    const l = new TokenBucketLimiter({ capacity: 1, refillPerSec: 0.1 });
    const t = 1_000_000;
    expect(l.take("a", t)).toBe(true);
    expect(l.take("b", t)).toBe(true);
    expect(l.take("a", t)).toBe(false);
  });

  it("переполнение карты ключей не растёт бесконечно (sweep)", () => {
    const l = new TokenBucketLimiter({ capacity: 1, refillPerSec: 100 }, 100);
    const t = 1_000_000;
    for (let i = 0; i < 500; i++) l.take(`k${i}`, t + i);
    expect(l.size).toBeLessThanOrEqual(100);
  });
});

describe("classifyPath", () => {
  it("health/webhook/cron/storage — exempt", () => {
    expect(classifyPath("/api/health")).toBe("exempt");
    expect(classifyPath("/api/telegram/webhook")).toBe("exempt");
    expect(classifyPath("/api/cron/tg-outbox")).toBe("exempt");
    expect(classifyPath("/api/storage/o/abc.jpg")).toBe("exempt");
  });

  it("bootstrap — своё жёсткое ведро", () => {
    expect(classifyPath("/api/auth/bootstrap")).toBe("bootstrap");
  });

  it("остальной /api — api, страницы — page", () => {
    expect(classifyPath("/api/interest")).toBe("api");
    expect(classifyPath("/api/chats/x/stream")).toBe("api");
    expect(classifyPath("/ru/main")).toBe("page");
    expect(classifyPath("/admin/cases")).toBe("page");
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimitersForTests());

  it("exempt-пути никогда не лимитируются", () => {
    const t = 1_000_000;
    for (let i = 0; i < 500; i++) {
      const d = checkRateLimit(
        { pathname: "/api/health", ip: "1.2.3.4", sessionValue: null },
        t + i,
      );
      expect(d.allowed).toBe(true);
    }
  });

  it("bootstrap: 30 burst с одного IP, дальше 429 + retryAfter", () => {
    const t = 1_000_000;
    for (let i = 0; i < 30; i++) {
      expect(
        checkRateLimit({ pathname: "/api/auth/bootstrap", ip: "1.2.3.4", sessionValue: null }, t)
          .allowed,
      ).toBe(true);
    }
    const d = checkRateLimit(
      { pathname: "/api/auth/bootstrap", ip: "1.2.3.4", sessionValue: null },
      t,
    );
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.retryAfterSec).toBeGreaterThan(0);
  });

  it("bootstrap: другой IP не задет", () => {
    const t = 1_000_000;
    for (let i = 0; i < 40; i++)
      checkRateLimit({ pathname: "/api/auth/bootstrap", ip: "1.2.3.4", sessionValue: null }, t);
    expect(
      checkRateLimit({ pathname: "/api/auth/bootstrap", ip: "5.6.7.8", sessionValue: null }, t)
        .allowed,
    ).toBe(true);
  });

  it("чат-поллинг 1.5с (0.67 rps) на одной сессии НЕ ловит 429 длительно", () => {
    let t = 1_000_000;
    for (let i = 0; i < 1_000; i++) {
      const d = checkRateLimit(
        { pathname: "/api/chats/abc/messages", ip: "1.2.3.4", sessionValue: "sess-1" },
        t,
      );
      expect(d.allowed).toBe(true);
      t += 1_500;
    }
  });

  it("сессия, молотящая без пауз, упирается в session-ведро (IP не виноват)", () => {
    const t = 1_000_000;
    let blocked = 0;
    for (let i = 0; i < 200; i++) {
      const d = checkRateLimit(
        { pathname: "/api/interest", ip: "1.2.3.4", sessionValue: "sess-hot" },
        t,
      );
      if (!d.allowed) blocked++;
    }
    expect(blocked).toBeGreaterThan(0);
    // другая сессия с ТОГО ЖЕ IP (CGNAT) продолжает работать
    expect(
      checkRateLimit({ pathname: "/api/interest", ip: "1.2.3.4", sessionValue: "sess-2" }, t)
        .allowed,
    ).toBe(true);
  });

  it("анонимный флуд по /api без сессии режется IP-ведром", () => {
    const t = 1_000_000;
    let blocked = 0;
    for (let i = 0; i < 2_000; i++) {
      const d = checkRateLimit(
        { pathname: "/api/interest", ip: "9.9.9.9", sessionValue: null },
        t,
      );
      if (!d.allowed) blocked++;
    }
    expect(blocked).toBeGreaterThan(0);
  });
});
