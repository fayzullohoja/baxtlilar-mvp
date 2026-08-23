import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_ERROR_KEYS, uploadErrorKey } from "./error-copy";

/**
 * Страж честности сообщений на экранах загрузки документов.
 *
 * История: обе формы загрузки подписывали половину ошибок неверно. Человек с
 * правильным JPEG видел «неподходящий формат» и пересохранял снимок по кругу,
 * хотя настоящей причиной был чёрный список документов или решение модератора.
 *
 * Тест держит три вещи:
 *   1) каждый код, который РЕАЛЬНО отдают роуты загрузки и proxy, есть в словаре;
 *   2) у каждого ключа словаря есть подпись во всех четырёх языках;
 *   3) неизвестный код честно падает в общий текст, а не роняет экран.
 */

const LOCALES = ["ru", "uz", "tr", "en"] as const;

function messages(loc: string): Record<string, unknown> {
  const p = path.join(process.cwd(), "messages", `${loc}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** Коды ошибок, встречающиеся в роутах загрузки документов и в proxy. */
function codesFromRoutes(): string[] {
  const files = [
    "src/app/api/onboarding/document/route.ts",
    "src/app/api/onboarding/selfie/route.ts",
    "src/app/api/onboarding/fix/route.ts",
    "src/proxy.ts",
  ];
  const found = new Set<string>();
  for (const f of files) {
    const src = fs.readFileSync(path.join(process.cwd(), f), "utf8");
    for (const m of src.matchAll(/error:\s*"([a-z_]+)"/g)) found.add(m[1]);
  }
  return [...found];
}

describe("подписи ошибок загрузки", () => {
  it("каждый код из роутов и proxy имеет свою подпись", () => {
    // no_session/feature_disabled и подобные могут приходить с любого слоя -
    // важно, что ни один не остаётся без осмысленного текста.
    const unmapped = codesFromRoutes().filter(
      (c) => !(c in UPLOAD_ERROR_KEYS) && c !== "no_session",
    );
    expect(
      unmapped,
      `Эти коды роуты отдают, а словарь их не знает - человек увидит общее ` +
        `«не удалось загрузить» вместо причины: ${unmapped.join(", ")}`,
    ).toEqual([]);
  });

  for (const loc of LOCALES) {
    it(`${loc}: у каждого ключа словаря есть текст`, () => {
      const m = messages(loc) as { Upload?: { errors?: Record<string, string> } };
      const errors = m.Upload?.errors ?? {};
      const needed = new Set([...Object.values(UPLOAD_ERROR_KEYS), "failed"]);
      const missing = [...needed].filter((k) => !errors[k]);
      expect(missing, `нет подписей в ${loc}: ${missing.join(", ")}`).toEqual([]);
    });
  }

  it("неизвестный код падает в общий текст, а не роняет экран", () => {
    expect(uploadErrorKey("что-то_новое")).toBe("failed");
    expect(uploadErrorKey(undefined)).toBe("failed");
    expect(uploadErrorKey(null)).toBe("failed");
  });

  it("размер файла подписан одинаково, с какого бы слоя ни пришёл", () => {
    // Роут отдаёт too_large, а proxy отбивает раньше и отдаёт payload_too_large.
    // Для человека это одна и та же беда, и текст обязан быть один.
    expect(uploadErrorKey("too_large")).toBe(uploadErrorKey("payload_too_large"));
  });
});
