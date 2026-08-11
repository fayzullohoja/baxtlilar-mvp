import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ rpc: rpcMock }),
}));

import { createFeedback } from "./store";

const base = {
  userId: "11111111-1111-1111-1111-111111111111",
  rating: 5,
  body: "Всё нравится",
  screenshotPath: null,
  locale: "ru",
};

describe("createFeedback", () => {
  beforeEach(() => rpcMock.mockReset());

  it("возвращает id, когда процедура вставила запись", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          feedback_id: "22222222-2222-2222-2222-222222222222",
          limited: false,
          deduplicated: false,
          screenshot_stored: false,
        },
      ],
      error: null,
    });
    const r = await createFeedback(base);
    expect(r).toEqual({
      ok: true,
      id: "22222222-2222-2222-2222-222222222222",
      deduplicated: false,
      screenshotStored: false,
    });
  });

  it("возвращает rate_limited, когда лимит исчерпан", async () => {
    rpcMock.mockResolvedValue({ data: [{ feedback_id: null, limited: true }], error: null });
    const r = await createFeedback(base);
    expect(r).toEqual({ ok: false, error: "rate_limited" });
  });

  it("возвращает db_failed на ошибке адаптера, а не молча успех", async () => {
    // Адаптер БД не бросает, а отдаёт {data:null,error} - молчаливый успех
    // здесь означал бы, что человек увидел благодарность за потерянный отзыв.
    rpcMock.mockResolvedValue({ data: null, error: { message: "connection refused" } });
    const r = await createFeedback(base);
    expect(r).toEqual({ ok: false, error: "db_failed" });
  });

  // Тест выше проверяет пару {data:null,error}, а её ловит и проверка пустого
  // результата ниже - то есть проверку error из кода можно удалить, и оба теста
  // всё равно пройдут. Здесь ошибка приходит ВМЕСТЕ с похожей на успех строкой:
  // так отличить "сбой" от "вставили" может только явная проверка error, и её
  // пропажа сразу видна. Направление важно: без неё человека благодарят за
  // отзыв, которого в базе нет.
  it("возвращает db_failed, когда при ошибке адаптера в data лежит похожая на успех строка", async () => {
    rpcMock.mockResolvedValue({
      data: [{ feedback_id: "22222222-2222-2222-2222-222222222222", limited: false }],
      error: { message: "connection refused" },
    });
    const r = await createFeedback(base);
    expect(r).toEqual({ ok: false, error: "db_failed" });
  });

  it("возвращает db_failed, когда процедура вернула пустой результат", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    const r = await createFeedback(base);
    expect(r).toEqual({ ok: false, error: "db_failed" });
  });

  it("передаёт скриншот и локаль в процедуру", async () => {
    rpcMock.mockResolvedValue({
      data: [{ feedback_id: "id-1", limited: false, deduplicated: false, screenshot_stored: true }],
      error: null,
    });
    await createFeedback({ ...base, screenshotPath: "u/1.png", locale: "uz" });
    expect(rpcMock).toHaveBeenCalledWith("create_feedback", {
      p_user_id: base.userId,
      p_rating: 5,
      p_body: "Всё нравится",
      p_screenshot_path: "u/1.png",
      p_locale: "uz",
    });
  });

  // Дальше - третий исход процедуры. Дедуп двойного тапа возвращает СТАРУЮ
  // запись, и раньше он был байт-в-байт неотличим от вставки: роут отвечал
  // "скриншот сохранён" и не сносил только что загруженный файл. Ниже три
  // случая, ради которых исход и вынесен в контракт.

  it("дедуп отличим от вставки: отброшенный скриншот не выдаётся за сохранённый", async () => {
    // Человек прислал файл, но процедура нашла запись минутной давности, у
    // которой скриншот уже есть - этот файл не пригодился. Роут обязан его
    // снести и не говорить человеку, что скриншот приложен.
    rpcMock.mockResolvedValue({
      data: [
        {
          feedback_id: "33333333-3333-3333-3333-333333333333",
          limited: false,
          deduplicated: true,
          screenshot_stored: false,
        },
      ],
      error: null,
    });
    const r = await createFeedback({ ...base, screenshotPath: "u/2.png" });
    expect(r).toEqual({
      ok: true,
      id: "33333333-3333-3333-3333-333333333333",
      deduplicated: true,
      screenshotStored: false,
    });
  });

  it("дедуп прикрепил скриншот к найденной записи - файл сносить нельзя", async () => {
    // Человек отправил отзыв без картинки, спохватился и в ту же минуту
    // повторил отправку со скриншотом: процедура прикрепила файл к старой
    // записи, значит на него теперь ссылается база.
    rpcMock.mockResolvedValue({
      data: [
        {
          feedback_id: "33333333-3333-3333-3333-333333333333",
          limited: false,
          deduplicated: true,
          screenshot_stored: true,
        },
      ],
      error: null,
    });
    const r = await createFeedback({ ...base, screenshotPath: "u/2.png" });
    expect(r).toEqual({
      ok: true,
      id: "33333333-3333-3333-3333-333333333333",
      deduplicated: true,
      screenshotStored: true,
    });
  });

  it("скриншота не присылали - screenshotStored всегда false", async () => {
    // Сносить и рассказывать человеку нечего: файла в этой отправке не было.
    rpcMock.mockResolvedValue({
      data: [{ feedback_id: "id-1", limited: false, deduplicated: false, screenshot_stored: true }],
      error: null,
    });
    const r = await createFeedback(base);
    expect(r).toEqual({ ok: true, id: "id-1", deduplicated: false, screenshotStored: false });
  });

  it("процедура без нового столбца: скриншот считаем сохранённым, а не сносим файл", async () => {
    // Старая версия create_feedback в базе (окно выката) столбца не вернёт.
    // Из двух ошибок выбираем обратимую: осиротевший файл подметает
    // removeUserFeedbackScreenshots обходом папки, а снесённый файл, на
    // который ссылается запись, не вернуть ничем - модератор увидит битую
    // картинку.
    rpcMock.mockResolvedValue({
      data: [{ feedback_id: "id-1", limited: false }],
      error: null,
    });
    const r = await createFeedback({ ...base, screenshotPath: "u/1.png" });
    expect(r).toEqual({ ok: true, id: "id-1", deduplicated: false, screenshotStored: true });
  });
});
