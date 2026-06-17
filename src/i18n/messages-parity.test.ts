import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Гарантирует, что словари локалей НЕ дрейфуют: каждый ключ есть и в ru, и в uz.
 * Пропущенный перевод иначе ломает текст UI у соответствующей локали (показывает
 * сырой ключ / падает). Тест валит сборку при первом же расхождении — как
 * parity-тест роутинга (см. client-paths.test.ts), но для i18n.
 */
function load(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"));
}

function keyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...keyPaths(v as Record<string, unknown>, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

describe("i18n message parity (ru ↔ uz)", () => {
  const ru = keyPaths(load("ru")).sort();
  const uz = keyPaths(load("uz")).sort();

  it("uz defines every key that ru has", () => {
    expect(ru.filter((k) => !uz.includes(k))).toEqual([]);
  });

  it("ru defines every key that uz has", () => {
    expect(uz.filter((k) => !ru.includes(k))).toEqual([]);
  });
});
