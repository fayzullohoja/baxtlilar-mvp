import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { LEGAL_VERSION } from "@/content/legal";
import { BIOMETRIC_CONSENT_TEXT } from "@/content/biometric-consent";

// --- supabaseAdmin mock: chainable для .from().select().eq()… + .rpc() -------
let checkRow: unknown = null;
let checkError: { message: string } | null = null;
const rpcSpy = vi.fn(() => Promise.resolve({ error: null as { message: string } | null }));

function chain() {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "limit"]) c[m] = () => c;
  c.maybeSingle = () => Promise.resolve({ data: checkRow, error: checkError });
  return c;
}
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ from: () => chain(), rpc: rpcSpy }),
}));

import { hasActiveBiometricConsent, recordBiometricConsent } from "./biometric";

describe("biometric consent (Tier 3 — перенос из бота в mini-app)", () => {
  beforeEach(() => {
    checkRow = null;
    checkError = null;
    rpcSpy.mockClear();
    rpcSpy.mockResolvedValue({ error: null });
  });

  it("hasActiveBiometricConsent: true когда есть активная строка", async () => {
    checkRow = { consent_type: "biometric" };
    expect(await hasActiveBiometricConsent("u1")).toBe(true);
  });

  it("hasActiveBiometricConsent: false когда строки нет", async () => {
    checkRow = null;
    expect(await hasActiveBiometricConsent("u1")).toBe(false);
  });

  it("hasActiveBiometricConsent: fail-closed (false) при ошибке БД", async () => {
    checkError = { message: "boom" };
    expect(await hasActiveBiometricConsent("u1")).toBe(false);
  });

  it("recordBiometricConsent: пишет record_consent с biometric/version/source=miniapp + верный sha", async () => {
    const out = await recordBiometricConsent({
      userId: "u1",
      telegramId: 555,
      lang: "ru",
      ip: "1.2.3.4",
      userAgent: "UA",
    });
    expect(out.ok).toBe(true);
    expect(rpcSpy).toHaveBeenCalledTimes(1);
    const [fn, args] = rpcSpy.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(fn).toBe("record_consent");
    expect(args.p_types).toEqual(["biometric"]);
    expect(args.p_categories).toEqual(["biometric"]);
    expect(args.p_version).toBe(LEGAL_VERSION);
    expect(args.p_source).toBe("miniapp");
    expect(args.p_ip).toBe("1.2.3.4");
    const expectedSha = crypto
      .createHash("sha256")
      .update(BIOMETRIC_CONSENT_TEXT.ru + "::" + LEGAL_VERSION)
      .digest("hex");
    expect(args.p_sha).toBe(expectedSha);
  });

  it("recordBiometricConsent: ok=false при ошибке RPC (не двигаем шаг)", async () => {
    rpcSpy.mockResolvedValue({ error: { message: "rpc fail" } });
    const out = await recordBiometricConsent({
      userId: "u1",
      telegramId: 555,
      lang: "uz",
      ip: "x",
      userAgent: "y",
    });
    expect(out.ok).toBe(false);
  });
});

describe("consent-text tuple consistency (advisor #2)", () => {
  it("bot bio_consent_ask === app BIOMETRIC_CONSENT_TEXT (один текст под одной версией)", async () => {
    const { M } = await import("@/lib/telegram/bot/messages");
    expect(M.bio_consent_ask.ru).toBe(BIOMETRIC_CONSENT_TEXT.ru);
    expect(M.bio_consent_ask.uz).toBe(BIOMETRIC_CONSENT_TEXT.uz);
  });
});
