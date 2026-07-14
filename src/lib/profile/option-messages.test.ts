import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { OPTION_GROUPS, type Opt } from "./options";
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

  // Страж №2: КАЖДЫЙ Opt в реестре обязан носить имя СВОЕЙ группы.
  //
  // Это ловит шаринг объектов между наборами: `[...CITIZENSHIP]` копирует ССЫЛКИ,
  // и штамп достаётся опциям от той группы, что в реестре идёт первой. Тогда
  // ключи второй группы (Options.PARTNER_PREFERRED_COUNTRIES.*) в messages есть,
  // но их НИКТО не читает: правка = no-op, а правка первой группы молча меняет
  // оба списка. Ровно так и было с PARTNER_PREFERRED_COUNTRIES до клонирования.
  // NB: у COUNTRY_OF_RESIDENCE (алиас CITIZENSHIP) нет своей записи в реестре,
  // поэтому исключений здесь быть НЕ должно.
  it("каждый Opt проштампован ИМЕННО своей группой (ловит шаринг объектов)", () => {
    const wrong: string[] = [];
    for (const [group, opts] of Object.entries(OPTION_GROUPS)) {
      for (const o of opts) {
        if (o.group !== group) wrong.push(`${group}.${o.value} → group=${String(o.group)}`);
      }
    }
    expect(wrong, `опции с чужой/пустой группой:\n${wrong.join("\n")}`).toEqual([]);
  });

  it("наборы не делят один и тот же объект Opt (иначе штамп группы схлопнется)", () => {
    const seen = new Map<Opt, string>();
    const shared: string[] = [];
    for (const [group, opts] of Object.entries(OPTION_GROUPS)) {
      for (const o of opts) {
        const owner = seen.get(o);
        if (owner && owner !== group) shared.push(`${o.value}: ${owner} ↔ ${group}`);
        else seen.set(o, group);
      }
    }
    expect(shared, `общие объекты между наборами:\n${shared.join("\n")}`).toEqual([]);
  });
});
