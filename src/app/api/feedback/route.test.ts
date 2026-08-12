import { describe, it, expect, vi, beforeEach } from "vitest";

const loadMock = vi.fn();
const createMock = vi.fn();
const uploadMock = vi.fn();
const removeMock = vi.fn();

vi.mock("@/lib/auth/active-guard", () => ({
  loadActiveUserApi: (...a: unknown[]) => loadMock(...a),
}));
vi.mock("@/lib/feedback/store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/feedback/store")>("@/lib/feedback/store");
  return { ...actual, createFeedback: (...a: unknown[]) => createMock(...a) };
});
vi.mock("@/lib/uploads/storage", () => ({
  uploadFeedbackScreenshot: (...a: unknown[]) => uploadMock(...a),
  removeFeedbackScreenshot: (...a: unknown[]) => removeMock(...a),
}));

import { POST } from "./route";

function req(fields: Record<string, string>, file?: File): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (file) fd.append("file", file);
  return new Request("http://localhost/api/feedback", { method: "POST", body: fd });
}

const PNG = new File([new Uint8Array([1, 2, 3])], "s.png", { type: "image/png" });

describe("POST /api/feedback", () => {
  beforeEach(() => {
    loadMock.mockReset().mockResolvedValue({ user: { id: "u1" }, res: null });
    createMock.mockReset().mockResolvedValue({
      ok: true,
      id: "f1",
      deduplicated: false,
      screenshotStored: true,
    });
    uploadMock.mockReset().mockResolvedValue({
      ok: true,
      path: "u1/1.png",
      type: "image/png",
      sha256: "x",
    });
    removeMock.mockReset().mockResolvedValue(true);
  });

  it("отказывает без оценки", async () => {
    const r = await POST(req({ body: "текст" }) as never);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: "no_rating" });
  });

  it("отказывает оценке вне 1-5 - запрос в обход формы", async () => {
    const r = await POST(req({ rating: "99" }) as never);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: "bad_rating" });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("принимает одну оценку без текста и файла", async () => {
    const r = await POST(req({ rating: "5" }) as never);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, screenshot: "none" });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", rating: 5, body: null, screenshotPath: null }),
    );
  });

  it("отказывает тексту длиннее предела", async () => {
    const r = await POST(req({ rating: "4", body: "я".repeat(1001) }) as never);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: "body_too_long" });
  });

  it("отвечает 429 при исчерпанном лимите - своим кодом, не общим rate_limited", async () => {
    // Код обязан отличаться от rate_limited: тем же телом отвечает глобальный
    // лимитер в src/proxy.ts, который отбивает запрос ДО роута (ведро IP_API
    // общее на весь IP, а за CGNAT-адресом оператора десятки людей). Пока коды
    // совпадали, форма показывала первому же соседу по IP «Вы уже оставили три
    // отзыва за сутки» - человеку, у которого отзывов ноль.
    createMock.mockResolvedValue({ ok: false, error: "rate_limited" });
    const r = await POST(req({ rating: "3" }) as never);
    expect(r.status).toBe(429);
    const body = await r.json();
    expect(body).toEqual({ ok: false, error: "feedback_limit" });
    expect(body.error).not.toBe("rate_limited");
  });

  it("сохраняет отзыв, даже если скриншот не загрузился", async () => {
    // Спека: сбой загрузки файла НЕ должен терять оценку и текст.
    uploadMock.mockResolvedValue({ ok: false, error: "upload_failed" });
    const r = await POST(req({ rating: "2", body: "сломалось" }, PNG) as never);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, screenshot: "failed" });
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ screenshotPath: null }));
  });

  it("отказывает слишком большому файлу до записи отзыва", async () => {
    uploadMock.mockResolvedValue({ ok: false, error: "too_large" });
    const r = await POST(req({ rating: "2" }, PNG) as never);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: "too_large" });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("отвечает 500 на сбое базы", async () => {
    createMock.mockResolvedValue({ ok: false, error: "db_failed" });
    const r = await POST(req({ rating: "5" }) as never);
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ ok: false, error: "db_failed" });
  });

  it("сносит уже загруженный файл при исчерпанном лимите", async () => {
    // Лимит - единственный отказ, про который известно, что вставки НЕ было:
    // процедура возвращает limited до всякого insert. Значит указателя на файл
    // в базе нет ни секунды, и без сноса он остаётся мусором, которого не найти.
    createMock.mockResolvedValue({ ok: false, error: "rate_limited" });
    const r = await POST(req({ rating: "3" }, PNG) as never);
    expect(r.status).toBe(429);
    expect(removeMock).toHaveBeenCalledWith("u1/1.png");
  });

  it("не сносит скриншот на сбое базы - запись могла закоммититься", async () => {
    // Обрыв связи после COMMIT выглядит как db_failed: строка со screenshot_path
    // есть, а роут об этом не знает. Снос тут оставил бы модератору битую
    // картинку вместо доказательства поломки, и вернуть файл нечем.
    createMock.mockResolvedValue({ ok: false, error: "db_failed" });
    const r = await POST(req({ rating: "5" }, PNG) as never);
    expect(r.status).toBe(500);
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("сохранённый отзыв свой скриншот не сносит", async () => {
    await POST(req({ rating: "5" }, PNG) as never);
    // Путь загруженного файла обязан доехать до записи: без этой проверки
    // передача null вместо него прошла бы зелёной, а роут по собственной ветке
    // «дедуп не прикрепил» снёс бы файл, отчитавшись человеку «скриншот сохранён».
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ screenshotPath: "u1/1.png" }),
    );
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("сносит файл, который дедуп не прикрепил к найденной записи", async () => {
    // Повтор отправки в пределах минуты: процедура вернула СТАРУЮ запись, а у
    // неё скриншот уже свой - только что загруженный файл не пригодился и
    // указателя в базе не получил. Человеку это не ошибка: скриншот у отзыва
    // есть, поэтому статус остаётся "saved".
    createMock.mockResolvedValue({ ok: true, id: "f1", deduplicated: true, screenshotStored: false });
    const r = await POST(req({ rating: "5" }, PNG) as never);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, screenshot: "saved" });
    expect(removeMock).toHaveBeenCalledWith("u1/1.png");
  });

  it("прикреплённый дедупом скриншот не сносит", async () => {
    // Человек добавил забытую картинку повторной отправкой - процедура
    // прикрепила её к старой записи, значит на файл теперь ссылается база.
    createMock.mockResolvedValue({ ok: true, id: "f1", deduplicated: true, screenshotStored: true });
    await POST(req({ rating: "5" }, PNG) as never);
    expect(removeMock).not.toHaveBeenCalled();
  });
});
