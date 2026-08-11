import { describe, it, expect, vi, beforeEach } from "vitest";
import { M } from "./messages";

// --- Мокаем внешние зависимости хендлеров ---------------------------------
// Блок ниже - копия строк 1-45 commands.test.ts (тот же паттерн мока bot-api/
// env/supabaseAdmin), плюс два мока, которых там не было и без которых наш
// сценарий не соберётся: @/lib/invite/gate (сам шлагбаум) и
// @/lib/state-machine/transitions (тексты кода-приглашения переводят шаг
// через tryTransition - без мока он полез бы в supabaseAdmin().rpc(...),
// которого в мини-чейне ниже нет, и упал бы с "sb.rpc is not a function").

// Захватываем исходящие сообщения бота.
const sent: Array<{ chatId: number; text: string; markup?: unknown; parseMode?: string }> = [];
const menuBtns: Array<{ chatId: number; button: { type: string; text?: string; web_app?: { url: string } } }> = [];
const answered: string[] = [];
vi.mock("../bot-api", () => ({
  sendMessage: vi.fn((chatId: number, text: string, markup?: unknown, parseMode?: string) => {
    sent.push({ chatId, text, markup, parseMode });
    return Promise.resolve(true);
  }),
  answerCallbackQuery: vi.fn((id: string) => {
    answered.push(id);
    return Promise.resolve(true);
  }),
  setChatMenuButton: vi.fn((chatId: number, button: { type: string; text?: string; web_app?: { url: string } }) => {
    menuBtns.push({ chatId, button });
    return Promise.resolve(true);
  }),
}));

vi.mock("@/lib/env", () => ({
  env: () => ({
    APP_URL: "https://app.example",
    SUPPORT_URL: "https://t.me/baxtlilar_support",
    SESSION_SECRET: "0123456789012345678901234567890123456789",
    TELEGRAM_BOT_TOKEN: "test-token-0000000000",
  }),
}));

// Текущий юзер, который вернёт findByTg; тесты его подменяют. ВАЖНО: мок
// select()-цепочки отдаёт СЫРОЙ currentUser (не копию) - мутация поля прямо
// на объекте user внутри handleStart (см. коммент в handlers.ts про
// устаревший снимок после redeemCode) поэтому видна и следующему findByTg
// в том же тесте. Это намеренно: реальная БД вела бы себя так же после
// настоящего UPDATE, а тест так проверяет, что мы читаем актуальное состояние,
// а не носим протухший снимок дальше по цепочке вызовов.
let currentUser: Record<string, unknown> | null = null;
const updateSpy = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          neq: () => ({ maybeSingle: () => Promise.resolve({ data: currentUser, error: null }) }),
        }),
      }),
      update: updateSpy,
    }),
  }),
}));

// --- @/lib/invite/gate ------------------------------------------------------
// needsInviteStep здесь НЕ игнорирует аргумент (в отличие от буквального
// примера из брифа Task 7) - для теста самовосстановления и теста "пришёл по
// ссылке" важно, что мок реально смотрит на invite_redeemed_at/invite_exempt
// переданного юзера, а не просто отдаёт gateOn вслепую. redeemResult -
// управляемая переменная: по умолчанию решает по подстроке "GOOD"/иначе
// not_found, но тест на погашенный код обязан уметь подставить reason:"disabled".
let gateOn = true;
let redeemResult: { ok: true } | { ok: false; reason: "not_found" | "disabled" | "self" } | null = null;
const redeemCodeMock = vi.fn((_userId: string, raw: string) =>
  Promise.resolve(
    redeemResult ??
      (raw.toUpperCase().includes("GOOD") ? { ok: true } : { ok: false, reason: "not_found" as const }),
  ),
);
vi.mock("@/lib/invite/gate", () => ({
  needsInviteStep: (u: { invite_redeemed_at: string | null; invite_exempt: boolean }) =>
    Promise.resolve(gateOn && !u.invite_redeemed_at && !u.invite_exempt),
  redeemCode: (userId: string, raw: string) => redeemCodeMock(userId, raw),
}));

// --- @/lib/state-machine/transitions ----------------------------------------
let transitionOk = true;
const transitionCalls: Array<{ userId: string; patch: unknown; reason: string }> = [];
vi.mock("@/lib/state-machine/transitions", () => ({
  tryTransition: (userId: string, patch: unknown, reason: string) => {
    transitionCalls.push({ userId, patch, reason });
    return Promise.resolve(
      transitionOk ? { ok: true } : { ok: false, error: "wrong_step" as const },
    );
  },
}));

import { handleUpdate, promptStep } from "./handlers";

function hasWebApp(markup: unknown): boolean {
  const kb = (markup as { inline_keyboard?: Array<Array<{ web_app?: unknown }>> })?.inline_keyboard;
  return !!kb?.some((row) => row.some((b) => !!b.web_app));
}

function textMsg(text: string, tgId = 1): { update_id: number; message: unknown } {
  return {
    update_id: 1,
    message: { message_id: 1, from: { id: tgId, is_bot: false, language_code: "ru" }, chat: { id: tgId }, text },
  };
}

function cbUpdate(data: string, tgId = 1): { update_id: number; callback_query: unknown } {
  return {
    update_id: 2,
    callback_query: {
      id: "cb1",
      from: { id: tgId, is_bot: false, language_code: "ru" },
      message: { message_id: 5, chat: { id: tgId } },
      data,
    },
  };
}

beforeEach(() => {
  sent.length = 0;
  menuBtns.length = 0;
  answered.length = 0;
  transitionCalls.length = 0;
  currentUser = null;
  gateOn = true;
  redeemResult = null;
  transitionOk = true;
  updateSpy.mockClear();
  redeemCodeMock.mockClear();
});

describe("шаг кода в боте", () => {
  it("на шаге bot_invite_code бот просит код", async () => {
    currentUser = {
      id: "u1",
      telegram_id: 1,
      language: "ru",
      onboarding_step: "bot_invite_code",
      lifecycle_state: "onboarding",
    };
    await promptStep(1, currentUser as never);
    expect(sent.at(-1)?.text).toContain(M.invite_ask.ru.slice(0, 20));
  });

  it("верный код ведёт дальше и благодарит", async () => {
    currentUser = {
      id: "u1",
      telegram_id: 1,
      language: "ru",
      onboarding_step: "bot_invite_code",
      lifecycle_state: "onboarding",
    };
    await handleUpdate(textMsg("GOOD12") as never);
    expect(sent.some((s) => s.text.includes(M.invite_accepted.ru))).toBe(true);
    // и следом идёт оферта - шаг реально продвинулся, а не просто похвалил
    expect(sent.some((s) => s.text.includes("Baxtlilar"))).toBe(true);
    expect(transitionCalls).toHaveLength(1);
    expect(transitionCalls[0].patch).toMatchObject({ onboarding_step: "bot_consent_pd" });
  });

  it("неверный код оставляет на шаге и объясняет", async () => {
    currentUser = {
      id: "u1",
      telegram_id: 1,
      language: "ru",
      onboarding_step: "bot_invite_code",
      lifecycle_state: "onboarding",
    };
    await handleUpdate(textMsg("BAD999") as never);
    expect(sent.some((s) => s.text.includes(M.invite_not_found.ru))).toBe(true);
    // никакого перехода шага не было
    expect(transitionCalls).toHaveLength(0);
  });

  // Task 6: погашенный код и "кода нет вообще" - РАЗНЫЕ причины отказа, и
  // текст для человека обязан различаться (иначе владелец погашенного кода
  // бесконечно "проверяет раскладку" вместо того, чтобы попросить новый).
  it("погашенный код даёт СВОЙ текст, а не «такого кода нет»", async () => {
    currentUser = {
      id: "u1",
      telegram_id: 1,
      language: "ru",
      onboarding_step: "bot_invite_code",
      lifecycle_state: "onboarding",
    };
    redeemResult = { ok: false, reason: "disabled" };
    await handleUpdate(textMsg("DEAD01") as never);
    expect(sent.some((s) => s.text.includes(M.invite_disabled.ru))).toBe(true);
    expect(sent.some((s) => s.text.includes(M.invite_not_found.ru))).toBe(false);
  });

  it("кнопка «Нет кода?» отвечает объяснением", async () => {
    currentUser = {
      id: "u1",
      telegram_id: 1,
      language: "ru",
      onboarding_step: "bot_invite_code",
      lifecycle_state: "onboarding",
    };
    await handleUpdate(cbUpdate("inv:help") as never);
    expect(answered).toContain("cb1");
    expect(sent.some((s) => s.text === M.invite_no_code_text.ru)).toBe(true);
  });

  it("выбор языка без кода при включённом шлагбауме ведёт на экран кода", async () => {
    currentUser = {
      id: "u1",
      telegram_id: 1,
      language: "ru",
      onboarding_step: "bot_language",
      lifecycle_state: "onboarding",
      invite_redeemed_at: null,
      invite_exempt: false,
    };
    await handleUpdate(cbUpdate("lang:ru") as never);
    expect(sent.some((s) => s.text.includes(M.invite_ask.ru.slice(0, 20)))).toBe(true);
    expect(transitionCalls.at(-1)?.patch).toMatchObject({ onboarding_step: "bot_invite_code" });
  });

  // Приход по ссылке-приглашению (t.me/bot?start=КОД) до выбора языка должен
  // зачесть код молча и пропустить экран bot_invite_code целиком - следующий
  // экран после выбора языка сразу оферта.
  it("приход по ссылке-приглашению пропускает экран ввода кода", async () => {
    currentUser = {
      id: "u1",
      telegram_id: 1,
      language: "ru",
      onboarding_step: "bot_language",
      lifecycle_state: "onboarding",
      invite_redeemed_at: null,
      invite_exempt: false,
    };
    // Шаг 1: /start с payload-кодом из ссылки.
    await handleUpdate(textMsg("/start GOODLINK") as never);
    expect(redeemCodeMock).toHaveBeenCalledWith("u1", "GOODLINK");

    sent.length = 0; // интересует только то, что произойдёт ПОСЛЕ выбора языка
    // Шаг 2: пользователь выбирает язык.
    await handleUpdate(cbUpdate("lang:ru") as never);

    expect(sent.some((s) => s.text.includes(M.invite_ask.ru.slice(0, 20)))).toBe(false);
    expect(sent.some((s) => s.text.includes("Документы Baxtlilar"))).toBe(true);
    expect(transitionCalls.at(-1)?.patch).toMatchObject({ onboarding_step: "bot_consent_pd" });
  });

  // ⛔ Цепочка обхода из ревью Task 4: пользователь стоит на шаге ввода кода
  // и пишет боту /app. Раньше BOT_STEPS не знал про bot_invite_code -> бот
  // решал, что бот-часть пройдена, и слал РАБОЧУЮ кнопку мини-аппа (a на
  // бэкенде BOT_OR_LEGACY_STEPS тоже не знал шаг и выдал бы сессию). Проверяем
  // именно ОТСУТСТВИЕ web_app-кнопки - проверка одного текста не поймала бы
  // регресс, если бы кто-то по ошибке добавил кнопку рядом с текстом.
  it("цепочка обхода: /app на шаге кода НЕ шлёт рабочую кнопку мини-аппа", async () => {
    currentUser = {
      id: "u1",
      telegram_id: 1,
      language: "ru",
      onboarding_step: "bot_invite_code",
      lifecycle_state: "onboarding",
    };
    await handleUpdate(textMsg("/app") as never);
    expect(sent.some((s) => hasWebApp(s.markup))).toBe(false);
    expect(sent.at(-1)?.text).toContain(M.invite_ask.ru.slice(0, 20));
  });

  // "ВТОРОЕ" из задания: needsInviteStep fail-closed на сбое БД -> человека
  // могло отправить на шаг кода транзиентно, хотя шлагбаум на самом деле уже
  // не требуется (снят / человек exempt). Раз назад в bot_language пути нет
  // (ALLOWED_TRANSITIONS.bot_invite_code = ["bot_consent_pd"]), решение обязано
  // пересчитываться при КАЖДОМ входе на этот шаг, а не быть зафиксировано
  // единожды - иначе это тупик без единого легального выхода, кроме кода,
  // которого у человека нет.
  it("самовосстановление: если шлагбаум уже не требуется, promptStep сам продвигает вперёд", async () => {
    currentUser = {
      id: "u1",
      telegram_id: 1,
      language: "ru",
      onboarding_step: "bot_invite_code",
      lifecycle_state: "onboarding",
      invite_redeemed_at: null,
      invite_exempt: false,
    };
    gateOn = false; // например, реальный флаг invite_gate уже снят
    await promptStep(1, currentUser as never);
    expect(sent.some((s) => s.text.includes(M.invite_ask.ru.slice(0, 20)))).toBe(false);
    expect(sent.some((s) => s.text.includes("Документы Baxtlilar"))).toBe(true);
    expect(transitionCalls.at(-1)?.patch).toMatchObject({ onboarding_step: "bot_consent_pd" });
  });

  it("самовосстановление откладывается, если сам переход конфликтует: человек не остаётся без ответа", async () => {
    currentUser = {
      id: "u1",
      telegram_id: 1,
      language: "ru",
      onboarding_step: "bot_invite_code",
      lifecycle_state: "onboarding",
      invite_redeemed_at: null,
      invite_exempt: false,
    };
    gateOn = false;
    transitionOk = false; // гонка/конфликт optimistic concurrency
    await promptStep(1, currentUser as never);
    // Не молчим и не падаем - показываем обычный экран кода как fallback.
    expect(sent.at(-1)?.text).toContain(M.invite_ask.ru.slice(0, 20));
  });
});

// ⛔ Регрессионный гвард на баг, который поведенческий мок supabaseAdmin выше
// принципиально не ловит: .maybeSingle() в моке отдаёт ВЕСЬ currentUser
// целиком, что бы ни было перечислено в .select(...) - в реальном PostgREST
// вернулись бы РОВНО перечисленные колонки. Если invite_redeemed_at/
// invite_exempt пропадут из select() в findByTg, они придут undefined и
// needsInviteStep будет fail-closed отвечать "нужен код" всем подряд, включая
// тех, кто вошёл до запуска шлагбаума, - а ни один тест выше этого не
// заметит, потому что мок всё равно отдаёт currentUser с этими полями.
// Единственная честная проверка - прочитать исходник и убедиться, что
// колонки реально перечислены в select() этой функции.
describe("findByTg реально выбирает invite-колонки (см. предупреждение задания)", () => {
  it("select() в findByTg перечисляет invite_redeemed_at и invite_exempt", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("./handlers.ts", import.meta.url), "utf8");
    const m = src.match(/async function findByTg[\s\S]*?\.select\(\s*\n?\s*"([^"]+)"/);
    expect(m).not.toBeNull();
    const cols = m?.[1] ?? "";
    expect(cols).toContain("invite_redeemed_at");
    expect(cols).toContain("invite_exempt");
  });
});
