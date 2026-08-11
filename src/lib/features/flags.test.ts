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
  FAIL_CLOSED_FEATURES,
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

  it("сбой БД → fail-open к дефолтам для обычных рубильников, invite_gate - исключение (см. describe ниже)", async () => {
    mockRows(null, { message: "connection reset" });
    const flags = await loadFeatureFlags();
    // Раунд исправлений 1: раньше здесь стояло `expect(flags).toEqual(FEATURE_DEFAULTS)` -
    // это ЦЕЛИКОМ совпадало с тем, что invite_gate на сбое молча брал дефолт
    // false ("вход открыт"). Теперь дефолты сохраняются только для пяти
    // обычных флагов; invite_gate - в FAIL_CLOSED_FEATURES и не участвует в
    // fail-open. Проверяем оба факта явно, а не одним toEqual по всему объекту.
    for (const f of FEATURES) {
      if (FAIL_CLOSED_FEATURES.includes(f)) continue;
      expect(flags[f]).toBe(FEATURE_DEFAULTS[f]); // обычные флаги - дефолт как раньше
    }
    expect(flags.invite_gate).toBe(true); // а не false из дефолта
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

  it("в списке FAIL_CLOSED_FEATURES", () => {
    expect(FAIL_CLOSED_FEATURES).toContain("invite_gate");
  });

  // Раунд исправлений 1 — Critical из ревью: сбой чтения app_settings молча
  // откатывался к дефолту invite_gate=false ("вход открыт"). Строки флага в
  // таблице при этом попросту нет (обычное дело - флаг ещё не настраивали) -
  // это тот же сценарий, что "отсутствие строки → дефолт" выше, но с ошибкой
  // чтения вместо пустого результата. На старом коде (`catch {}` без правки
  // FAIL_CLOSED_FEATURES) этот тест падал: flags.invite_gate был false.
  it("сбой чтения при отсутствующей строке флага → invite_gate=true (шлагбаум закрыт), а не false из дефолта", async () => {
    mockRows(null, { message: "connection reset" });
    const flags = await loadFeatureFlags();
    expect(flags.invite_gate).toBe(true);
  });

  it("неудачное чтение НЕ кэшируется - следующий вызов без ручного invalidateFeatureCache идёт в БД заново", async () => {
    const inSpy = vi.fn();
    // Первый вызов - БД недоступна.
    inSpy.mockResolvedValueOnce({ data: null, error: { message: "connection reset" } });
    // Второй вызов (тот же process, тот же кэш) - БД снова отвечает, строки нет.
    inSpy.mockResolvedValueOnce({ data: [], error: null });
    vi.mocked(supabaseAdmin).mockReturnValue({
      from: () => ({ select: () => ({ in: inSpy }) }),
    } as never);

    const first = await loadFeatureFlags();
    expect(first.invite_gate).toBe(true); // сбой → закрыто

    // invalidateFeatureCache() здесь НАРОЧНО не зовём: если бы неудачный первый
    // вызов осел в кэше (старый баг - `cache = {...}` было безусловным), второй
    // вызов отдал бы ту же закэшированную закрытую версию, не дойдя до БД, и
    // inSpy получил бы только один вызов вместо двух.
    const second = await loadFeatureFlags();
    expect(second.invite_gate).toBe(false); // БД снова доступна → честный дефолт
    expect(inSpy).toHaveBeenCalledTimes(2); // оба раза реально ходили в БД
  });
});
