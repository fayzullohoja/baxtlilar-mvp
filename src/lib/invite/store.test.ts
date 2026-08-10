import { describe, it, expect, vi, beforeEach } from "vitest";

// --- generic thenable chain-mock поверх @/lib/supabase/admin ---------------
//
// Реальный Query (src/lib/db/query-builder.ts) - PromiseLike: select/insert/
// update/eq/is/not возвращают `this`, а маршрут БЕЗ .maybeSingle()/.single()
// (просто await на конце цепочки) резолвится через .then(). Ловушка, в
// которую попал бы мок "по образцу" из брифа: там терминал был только у
// maybeSingle, а `await chain.insert(...)` на нетеримальном объекте даёт сам
// объект, `{error}` из него - undefined, `!error` - true. Тест был бы зелёным,
// не проверив вообще ничего (disableCodesOfUser/reviveBanDisabledCodes/
// countInvitedBy/insert внутри ensureCodeForUser сделаны именно так). Поэтому
// здесь у чейна ЕСТЬ .then().
//
// Результаты подаются через FIFO-очереди (select/insert/update) - реализация
// зовёт .from() заново на каждый под-запрос, поэтому порядок push() в тесте
// = порядку реальных обращений к БД в функции.
type Result = { data?: unknown; error?: { message: string } | null; count?: number | null };

let selectQueue: Result[] = [];
let insertQueue: Array<{ error: { message: string } | null }> = [];
let updateQueue: Array<{ error: { message: string } | null }> = [];

const fromCalls: string[] = [];
const eqCalls: Array<[string, unknown]> = [];
const isCalls: Array<[string, unknown]> = [];
const notCalls: Array<[string, string, unknown]> = [];
const insertedRows: Array<Record<string, unknown>> = [];
const updatedRows: Array<Record<string, unknown>> = [];

function pullSelect(): Result {
  return selectQueue.shift() ?? { data: null, error: null };
}
function pullInsert(): { error: { message: string } | null } {
  return insertQueue.shift() ?? { error: null };
}
function pullUpdate(): { error: { message: string } | null } {
  return updateQueue.shift() ?? { error: null };
}

function chain() {
  let op: "select" | "insert" | "update" = "select";
  const c: Record<string, unknown> = {
    select: () => {
      op = "select";
      return c;
    },
    insert: (row: Record<string, unknown>) => {
      op = "insert";
      insertedRows.push(row);
      return c;
    },
    update: (patch: Record<string, unknown>) => {
      op = "update";
      updatedRows.push(patch);
      return c;
    },
    eq: (col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return c;
    },
    is: (col: string, val: unknown) => {
      isCalls.push([col, val]);
      return c;
    },
    not: (col: string, cmpOp: string, val: unknown) => {
      notCalls.push([col, cmpOp, val]);
      return c;
    },
    maybeSingle: () => Promise.resolve(pullSelect()),
    single: () => Promise.resolve(pullSelect()),
    then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      const result = op === "insert" ? pullInsert() : op === "update" ? pullUpdate() : pullSelect();
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return c;
}

const fromSpy = vi.fn((table: string) => {
  fromCalls.push(table);
  return chain();
});

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ from: fromSpy }),
}));

import {
  findActiveCode,
  codeExistsButDisabled,
  ensureCodeForUser,
  disableCodesOfUser,
  reviveBanDisabledCodes,
  countInvitedBy,
} from "./store";

beforeEach(() => {
  selectQueue = [];
  insertQueue = [];
  updateQueue = [];
  fromCalls.length = 0;
  eqCalls.length = 0;
  isCalls.length = 0;
  notCalls.length = 0;
  insertedRows.length = 0;
  updatedRows.length = 0;
  fromSpy.mockClear();
});

describe("findActiveCode", () => {
  it("ищет через extractInviteCode - кириллица находит латинский код", async () => {
    selectQueue.push({ data: { id: "c1", code: "BAXT7K", owner_id: "u1", disabled_at: null }, error: null });
    const found = await findActiveCode("вахт7к");
    expect(found?.code).toBe("BAXT7K");
    // Убеждаемся, что в базу ушёл именно НОРМАЛИЗОВАННЫЙ код, не сырая кириллица.
    expect(eqCalls).toContainEqual(["code", "BAXT7K"]);
  });

  it("пересланное сообщение с текстом вокруг - достаёт код, а не мусор из соседних слов", async () => {
    selectQueue.push({ data: { id: "c2", code: "7K2MQX", owner_id: "u2", disabled_at: null }, error: null });
    const found = await findActiveCode("Держи код: 7K2MQX, заходи");
    expect(found?.code).toBe("7K2MQX");
    expect(eqCalls).toContainEqual(["code", "7K2MQX"]);
  });

  it("несуществующий код - null (реально ходили в базу, не короткое замыкание)", async () => {
    selectQueue.push({ data: null, error: null });
    expect(await findActiveCode("ZZZZZ2")).toBeNull();
    expect(eqCalls).toContainEqual(["code", "ZZZZZ2"]);
  });

  it("сбой базы - null (вход закрыт, а не открыт настежь)", async () => {
    selectQueue.push({ data: null, error: { message: "connection refused" } });
    expect(await findActiveCode("ZZZZZ3")).toBeNull();
  });

  it("мусорный ввод (нет цифры/не собирается в 6 символов) - в базу не ходит вообще", async () => {
    expect(await findActiveCode("!!!")).toBeNull();
    expect(fromSpy).not.toHaveBeenCalled();
  });
});

describe("codeExistsButDisabled", () => {
  it("код существует и погашен - true, фильтр именно по disabled_at IS NOT NULL", async () => {
    selectQueue.push({ data: { id: "c1" }, error: null });
    expect(await codeExistsButDisabled("ZZZZZ2")).toBe(true);
    expect(notCalls).toContainEqual(["disabled_at", "is", null]);
  });

  it("активный код (disabled_at IS NULL) - false: фильтр его отсекает", async () => {
    // Реальная БД под .not("disabled_at","is",null) не вернёт активную строку -
    // здесь это же поведение задаём через сценарий, а filter-ассерт ниже
    // защищает от регрессии, если кто-то ослабит условие до "просто есть строка".
    selectQueue.push({ data: null, error: null });
    expect(await codeExistsButDisabled("ZZZZZ2")).toBe(false);
    expect(notCalls).toContainEqual(["disabled_at", "is", null]);
  });

  it("несуществующий код - false", async () => {
    selectQueue.push({ data: null, error: null });
    expect(await codeExistsButDisabled("ZZZZZ4")).toBe(false);
  });

  it("мусорный ввод - в базу не ходит", async () => {
    expect(await codeExistsButDisabled("###")).toBe(false);
    expect(fromSpy).not.toHaveBeenCalled();
  });
});

describe("ensureCodeForUser", () => {
  it("код уже есть - отдаёт существующий, insert не зовёт", async () => {
    selectQueue.push({ data: { code: "EXIST1" }, error: null });
    const code = await ensureCodeForUser("u1");
    expect(code).toBe("EXIST1");
    expect(insertedRows).toHaveLength(0);
  });

  it("кода нет - создаёт новый и отдаёт его", async () => {
    selectQueue.push({ data: null, error: null }); // начальная проверка - кода нет
    insertQueue.push({ error: null }); // insert проходит с первой попытки
    const code = await ensureCodeForUser("u1");
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({ owner_id: "u1" });
  });

  it("гонка: insert бьётся об invite_codes_one_active_per_owner, но код уже есть - отдаёт его, не жжёт попытки", async () => {
    selectQueue.push({ data: null, error: null }); // начальная проверка - кода ещё нет
    insertQueue.push({
      error: { message: 'duplicate key value violates unique constraint "invite_codes_one_active_per_owner"' },
    });
    selectQueue.push({ data: { code: "WINNER1" }, error: null }); // перечитка после гонки находит код конкурента
    const code = await ensureCodeForUser("u1");
    expect(code).toBe("WINNER1");
    expect(insertedRows).toHaveLength(1); // ушла ровно одна попытка insert, не три
  });

  it("после 3 неудачных попыток (коллизия кода, не гонка по владельцу) - бросает", async () => {
    selectQueue.push({ data: null, error: null }); // начальная проверка
    for (let i = 0; i < 3; i++) {
      insertQueue.push({ error: { message: 'duplicate key value violates unique constraint "invite_codes_code_key"' } });
      selectQueue.push({ data: null, error: null }); // перечитка ничего не находит - это не гонка по владельцу
    }
    await expect(ensureCodeForUser("u1")).rejects.toThrow(/не удалось выпустить код/);
    expect(insertedRows).toHaveLength(3);
  });
});

describe("disableCodesOfUser", () => {
  it("гасит активные коды пользователя с указанной причиной", async () => {
    updateQueue.push({ error: null });
    await disableCodesOfUser("u1", "leak");
    expect(updatedRows[0]).toMatchObject({ disabled_reason: "leak" });
    expect(typeof updatedRows[0]?.disabled_at).toBe("string"); // timestamp проставлен
    expect(eqCalls).toContainEqual(["owner_id", "u1"]);
    expect(isCalls).toContainEqual(["disabled_at", null]); // гасим только ещё активные
  });
});

describe("reviveBanDisabledCodes", () => {
  it("оживляет коды, погашенные ИМЕННО из-за бана - фильтр по disabled_reason='ban'", async () => {
    updateQueue.push({ error: null });
    await reviveBanDisabledCodes("u1");
    expect(updatedRows[0]).toEqual({ disabled_at: null, disabled_reason: null });
    expect(eqCalls).toContainEqual(["owner_id", "u1"]);
    // Ключевая проверка: фильтр по причине гашения присутствует. Без него
    // запрос ожил бы и коды, погашенные за утечку, - утечка так и осталась
    // бы открытым каналом входа, просто с погашенным-и-снова-включённым кодом.
    expect(eqCalls).toContainEqual(["disabled_reason", "ban"]);
  });
});

describe("countInvitedBy", () => {
  it("возвращает count из head-запроса", async () => {
    selectQueue.push({ data: null, error: null, count: 5 });
    expect(await countInvitedBy("u1")).toBe(5);
    expect(eqCalls).toContainEqual(["invited_by", "u1"]);
    expect(isCalls).toContainEqual(["deleted_at", null]); // не считаем удалённых
  });

  it("нет count в ответе - 0, а не undefined/NaN", async () => {
    selectQueue.push({ data: null, error: null });
    expect(await countInvitedBy("u1")).toBe(0);
  });
});
