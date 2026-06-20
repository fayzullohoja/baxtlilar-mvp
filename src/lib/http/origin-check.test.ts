import { describe, it, expect, beforeAll } from "vitest";
import { isAllowedOrigin } from "./origin-check";

beforeAll(() => {
  process.env.APP_URL = "https://baxtlilar-mvp-production.up.railway.app";
});

function req(headers: Record<string, string>): Request {
  return new Request("https://baxtlilar-mvp-production.up.railway.app/api/x", { headers });
}

describe("isAllowedOrigin", () => {
  it("own origin (APP_URL) → allow", () => {
    expect(
      isAllowedOrigin(req({ origin: "https://baxtlilar-mvp-production.up.railway.app" })),
    ).toBe(true);
  });

  it("web.telegram.org → allow", () => {
    expect(isAllowedOrigin(req({ origin: "https://web.telegram.org" }))).toBe(true);
    expect(isAllowedOrigin(req({ origin: "https://k.web.telegram.org" }))).toBe(true);
    expect(isAllowedOrigin(req({ origin: "https://a.web.telegram.org" }))).toBe(true);
    expect(isAllowedOrigin(req({ origin: "https://z.web.telegram.org" }))).toBe(true);
  });

  it("evil.com → reject", () => {
    expect(isAllowedOrigin(req({ origin: "https://evil.com" }))).toBe(false);
  });

  it("без Origin + Sec-Fetch-Site=same-origin → allow", () => {
    expect(isAllowedOrigin(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });
  it("без Origin + Sec-Fetch-Site=none → allow (top-level navigation)", () => {
    expect(isAllowedOrigin(req({ "sec-fetch-site": "none" }))).toBe(true);
  });
  it("без Origin + Sec-Fetch-Site=cross-site → reject", () => {
    expect(isAllowedOrigin(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });
  it("без Origin без Sec-Fetch-Site → reject (curl/node)", () => {
    expect(isAllowedOrigin(req({}))).toBe(false);
  });

  it("совпадение по host (dev) → allow", () => {
    expect(isAllowedOrigin(req({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(
      true,
    );
  });

  it("origin похож но в другом TLD → reject", () => {
    expect(isAllowedOrigin(req({ origin: "https://web.telegram.fake" }))).toBe(false);
    expect(isAllowedOrigin(req({ origin: "https://baxtlilar-mvp-production.up.railway.app.evil.com" }))).toBe(false);
  });

  it("origin телеграма с другим протоколом → reject", () => {
    expect(isAllowedOrigin(req({ origin: "http://web.telegram.org" }))).toBe(false);
  });
});
