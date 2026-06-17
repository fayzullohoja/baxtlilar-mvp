import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendViaEskiz, __resetEskizTokenCache } from "./eskiz";

const CFG = { baseUrl: "https://notify.eskiz.uz/api", email: "a@b.uz", password: "pw", from: "4546" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("sendViaEskiz", () => {
  beforeEach(() => __resetEskizTokenCache());
  afterEach(() => vi.restoreAllMocks());

  it("logs in, then sends with Bearer token, digits-only phone, and form fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ data: { token: "TOK" } })) // login
      .mockResolvedValueOnce(json({ id: "1", status: "waiting" })); // send
    vi.stubGlobal("fetch", fetchMock);

    await sendViaEskiz(CFG, "+998 90 123 45 67", "code 123456");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://notify.eskiz.uz/api/auth/login");

    const [sendUrl, sendInit] = fetchMock.mock.calls[1];
    expect(sendUrl).toBe("https://notify.eskiz.uz/api/message/sms/send");
    expect((sendInit.headers as Record<string, string>).Authorization).toBe("Bearer TOK");
    const fd = sendInit.body as FormData;
    expect(fd.get("mobile_phone")).toBe("998901234567"); // '+' и пробелы убраны
    expect(fd.get("from")).toBe("4546");
    expect(fd.get("message")).toBe("code 123456");
  });

  it("reuses the cached token on a second send (no re-login)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ data: { token: "TOK" } })) // login (once)
      .mockResolvedValue(json({ id: "1" })); // sends
    vi.stubGlobal("fetch", fetchMock);

    await sendViaEskiz(CFG, "998901234567", "a");
    await sendViaEskiz(CFG, "998901234567", "b");

    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 login + 2 sends
  });

  it("re-logs in once on a 401, then retries the send", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ data: { token: "OLD" } })) // login
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 })) // send → 401
      .mockResolvedValueOnce(json({ data: { token: "NEW" } })) // re-login
      .mockResolvedValueOnce(json({ id: "1" })); // send ok
    vi.stubGlobal("fetch", fetchMock);

    await sendViaEskiz(CFG, "998901234567", "a");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("throws on a non-401 send failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ data: { token: "TOK" } }))
      .mockResolvedValueOnce(new Response("bad request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendViaEskiz(CFG, "998901234567", "a")).rejects.toThrow(/Eskiz send failed: HTTP 400/);
  });

  it("throws when login returns no token", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ data: {} }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendViaEskiz(CFG, "998901234567", "a")).rejects.toThrow(/no token/);
  });
});
