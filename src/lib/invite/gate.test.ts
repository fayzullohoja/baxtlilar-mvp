import { describe, it, expect, vi, beforeEach } from "vitest";

// --- флаг --------------------------------------------------------------
let gateOn = true;
vi.mock("@/lib/features/flags", () => ({
  isFeatureEnabled: () => Promise.resolve(gateOn),
}));

// --- ./store -------------------------------------------------------------
// Бриф Task 6 мокал только findActiveCode. redeemCode зовёт ещё и
// codeExistsButDisabled (см. NOTE в progress.md после Task 5) - без неё вызов
// падает с "codeExistsButDisabled is not a function". Мокаем обе функции.
type StoreRow = { id: string; code: string; owner_id: string | null; disabled_at: string | null } | null;
let activeCode: StoreRow = null;
let existsButDisabled = false;
const findActiveCodeMock = vi.fn((raw: string) => Promise.resolve(activeCode));
const codeExistsButDisabledMock = vi.fn((raw: string) => Promise.resolve(existsButDisabled));
vi.mock("./store", () => ({
  findActiveCode: (raw: string) => findActiveCodeMock(raw),
  codeExistsButDisabled: (raw: string) => codeExistsButDisabledMock(raw),
}));

// --- @/lib/supabase/admin --------------------------------------------------
// Свой мини-чейн, а не буквальный мок из брифа: там `eq: () => Promise...` -
// однозвенная цепочка. Реальный redeemCode зовёт update().eq().is().select() -
// на голом Promise метода .is() нет, тест упал бы на первом же вызове.
// select() - терминал (аналог RETURNING в реальном адаптере): отдаёт
// {data, error}, а не очередное звено цепочки.
type UpdateResult = { data: unknown[] | null; error: { message: string } | null };
let updateQueue: UpdateResult[] = [];
const updatedPatches: Array<Record<string, unknown>> = [];
const updateFilters: Array<Array<[string, unknown]>> = []; // фильтры одного update-вызова = один под-массив

function updateChain() {
  const filtersForThisCall: Array<[string, unknown]> = [];
  updateFilters.push(filtersForThisCall);
  const c: Record<string, unknown> = {
    eq: (col: string, val: unknown) => {
      filtersForThisCall.push([col, val]);
      return c;
    },
    is: (col: string, val: unknown) => {
      filtersForThisCall.push([col, val]);
      return c;
    },
    select: () => Promise.resolve(updateQueue.shift() ?? { data: [], error: null }),
  };
  return c;
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (_table: string) => ({
      update: (patch: Record<string, unknown>) => {
        updatedPatches.push(patch);
        return updateChain();
      },
    }),
  }),
}));

import { needsInviteStep, redeemCode } from "./gate";

beforeEach(() => {
  gateOn = true;
  activeCode = null;
  existsButDisabled = false;
  updateQueue = [];
  updatedPatches.length = 0;
  updateFilters.length = 0;
  findActiveCodeMock.mockClear();
  codeExistsButDisabledMock.mockClear();
});

describe("needsInviteStep", () => {
  // Ключевое правило спеки: состояние определяют ДАННЫЕ, а не история событий.
  it("шлагбаум выключен - шаг не нужен", async () => {
    gateOn = false;
    expect(await needsInviteStep({ invite_redeemed_at: null, invite_exempt: false })).toBe(false);
  });

  it("новичок при включённом шлагбауме - шаг нужен", async () => {
    expect(await needsInviteStep({ invite_redeemed_at: null, invite_exempt: false })).toBe(true);
  });

  it("код уже зачтён - шаг не нужен даже после перезапуска онбординга", async () => {
    // Перезапуск онбординга у реального юзера сбрасывает onboarding_step, но
    // НЕ invite_redeemed_at - именно это здесь и проверяется: одних данных
    // достаточно, история шагов не нужна.
    expect(await needsInviteStep({ invite_redeemed_at: "2026-08-11T10:00:00Z", invite_exempt: false })).toBe(false);
  });

  it("помечен как вошедший до запуска - шаг не нужен", async () => {
    expect(await needsInviteStep({ invite_redeemed_at: null, invite_exempt: true })).toBe(false);
  });
});

describe("redeemCode", () => {
  it("зачёт верного кода - ok:true, invited_by/invite_code_id/invite_redeemed_at пишутся, WHERE защищает от повторной записи", async () => {
    activeCode = { id: "code-1", code: "7K2MQX", owner_id: "owner-1", disabled_at: null };
    updateQueue.push({ data: [{ id: "user-1" }], error: null });

    const res = await redeemCode("user-1", "7K2MQX");

    expect(res).toEqual({ ok: true });
    expect(updatedPatches).toHaveLength(1);
    expect(updatedPatches[0]).toMatchObject({ invited_by: "owner-1", invite_code_id: "code-1" });
    expect(typeof updatedPatches[0]?.invite_redeemed_at).toBe("string");
    expect(updateFilters[0]).toContainEqual(["id", "user-1"]);
    expect(updateFilters[0]).toContainEqual(["invite_redeemed_at", null]);
    // Код был найден активным - лишний поход в codeExistsButDisabled не нужен.
    expect(codeExistsButDisabledMock).not.toHaveBeenCalled();
  });

  it("попытка зачесть свой код - ok:false reason:self, до базы вообще не доходит", async () => {
    activeCode = { id: "code-1", code: "OWN123", owner_id: "user-1", disabled_at: null };

    const res = await redeemCode("user-1", "OWN123");

    expect(res).toEqual({ ok: false, reason: "self" });
    expect(updatedPatches).toHaveLength(0); // self-проверка отсекает раньше записи
  });

  it("кода нет вообще - reason:not_found", async () => {
    activeCode = null;
    existsButDisabled = false;

    const res = await redeemCode("user-1", "ZZZZZZ");

    expect(res).toEqual({ ok: false, reason: "not_found" });
    expect(updatedPatches).toHaveLength(0);
  });

  it("код существует, но погашен - reason:disabled (не not_found: тексты для человека разные)", async () => {
    activeCode = null; // findActiveCode отфильтровывает погашенные
    existsButDisabled = true;

    const res = await redeemCode("user-1", "DEAD01");

    expect(res).toEqual({ ok: false, reason: "disabled" });
    expect(updatedPatches).toHaveLength(0);
  });

  it("повторный зачёт не перезаписывает пригласившего: второй update тоже несёт WHERE invite_redeemed_at IS NULL и честно отвечает ok:false, когда БД сообщает, что строка не совпала", async () => {
    // Первый зачёт - успешный.
    activeCode = { id: "code-1", code: "FIRST1", owner_id: "owner-1", disabled_at: null };
    updateQueue.push({ data: [{ id: "user-1" }], error: null });
    const first = await redeemCode("user-1", "FIRST1");
    expect(first).toEqual({ ok: true });

    // Второй зачёт - другим (валидным!) кодом другого владельца. В реальной
    // БД WHERE invite_redeemed_at IS NULL уже не совпадёт со строкой юзера
    // (она проставлена первым вызовом) - имитируем это пустым data, как и
    // должен ответить настоящий адаптер после RETURNING на несовпавший UPDATE.
    activeCode = { id: "code-2", code: "SECOND2", owner_id: "owner-2", disabled_at: null };
    updateQueue.push({ data: [], error: null });
    const second = await redeemCode("user-1", "SECOND2");

    // Главная проверка: НЕ ok:true. Если бы redeemCode доверял голому "error
    // === null" (как в исходном коде брифа) вместо RETURNING+data.length,
    // здесь был бы ложный успех - будто второй код тоже зачёлся и inviter
    // переписан на owner-2.
    expect(second).toEqual({ ok: false, reason: "not_found" });

    // И убеждаемся, что сам ЗАПРОС на запись нёс тот же защитный WHERE во
    // ВТОРОЙ раз - иначе тест выше прошёл бы и без .is(...) в реализации,
    // просто потому что мок отдал пустой data по очереди, а не потому что
    // редеем действительно попросил у БД защиту от перезаписи.
    expect(updatedPatches).toHaveLength(2);
    expect(updatedPatches[1]).toMatchObject({ invited_by: "owner-2" });
    expect(updateFilters[1]).toContainEqual(["invite_redeemed_at", null]);
  });
});
