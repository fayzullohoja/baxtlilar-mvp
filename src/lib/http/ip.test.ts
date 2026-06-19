import { describe, it, expect } from "vitest";
import { trustedIp } from "./ip";

function fakeReq(headers: Record<string, string>): Request {
  return new Request("https://example.test/", { headers });
}

describe("trustedIp", () => {
  it("Railway: x-envoy-external-address имеет приоритет", () => {
    const r = fakeReq({
      "x-envoy-external-address": "203.0.113.42",
      "x-forwarded-for": "10.0.0.1, 203.0.113.42",
      "x-real-ip": "10.0.0.1",
    });
    expect(trustedIp(r)).toBe("203.0.113.42");
  });

  it("Vercel: x-vercel-forwarded-for первый сегмент", () => {
    const r = fakeReq({ "x-vercel-forwarded-for": "198.51.100.7, 76.76.21.21" });
    expect(trustedIp(r)).toBe("198.51.100.7");
  });

  it("x-real-ip как fallback после envoy/vercel", () => {
    const r = fakeReq({ "x-real-ip": "203.0.113.1" });
    expect(trustedIp(r)).toBe("203.0.113.1");
  });

  it("XFF: берём правый non-private сегмент", () => {
    // клиент мог подделать левые сегменты; наш edge добавил последний
    const r = fakeReq({ "x-forwarded-for": "1.1.1.1, 8.8.8.8, 198.51.100.42" });
    expect(trustedIp(r)).toBe("198.51.100.42");
  });

  it("XFF: пропускает приватные сегменты", () => {
    const r = fakeReq({ "x-forwarded-for": "203.0.113.5, 10.0.0.1, 192.168.1.1" });
    expect(trustedIp(r)).toBe("203.0.113.5");
  });

  it("без заголовков → unknown", () => {
    expect(trustedIp(fakeReq({}))).toBe("unknown");
  });

  it("отвергает невалидные значения и идёт дальше", () => {
    const r = fakeReq({
      "x-envoy-external-address": "[object Object]",
      "x-vercel-forwarded-for": "definitely-not-an-ip",
      "x-real-ip": "203.0.113.99",
    });
    expect(trustedIp(r)).toBe("203.0.113.99");
  });

  it("Railway envoy + спуфабельный XFF: envoy выигрывает", () => {
    // F-011: атакующий шлёт XFF: 127.0.0.1 чтобы получить admin-разделённый
    // bucket. Envoy перебивает.
    const r = fakeReq({
      "x-envoy-external-address": "203.0.113.42",
      "x-forwarded-for": "127.0.0.1",
    });
    expect(trustedIp(r)).toBe("203.0.113.42");
  });

  it("XFF только из private → unknown (нет доверенного хопа)", () => {
    const r = fakeReq({ "x-forwarded-for": "10.0.0.1, 192.168.1.1" });
    expect(trustedIp(r)).toBe("unknown");
  });

  it("IPv6 принимается", () => {
    const r = fakeReq({ "x-envoy-external-address": "2001:db8::1" });
    expect(trustedIp(r)).toBe("2001:db8::1");
  });
});
