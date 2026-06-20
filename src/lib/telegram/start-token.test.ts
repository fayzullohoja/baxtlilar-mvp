import { describe, it, expect, beforeAll } from "vitest";
import { signStartToken, verifyStartToken } from "./start-token";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-session-secret-must-be-at-least-32-chars-long";
  process.env.DATABASE_URL = "postgres://test";
  process.env.TELEGRAM_BOT_TOKEN = "test-bot-token-1234567890";
});

const UID = "11111111-1111-1111-1111-111111111111";
const TG = 123456789;

describe("start-token", () => {
  it("signs and verifies a fresh token; returns uid+tg+jti", () => {
    const now = 1_700_000_000;
    const t = signStartToken(UID, TG, now);
    const got = verifyStartToken(t, now);
    expect(got?.uid).toBe(UID);
    expect(got?.tg).toBe(TG);
    expect(typeof got?.jti).toBe("string");
    expect(got?.jti?.length).toBeGreaterThan(0);
  });

  it("rejects token after TTL", () => {
    const now = 1_700_000_000;
    const t = signStartToken(UID, TG, now);
    expect(verifyStartToken(t, now + 601)).toBeNull();
    expect(verifyStartToken(t, now + 600)).not.toBeNull();
  });

  it("rejects token with tampered payload", () => {
    const now = 1_700_000_000;
    const t = signStartToken(UID, TG, now);
    const sig = t.split(".")[1];
    const fakePayload = Buffer.from(
      JSON.stringify({ uid: "evil", tg: TG, jti: "x", iat: now }),
      "utf8",
    ).toString("base64url");
    const tampered = `${fakePayload}.${sig}`;
    expect(verifyStartToken(tampered, now)).toBeNull();
  });

  it("rejects token with tampered signature", () => {
    const now = 1_700_000_000;
    const t = signStartToken(UID, TG, now);
    const tampered = t.slice(0, -2) + "AA";
    expect(verifyStartToken(tampered, now)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyStartToken("")).toBeNull();
    expect(verifyStartToken(null)).toBeNull();
    expect(verifyStartToken("no-dot")).toBeNull();
    expect(verifyStartToken(".sig")).toBeNull();
    expect(verifyStartToken("pl.")).toBeNull();
  });

  it("rejects token from future (clock-skew sanity)", () => {
    const now = 1_700_000_000;
    const t = signStartToken(UID, TG, now + 60);
    expect(verifyStartToken(t, now)).toBeNull();
  });

  it("two tokens for same uid+tg have distinct jti", () => {
    const now = 1_700_000_000;
    const a = verifyStartToken(signStartToken(UID, TG, now), now);
    const b = verifyStartToken(signStartToken(UID, TG, now), now);
    expect(a?.jti).not.toBe(b?.jti);
  });

  it("requires telegramId", () => {
    expect(() => signStartToken(UID, 0)).toThrow();
  });

  it("rejects legacy v1 token (no tg/jti)", () => {
    // Эмулируем старый payload без tg+jti — даже если HMAC валидный (тут он
    // невалидный, потому что NS изменился v1→v2), schema-чек тоже отказывает.
    const now = 1_700_000_000;
    const legacyPayload = Buffer.from(JSON.stringify({ uid: UID, iat: now }), "utf8").toString(
      "base64url",
    );
    expect(verifyStartToken(`${legacyPayload}.AAAA`, now)).toBeNull();
  });
});
