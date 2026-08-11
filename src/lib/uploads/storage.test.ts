import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted обязателен: vi.mock уезжает выше импорта ./storage, а фабрика
// вызывается уже при этом импорте - обычная const оказалась бы в TDZ, и тест
// падал бы на ReferenceError вместо проверки поведения.
const { uploadMock } = vi.hoisted(() => ({ uploadMock: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        createSignedUrls: vi.fn(async () => ({ data: [] })),
      }),
    },
  }),
}));

import { uploadFeedbackScreenshot, FEEDBACK_MAX_BYTES } from "./storage";

// 1x1 PNG - минимальный валидный файл с настоящими magic-байтами.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("uploadFeedbackScreenshot", () => {
  beforeEach(() => {
    uploadMock.mockReset();
    uploadMock.mockResolvedValue({ error: null });
  });

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
