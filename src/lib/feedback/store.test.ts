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
      data: [{ feedback_id: "22222222-2222-2222-2222-222222222222", limited: false }],
      error: null,
    });
    const r = await createFeedback(base);
    expect(r).toEqual({ ok: true, id: "22222222-2222-2222-2222-222222222222" });
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
    rpcMock.mockResolvedValue({ data: [{ feedback_id: "id-1", limited: false }], error: null });
    await createFeedback({ ...base, screenshotPath: "u/1.png", locale: "uz" });
    expect(rpcMock).toHaveBeenCalledWith("create_feedback", {
      p_user_id: base.userId,
      p_rating: 5,
      p_body: "Всё нравится",
      p_screenshot_path: "u/1.png",
      p_locale: "uz",
    });
  });
});
