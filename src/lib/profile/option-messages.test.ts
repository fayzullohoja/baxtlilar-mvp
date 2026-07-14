import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { OPTION_GROUPS } from "./options";
import { GENDERED_OVERRIDES } from "./gender-wording";

/**
 * Лейблы вариантов ответа как обычные i18n-строки: `Options.<GROUP>.<value>`
 * (конструктор текстовок Tier 2) — чтобы они правились в /admin/content той же
 * машинерией, что и тексты экранов (оверлей, кэш, валидация, аудит).
 *
 * Этот файл — ОДНОВРЕМЕННО генератор и страж дрейфа:
 *  - `GEN_OPTIONS=1 npx vitest run src/lib/profile/option-messages.test.ts`
 *    (пере)генерирует namespace `Options` во всех 4 локалях, СОХРАНЯЯ уже
 *    отредактированные лейблы (перезаписывает только отсутствующие ключи);
 *  - без флага — проверяет, что набор ключей в messages ровно совпадает с
 *    options.ts. Добавили опцию и забыли сгенерить → тест падает. Без этого
 *    юзер увидел бы сырой ключ (а с fallback в optLabel — старый базовый лейбл).
 *
 * en/tr СИДИРУЮТСЯ из ru — это ровно сегодняшнее поведение (labelOf отдавал ru
 * для любой не-uz локали). Не перевод, а сид: дальше правится в админке.
 * Сравниваем КЛЮЧИ, не значения — правка лейбла не должна ронять тест.
 */

const LOCALES = ["ru", "uz", "en", "tr"] as const;
const MSG_DIR = path.resolve(process.cwd(), "messages");
const GEN = process.env.GEN_OPTIONS === "1";

type Ns = Record<string, Record<string, string>>;

function baseOptions(locale: string): Ns {
  const uz = locale === "uz";
  const out: Ns = {};
  for (const [group, opts] of Object.entries(OPTION_GROUPS)) {
    out[group] = {};
    for (const o of opts) {
      out[group][o.value] = uz ? o.uz : o.ru;
    }
  }
  // Гендерные варианты — тоже редактируемые ключи `<value>__m` / `<value>__f`.
  // Без них оунер правил бы «Холост» в админке и ничего бы не менялось: пол
  // известен у всех верифицированных, т.е. код-вариант всегда бы побеждал.
  for (const [group, byValue] of Object.entries(GENDERED_OVERRIDES)) {
    for (const [value, entry] of Object.entries(byValue)) {
      for (const g of ["m", "f"] as const) {
        const lab = entry[g];
        if (lab) out[group][`${value}__${g}`] = uz ? lab.uz : lab.ru;
      }
    }
  }
  return out;
}

const keysOf = (ns: Ns): string[] =>
  Object.entries(ns)
    .flatMap(([g, vs]) => Object.keys(vs).map((v) => `${g}.${v}`))
    .sort();

describe("Options.* ↔ options.ts", () => {
  for (const locale of LOCALES) {
    it(`${locale}.json: ключи Options совпадают с options.ts`, () => {
      const file = path.join(MSG_DIR, `${locale}.json`);
      const msgs = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
      const want = baseOptions(locale);

      if (GEN) {
        const prev = (msgs.Options ?? {}) as Ns;
        const next: Ns = {};
        for (const [g, opts] of Object.entries(want)) {
          next[g] = {};
          for (const [v, base] of Object.entries(opts)) {
            // уже отредактированный лейбл не затираем
            next[g][v] = typeof prev[g]?.[v] === "string" ? prev[g][v] : base;
          }
        }
        msgs.Options = next;
        fs.writeFileSync(file, JSON.stringify(msgs, null, 2) + "\n", "utf8");
      }

      const got = (JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>)
        .Options as Ns | undefined;

      expect(
        got,
        "namespace Options отсутствует — запусти GEN_OPTIONS=1 npx vitest run src/lib/profile/option-messages.test.ts",
      ).toBeTruthy();
      expect(keysOf(got!)).toEqual(keysOf(want));
    });
  }

  it("каждый Opt проштампован группой (иначе лейбл не редактируется)", () => {
    const unstamped: string[] = [];
    for (const [group, opts] of Object.entries(OPTION_GROUPS)) {
      for (const o of opts) if (o.group !== group && o.group !== "CITIZENSHIP") {
        unstamped.push(`${group}.${o.value} → group=${String(o.group)}`);
      }
    }
    // COUNTRY_OF_RESIDENCE === CITIZENSHIP (тот же массив) → штамп CITIZENSHIP, это ок
    expect(unstamped).toEqual([]);
  });
});
