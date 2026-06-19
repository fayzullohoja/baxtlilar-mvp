import { describe, it, expect, beforeAll } from "vitest";
import { signStartToken, verifyStartToken } from "./start-token";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-session-secret-must-be-at-least-32-chars-long";
  process.env.DATABASE_URL = "postgres://test";
  process.env.TELEGRAM_BOT_TOKEN = "test-bot-token-1234567890";
});

const UID = "11111111-1111-1111-1111-111111111111";

describe("start-token", () => {
  it("signs and verifies a fresh token", () => {
    const now = 1_700_000_000;
    const t = signStartToken(UID, now);
    const got = verifyStartToken(t, now);
    expect(got?.uid).toBe(UID);
  });

  it("rejects token after TTL", () => {
    const now = 1_700_000_000;
    const t = signStartToken(UID, now);
    expect(verifyStartToken(t, now + 601)).toBeNull();
    expect(verifyStartToken(t, now + 600)).not.toBeNull();
  });

  it("rejects token with tampered payload", () => {
    const now = 1_700_000_000;
    const t = signStartToken(UID, now);
    const sig = t.split(".")[1];
    const fakePayload = Buffer.from(JSON.stringify({ uid: "evil", iat: now }), "utf8").toString(
      "base64url",
    );
    const tampered = `${fakePayload}.${sig}`;
    expect(verifyStartToken(tampered, now)).toBeNull();
  });

  it("rejects token with tampered signature", () => {
    const now = 1_700_000_000;
    const t = signStartToken(UID, now);
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
    const t = signStartToken(UID, now + 60);
    expect(verifyStartToken(t, now)).toBeNull();
  });
});
