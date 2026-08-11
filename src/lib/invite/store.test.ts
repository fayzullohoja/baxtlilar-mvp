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

// Task 10 (раунд исправлений 1): disableCodesOfUser теперь один RPC-вызов
// вместо двух прямых UPDATE (см. store.ts и миграцию 20260811160000) - обе
// записи объединены транзакцией НА СТОРОНЕ БД, а это моком не проверить (мок
// не исполняет SQL). Здесь мокаем ТОЛЬКО транспорт: какие параметры ушли в
// rpc() и что делает disableCodesOfUser с data/error, которые вернула БД.
// Реальную атомарность (что первая запись откатывается, если падает вторая)
// проверяет src/lib/invite/disable-invite-codes.itest.ts на живом Postgres.
type RpcResult = { data?: unknown; error?: { message: string } | null };
let rpcQueue: RpcResult[] = [];
const rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];
const rpcSpy = vi.fn((name: string, params: Record<string, unknown> = {}) => {
  rpcCalls.push({ name, params });
  return Promise.resolve(rpcQueue.shift() ?? { data: null, error: null });
});

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ from: fromSpy, rpc: rpcSpy }),
}));

import {
  findActiveCode,
  codeExistsButDisabled,
  ensureCodeForUser,
  disableCodesOfUser,
  reviveBanDisabledCodes,
  countInvitedBy,
  restoreInviteRight,
  createMasterCode,
  InviteRevokedError,
} from "./store";

beforeEach(() => {
  selectQueue = [];
  insertQueue = [];
  updateQueue = [];
  rpcQueue = [];
  fromCalls.length = 0;
  eqCalls.length = 0;
  isCalls.length = 0;
  notCalls.length = 0;
  insertedRows.length = 0;
  updatedRows.length = 0;
  rpcCalls.length = 0;
  fromSpy.mockClear();
  rpcSpy.mockClear();
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

  it("сбой базы - null, ДАЖЕ если строка пришла вместе с ошибкой (вход закрыт, а не открыт настежь)", async () => {
    // data специально НЕ пустой: без `if (error) return null` функция вернула
    // бы эту строку - то есть пустила бы по коду при сбое БД. Пустой data не
    // отличил бы "защита от ошибки сработала" от "просто нечего вернуть" - и
    // такой тест остался бы зелёным, даже если удалить саму проверку `error`.
    selectQueue.push({
      data: { id: "c9", code: "ZZZZZ3", owner_id: "u9", disabled_at: null },
      error: { message: "connection refused" },
    });
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

  it("сбой базы - false (fail-closed по тексту причины, но не по доступу - единственный вызывающий уже отказал)", async () => {
    // data специально непустой - как и в findActiveCode, проверяем, что именно
    // проверка error решает исход, а не совпадение с "нечего вернуть".
    selectQueue.push({ data: { id: "cX" }, error: { message: "timeout" } });
    expect(await codeExistsButDisabled("ZZZZZ5")).toBe(false);
  });
});

describe("ensureCodeForUser", () => {
  it("код уже есть - отдаёт существующий, insert не зовёт, фильтр по owner_id и непогашенным", async () => {
    selectQueue.push({ data: { code: "EXIST1" }, error: null });
    const code = await ensureCodeForUser("u1");
    expect(code).toBe("EXIST1");
    expect(insertedRows).toHaveLength(0);
    expect(eqCalls).toContainEqual(["owner_id", "u1"]);
    expect(isCalls).toContainEqual(["disabled_at", null]);
  });

  it("кода нет - создаёт новый и отдаёт его", async () => {
    selectQueue.push({ data: null, error: null }); // начальная проверка - кода нет
    selectQueue.push({ data: { invite_revoked_at: null }, error: null }); // Task 10: проверка персонального запрета - не стоит
    insertQueue.push({ error: null }); // insert проходит с первой попытки
    const code = await ensureCodeForUser("u1");
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({ owner_id: "u1" });
  });

  it("гонка: insert бьётся об invite_codes_one_active_per_owner, но код уже есть - отдаёт его, не жжёт попытки", async () => {
    selectQueue.push({ data: null, error: null }); // начальная проверка - кода ещё нет
    selectQueue.push({ data: { invite_revoked_at: null }, error: null }); // Task 10: запрета нет
    insertQueue.push({
      error: { message: 'duplicate key value violates unique constraint "invite_codes_one_active_per_owner"' },
    });
    selectQueue.push({ data: { code: "WINNER1" }, error: null }); // перечитка после гонки находит код конкурента
    const code = await ensureCodeForUser("u1");
    expect(code).toBe("WINNER1");
    expect(insertedRows).toHaveLength(1); // ушла ровно одна попытка insert, не три
    // Перечитка после гонки обязана фильтровать по ТОМУ ЖЕ owner_id и по
    // непогашенным кодам - иначе можно случайно отдать чужой или мёртвый код.
    // Оба select'а (начальный + перечитка) используют одинаковые фильтры,
    // поэтому здесь достаточно проверить, что нужная пара вообще встречается.
    expect(eqCalls.filter(([col, val]) => col === "owner_id" && val === "u1")).toHaveLength(2);
    expect(isCalls.filter(([col, val]) => col === "disabled_at" && val === null)).toHaveLength(2);
  });

  it("после 3 неудачных попыток (коллизия кода, не гонка по владельцу) - бросает", async () => {
    selectQueue.push({ data: null, error: null }); // начальная проверка
    selectQueue.push({ data: { invite_revoked_at: null }, error: null }); // Task 10: запрета нет
    for (let i = 0; i < 3; i++) {
      insertQueue.push({ error: { message: 'duplicate key value violates unique constraint "invite_codes_code_key"' } });
      selectQueue.push({ data: null, error: null }); // перечитка ничего не находит - это не гонка по владельцу
    }
    await expect(ensureCodeForUser("u1")).rejects.toThrow(/не удалось выпустить код/);
    expect(insertedRows).toHaveLength(3);
  });

  it("сбой начальной проверки - бросает СРАЗУ, insert вообще не зовёт", async () => {
    selectQueue.push({ data: null, error: { message: "connection refused" } });
    await expect(ensureCodeForUser("u1")).rejects.toThrow(/не удалось проверить код приглашения/);
    expect(insertedRows).toHaveLength(0); // не пытались вслепую вставлять при непроверенном состоянии
  });

  // ⛔ Task 10 (находка ревью Task 8): гашение "утечка" не должно САМО СЕБЯ
  // ОТМЕНЯТЬ. Без проверки ниже человек без активного кода, но с
  // users.invite_revoked_at заполненным, получил бы новый код на следующем
  // же заходе - именно это и ломало гашение до этой задачи.
  it("активного кода нет, но персональный запрет стоит - бросает InviteRevokedError, insert НЕ зовёт", async () => {
    selectQueue.push({ data: null, error: null }); // начальная проверка - активного кода нет (погашен)
    selectQueue.push({ data: { invite_revoked_at: "2026-08-11T09:00:00.000Z" }, error: null }); // запрет стоит
    await expect(ensureCodeForUser("u1")).rejects.toBeInstanceOf(InviteRevokedError);
    expect(insertedRows).toHaveLength(0);
  });

  it("проверка запрета фильтрует по id ЧЕЛОВЕКА (не по owner_id кода)", async () => {
    selectQueue.push({ data: null, error: null });
    selectQueue.push({ data: { invite_revoked_at: null }, error: null });
    insertQueue.push({ error: null });
    await ensureCodeForUser("u7");
    expect(eqCalls).toContainEqual(["id", "u7"]);
  });

  it("сбой проверки персонального запрета - бросает СРАЗУ, insert не зовёт", async () => {
    selectQueue.push({ data: null, error: null }); // начальная проверка кода - ок
    selectQueue.push({ data: null, error: { message: "connection refused" } }); // сбой проверки запрета
    await expect(ensureCodeForUser("u1")).rejects.toThrow(/не удалось проверить право приглашать/);
    expect(insertedRows).toHaveLength(0);
  });
});

describe("disableCodesOfUser (раунд исправлений 1: один RPC-вызов вместо двух UPDATE)", () => {
  it("зовёт RPC disable_invite_codes_of_user с userId и reason - ОДНИМ вызовом, не двумя UPDATE", async () => {
    rpcQueue.push({ data: { ok: true, disabled_count: 1 }, error: null });
    await disableCodesOfUser("u1", "leak");
    expect(rpcCalls).toEqual([{ name: "disable_invite_codes_of_user", params: { p_user_id: "u1", p_reason: "leak" } }]);
    // Реальных UPDATE через .from() здесь больше НЕТ - обе записи теперь
    // внутри SQL-функции (транзакция), а не в этом слое.
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("транспортная ошибка (error от драйвера) - бросает", async () => {
    rpcQueue.push({ data: null, error: { message: "connection refused" } });
    await expect(disableCodesOfUser("u1", "leak")).rejects.toThrow(/не удалось погасить/);
  });

  // ⛔ Раунд исправлений 1: сама функция БД тоже может вернуть { ok:false }
  // (например reason_required), не только ошибку транспорта - оба случая
  // обязаны одинаково честно бросать, а не тихо считаться успехом только
  // потому что error===null.
  it("функция БД вернула { ok:false } (без транспортной ошибки) - тоже бросает", async () => {
    rpcQueue.push({ data: { ok: false, error: "reason_required" }, error: null });
    await expect(disableCodesOfUser("u1", "")).rejects.toThrow(/reason_required/);
  });

  // Реальную атомарность ("если второй UPDATE внутри функции падает, первый
  // ОТКАТЫВАЕТСЯ") мок не проверяет - мок не исполняет SQL и не умеет
  // изображать транзакцию. Она проверена на живом Postgres:
  // src/lib/invite/disable-invite-codes.itest.ts (гоняется через
  // scripts/test-db/run-integration-tests.sh). Здесь, на уровне TS-обёртки,
  // важно лишь то, что ЛЮБОЙ неуспех (transport error ИЛИ !ok) превращается в
  // throw - дальше это забота уже транзакции внутри RPC, не этого файла.
});

describe("restoreInviteRight (Task 10)", () => {
  it("снимает персональный запрет приглашать", async () => {
    updateQueue.push({ error: null });
    await restoreInviteRight("u1");
    expect(updatedRows[0]).toEqual({ invite_revoked_at: null });
    expect(eqCalls).toContainEqual(["id", "u1"]);
  });

  it("сбой БД - бросает (иначе оператор жмёт «Восстановить», а право тихо остаётся закрытым)", async () => {
    updateQueue.push({ error: { message: "connection refused" } });
    await expect(restoreInviteRight("u1")).rejects.toThrow(/не удалось снять запрет/);
  });
});

describe("createMasterCode (Task 10)", () => {
  it("создаёт код без владельца с переданной подписью", async () => {
    insertQueue.push({ error: null });
    const code = await createMasterCode("Встреча в Ташкенте 2026-08-20");
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({ owner_id: null, label: "Встреча в Ташкенте 2026-08-20" });
  });

  it("коллизия кода трижды - бросает", async () => {
    for (let i = 0; i < 3; i++) {
      insertQueue.push({ error: { message: 'duplicate key value violates unique constraint "invite_codes_code_key"' } });
    }
    await expect(createMasterCode("test")).rejects.toThrow(/не удалось выпустить мастер-код/);
    expect(insertedRows).toHaveLength(3);
  });
});

// ⛔ Полная цепочка, явно требуемая ревью Task 8→10: погасили за утечку ->
// человек открывает «Пригласить» -> нового кода НЕ появляется. Отдельные
// describe-блоки выше уже проверяют каждую половину по отдельности - здесь
// они соединены в одном тесте, значение invite_revoked_at, ЗАПИСАННОЕ шагом
// disableCodesOfUser, дословно передаётся в шаг ensureCodeForUser (а не
// берётся с потолка), так что тест реально проверяет СТЫК двух функций, а не
// просто два независимых поведения по отдельности.
describe("самоотмена гашения за утечку - полная цепочка (Task 10)", () => {
  it("disableCodesOfUser('leak') закрывает право, и следующий ensureCodeForUser НЕ выпускает новый код", async () => {
    // Шаг 1: оператор гасит код за утечку из /admin/invites. RPC отвечает
    // тем же jsonb-контрактом, что и реальная disable_invite_codes_of_user
    // (миграция 20260811160000) - "at" ниже НЕ выдуман, это ровно то поле,
    // которое функция БД кладёт в ответ.
    rpcQueue.push({ data: { ok: true, disabled_count: 1, at: "2026-08-11T09:00:00.000Z" }, error: null });
    await disableCodesOfUser("u1", "leak");
    expect(rpcCalls[0]).toMatchObject({ name: "disable_invite_codes_of_user", params: { p_user_id: "u1", p_reason: "leak" } });

    // Шаг 2: человек (по-прежнему подтверждён и активен - гашение СТРОКИ его
    // статус не меняет) открывает экран «Пригласить». В реальной БД лукап
    // активного кода ничего не найдёт (строка погашена транзакцией шага 1), а
    // users.invite_revoked_at вернёт ИМЕННО тот момент, что записала та же
    // транзакция (значение из ответа шага 1, а не взятое с потолка).
    selectQueue.push({ data: null, error: null });
    selectQueue.push({ data: { invite_revoked_at: "2026-08-11T09:00:00.000Z" }, error: null });

    await expect(ensureCodeForUser("u1")).rejects.toBeInstanceOf(InviteRevokedError);
    expect(insertedRows).toHaveLength(0); // ГЛАВНАЯ проверка: новый код НЕ создан
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

  it("сбой БД - бросает (направление безопасное, но тихий провал вводит оператора в заблуждение)", async () => {
    updateQueue.push({ error: { message: "connection refused" } });
    await expect(reviveBanDisabledCodes("u1")).rejects.toThrow(/не удалось оживить/);
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

  it("сбой БД - бросает, а не тихий 0 (0 и 'не смогли посчитать' - разные факты)", async () => {
    selectQueue.push({ data: null, error: { message: "connection refused" }, count: 0 });
    await expect(countInvitedBy("u1")).rejects.toThrow(/не удалось посчитать/);
  });
});
