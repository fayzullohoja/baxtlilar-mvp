import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted обязателен: vi.mock уезжает выше импорта ./storage, а фабрика
// вызывается уже при этом импорте - обычная const оказалась бы в TDZ, и тест
// падал бы на ReferenceError вместо проверки поведения.
const { uploadMock, removeMock, listMock, buckets } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  removeMock: vi.fn(),
  listMock: vi.fn(),
  buckets: [] as string[],
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    storage: {
      from: (bucket: string) => {
        buckets.push(bucket);
        return {
          upload: uploadMock,
          remove: removeMock,
          list: listMock,
          createSignedUrls: vi.fn(async () => ({ data: [] })),
        };
      },
    },
  }),
}));

import {
  uploadFeedbackScreenshot,
  removeFeedbackScreenshot,
  removeUserFeedbackScreenshots,
  FEEDBACK_MAX_BYTES,
  BUCKET_FEEDBACK,
} from "./storage";

// 1x1 PNG - минимальный валидный файл с настоящими magic-байтами.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

beforeEach(() => {
  buckets.length = 0;
  uploadMock.mockReset();
  uploadMock.mockResolvedValue({ error: null });
  removeMock.mockReset();
  removeMock.mockResolvedValue({ error: null });
  listMock.mockReset();
  listMock.mockResolvedValue({ data: [], error: null });
});

describe("uploadFeedbackScreenshot", () => {

  it("кладёт валидный png и возвращает путь внутри папки пользователя", async () => {
    const r = await uploadFeedbackScreenshot(
      "11111111-1111-1111-1111-111111111111",
      PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.byteLength) as ArrayBuffer,
    );
    expect(r.ok).toBe(true);
    // Путь обязан быть относительным бакета: удаление аккаунта уже отдаёт его
    // в storage.from(BUCKET_FEEDBACK).remove() как есть.
    if (r.ok) expect(r.path.startsWith("11111111-1111-1111-1111-111111111111/")).toBe(true);
  });

  it("отказывает файлу больше 5 МБ", async () => {
    const big = new ArrayBuffer(FEEDBACK_MAX_BYTES + 1);
    const r = await uploadFeedbackScreenshot("u1", big);
    expect(r).toEqual({ ok: false, error: "too_large" });
  });

  it("отказывает не-картинке", async () => {
    const notImage = new TextEncoder().encode("это просто текст");
    const r = await uploadFeedbackScreenshot("u1", notImage.buffer as ArrayBuffer);
    expect(r).toEqual({ ok: false, error: "bad_type" });
  });
});

// Парная к загрузке операция. Без неё файл, чья запись об отзыве не создалась
// (суточный лимит, сбой базы), остаётся на диске без единого указателя в базе.
describe("removeFeedbackScreenshot", () => {
  it("сносит файл из бакета отзывов", async () => {
    const ok = await removeFeedbackScreenshot("u1/1700000000000.png");
    expect(ok).toBe(true);
    expect(buckets).toEqual([BUCKET_FEEDBACK]);
    expect(removeMock).toHaveBeenCalledWith(["u1/1700000000000.png"]);
  });

  it("на пустом пути в хранилище не ходит", async () => {
    expect(await removeFeedbackScreenshot("")).toBe(false);
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("на ошибке адаптера возвращает false, а не бросает", async () => {
    // Адаптер не бросает, а отдаёт {data:null,error} - без явной проверки
    // сбой чистки выглядел бы успехом.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    removeMock.mockResolvedValue({ error: { message: "disk full" } });
    expect(await removeFeedbackScreenshot("u1/1.png")).toBe(false);
    errSpy.mockRestore();
  });
});

describe("removeUserFeedbackScreenshots", () => {
  it("сносит все файлы из папки человека, а не только известные базе", async () => {
    // Второй файл осиротевший: записи с таким screenshot_path в базе нет, и по
    // ссылкам из базы его не найти - только обходом папки.
    listMock.mockResolvedValue({
      data: [{ name: "1700000000000.png" }, { name: "1700000060000.png" }],
      error: null,
    });

    const n = await removeUserFeedbackScreenshots("u1");

    expect(n).toBe(2);
    expect(listMock).toHaveBeenCalledWith("u1");
    expect(removeMock).toHaveBeenCalledWith(["u1/1700000000000.png", "u1/1700000060000.png"]);
  });

  it("пустая папка - на удаление не ходим", async () => {
    expect(await removeUserFeedbackScreenshots("u1")).toBe(0);
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("на ошибке перечисления возвращает 0, а не бросает", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    listMock.mockResolvedValue({ data: null, error: { message: "bad bucket" } });
    expect(await removeUserFeedbackScreenshots("u1")).toBe(0);
    expect(removeMock).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
