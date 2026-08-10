import { describe, it, expect, vi, beforeEach } from "vitest";

// C-033 — kill switches. Проверяем: (1) дефолты, (2) чтение из app_settings
// переопределяет дефолт, (3) КРИТЕРИЙ G-26 — гейт роута реально меняет поведение
// (enabled:false → 503 feature_disabled, true → пропускает), (4) fail-open к
// дефолтам при сбое БД, (5) вайтлист набора ключей.

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: vi.fn() }));

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  FEATURES,
  FEATURE_DEFAULTS,
  featureKey,
  loadFeatureFlags,
  isFeatureEnabled,
  assertFeatureEnabledForRequest,
  invalidateFeatureCache,
} from "./flags";

type Row = { key: string; value: unknown };

/** sb-мок: .from("app_settings").select().in() → {data, error}. */
function mockRows(rows: Row[] | null, error: unknown = null) {
  const sb = {
    from: () => ({
      select: () => ({
        in: async () => ({ data: rows, error }),
      }),
    }),
  };
  vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
}

beforeEach(() => {
  vi.mocked(supabaseAdmin).mockReset();
  invalidateFeatureCache(); // кэш модульного уровня переживает тесты — сбрасываем
});

describe("feature flags — набор ключей и дефолты", () => {
  it("ровно 6 фич с ожидаемыми именами", () => {
    expect([...FEATURES]).toEqual(["verification", "matching", "interests", "chat", "payments", "invite_gate"]);
  });

  it("payments и invite_gate выключены по умолчанию, остальные включены", () => {
    expect(FEATURE_DEFAULTS).toEqual({
      verification: true,
      matching: true,
      interests: true,
      chat: true,
      payments: false,
      invite_gate: false,
    });
  });

  it("featureKey → feature_<name>_enabled", () => {
    expect(featureKey("chat")).toBe("feature_chat_enabled");
    expect(featureKey("verification")).toBe("feature_verification_enabled");
  });

  it("отсутствие строки в app_settings → дефолт фичи", async () => {
    mockRows([]);
    const flags = await loadFeatureFlags();
    expect(flags).toEqual(FEATURE_DEFAULTS);
  });

  it("значение из app_settings переопределяет дефолт", async () => {
    mockRows([
      { key: "feature_chat_enabled", value: false },
      { key: "feature_payments_enabled", value: true },
    ]);
    const flags = await loadFeatureFlags();
    expect(flags.chat).toBe(false); // выключили
    expect(flags.payments).toBe(true); // включили
    expect(flags.interests).toBe(true); // не трогали → дефолт
  });

  it("нестрого-булево значение игнорируется (остаётся дефолт)", async () => {
    mockRows([{ key: "feature_matching_enabled", value: "false" }]); // строка, не boolean
    const flags = await loadFeatureFlags();
    expect(flags.matching).toBe(true); // не сломались об мусор
  });

  it("сбой БД → fail-open к дефолтам", async () => {
    mockRows(null, { message: "connection reset" });
    const flags = await loadFeatureFlags();
    expect(flags).toEqual(FEATURE_DEFAULTS);
  });
});

describe("G-26 — гейт роута меняет поведение (без деплоя, значение из БД)", () => {
  it("enabled:false → 503 feature_disabled с полем feature", async () => {
    mockRows([{ key: "feature_interests_enabled", value: false }]);
    const res = await assertFeatureEnabledForRequest("interests");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
    const body = await res!.json();
    expect(body).toEqual({ ok: false, error: "feature_disabled", feature: "interests" });
  });

  it("enabled:true → null (пропускает)", async () => {
    mockRows([{ key: "feature_interests_enabled", value: true }]);
    const res = await assertFeatureEnabledForRequest("interests");
    expect(res).toBeNull();
  });

  it("каждая фича выключается НЕЗАВИСИМО (chat off не трогает interests)", async () => {
    mockRows([{ key: "feature_chat_enabled", value: false }]);
    expect(await assertFeatureEnabledForRequest("chat")).not.toBeNull(); // chat заблокирован
    invalidateFeatureCache();
    mockRows([{ key: "feature_chat_enabled", value: false }]);
    expect(await assertFeatureEnabledForRequest("interests")).toBeNull(); // interests жив
  });

  it("isFeatureEnabled отражает флаг", async () => {
    mockRows([{ key: "feature_verification_enabled", value: false }]);
    expect(await isFeatureEnabled("verification")).toBe(false);
  });
});

describe("invite_gate", () => {
  it("есть в списке фич", () => {
    expect(FEATURES).toContain("invite_gate");
  });

  // Шлагбаум ВЫКЛЮЧЕН по умолчанию: выкладка кода не должна ничего менять
  // для живых пользователей. Включается осознанно, отдельным действием.
  it("по умолчанию выключен", () => {
    expect(FEATURE_DEFAULTS.invite_gate).toBe(false);
  });

  it("ключ в app_settings совпадает с соглашением", () => {
    expect(featureKey("invite_gate")).toBe("feature_invite_gate_enabled");
  });
});
