import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Три исхода tryTransition, которые нельзя путать.
 *
 * ПОЧЕМУ этот тест появился. Раньше ЛЮБАЯ неудача перехода отдавалась наружу как
 * "wrong_step": и «шаг человека сменился», и «пользователя не нашли», и отказ
 * самой RPC (у неё свой SQL-вайтлист рёбер, который уже расходился с TS-таблицей
 * - коммит f5978ad добавлял туда ребро rejected -> pending_review). Два
 * последних случая шаг НЕ двигают, но клиент по коду wrong_step молча уводил
 * человека в корень, корень возвращал его на ту же страницу - и кнопка «Далее»
 * бесконечно перезагружала экран без единого сообщения.
 */

const singleMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: singleMock }) }),
    }),
    rpc: rpcMock,
  }),
}));

const { tryTransition } = await import("./transitions");

const USER = "39ede142-fb39-4a23-b639-fb3ed193f706";
/** Человек стоит на шаге анкеты - ровно как в прод-инциденте 12.08.2026. */
const CUR = {
  id: USER,
  onboarding_step: "profile_lifestyle",
  lifecycle_state: "onboarding",
  updated_at: "2026-08-12T14:44:30Z",
};

beforeEach(() => {
  singleMock.mockReset();
  rpcMock.mockReset();
  singleMock.mockResolvedValue({ data: CUR, error: null });
  rpcMock.mockResolvedValue({ data: { ok: true }, error: null });
  // Поломку машины переходов логируем - в тесте вывод глушим.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("tryTransition", () => {
  it("разрешённое ребро проходит", async () => {
    expect(
      await tryTransition(USER, { onboarding_step: "profile_health" }, "next", {
        kind: "user",
        id: USER,
      }),
    ).toEqual({ ok: true });
  });

  it("шаг сменился (ребра нет в графе) - wrong_step: повтор не поможет никогда", async () => {
    // Прод-механика: человек ушёл в анкету, а его тянут в needs_changes.
    expect(
      await tryTransition(USER, { onboarding_step: "needs_changes" }, "moderator decided", {
        kind: "admin",
      }),
    ).toEqual({ ok: false, error: "wrong_step" });
  });

  it("гонка по updated_at - conflict", async () => {
    rpcMock.mockResolvedValue({ data: { ok: false, error: "conflict" }, error: null });
    expect(
      await tryTransition(USER, { onboarding_step: "profile_health" }, "next", { kind: "user" }),
    ).toEqual({ ok: false, error: "conflict" });
  });

  it("пользователя не нашли - НЕ wrong_step: шаг остался прежним", async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: "no rows" } });
    expect(
      await tryTransition(USER, { onboarding_step: "profile_health" }, "next", { kind: "user" }),
    ).toEqual({ ok: false, error: "transition_failed" });
  });

  it("RPC отбила переход по своему вайтлисту - НЕ wrong_step, а поломка", async () => {
    // Расхождение графов TS и SQL: TS ребро пропустил, SQL отказал. Шаг человека
    // при этом не изменился, уводить его некуда - это ошибка, а не смена шага.
    rpcMock.mockResolvedValue({
      data: { ok: false, error: "illegal_verification_transition" },
      error: null,
    });
    expect(
      await tryTransition(USER, { onboarding_step: "profile_health" }, "next", { kind: "user" }),
    ).toEqual({ ok: false, error: "transition_failed" });
  });

  it("RPC не ответила (ошибка транспорта) - тоже поломка, а не смена шага", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    expect(
      await tryTransition(USER, { onboarding_step: "profile_health" }, "next", { kind: "user" }),
    ).toEqual({ ok: false, error: "transition_failed" });
  });

  it("пустой reason - поломка вызова, а не смена шага", async () => {
    expect(
      await tryTransition(USER, { onboarding_step: "profile_health" }, "", { kind: "user" }),
    ).toEqual({ ok: false, error: "transition_failed" });
  });
});
