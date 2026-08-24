import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import * as OPTIONS from "./options";

/**
 * СТРАЖ РАСХОЖДЕНИЯ «варианты в интерфейсе против CHECK в базе».
 *
 * Зачем он существует. За один день 23.08.2026 этот класс ошибок выстрелил дважды:
 *
 *   1. В options.ts есть вариант post_marriage_living = 'separate_then_parents',
 *      zod его пропускал, а CHECK в базе - нет. Человек выбирал его на шаге
 *      «Жизнь после брака» и получал 500 на обязательном шаге: пройти анкету
 *      было невозможно. Баг доехал до прода и жил там.
 *
 *   2. Потолок top_life_values подняли с 3 до 5 в zod и в интерфейсе, а CHECK
 *      остался 1..3 - выкладка дала бы 500 всем, кто выбрал четыре или пять.
 *
 * Общая причина одна: варианты ответов живут в двух местах сразу - в TypeScript
 * и в SQL - и ничто не заставляло их совпадать. Unit-тесты этого не ловят:
 * они гоняют zod без базы, и для них всё зелено. Ловится только против живого
 * Postgres, поэтому тест интеграционный.
 *
 * Что проверяем: для каждой колонки, у которой есть CHECK со списком значений,
 * КАЖДЫЙ вариант из соответствующего набора options.ts обязан этим CHECK
 * приниматься. Обратное неверно и не проверяется: в базе намеренно остаются
 * значения, которые интерфейс больше не предлагает (например 'na' - до удаления
 * варианта «не хочу отвечать»), потому что они уже записаны у живых людей.
 */

// Колонка user_profiles -> набор вариантов из options.ts.
// Добавляя новый выпадающий список в анкету, впиши пару сюда.
const COLUMN_TO_OPTIONS: Array<{ column: string; constName: keyof typeof OPTIONS }> = [
  { column: "post_marriage_living", constName: "POST_MARRIAGE_LIVING" },
  { column: "marital_status", constName: "MARITAL_STATUS" },
  { column: "religion", constName: "RELIGION" },
  { column: "education", constName: "EDUCATION" },
  { column: "family_role_model", constName: "FAMILY_ROLE_MODEL" },
  { column: "wife_work_after_marriage_view", constName: "WIFE_WORK_VIEW" },
];

let pool: Pool;

beforeAll(() => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
});

afterAll(async () => {
  await pool.end();
});

/**
 * Текст CHECK, который реально навешен НА ЭТУ колонку, или null.
 *
 * Привязка идёт через con.conkey (список колонок ограничения), а не поиском
 * имени колонки в тексте. Поиск по подстроке даёт ложные срабатывания: CHECK на
 * activity_field содержит значение 'education_science', и наивный
 * `like '%education%'` притянул бы его как ограничение колонки education,
 * которой ограничения не навешено вовсе. На этом я и попался при первом прогоне.
 */
async function checkDefFor(column: string): Promise<string | null> {
  const { rows } = await pool.query<{ def: string }>(
    `select pg_get_constraintdef(con.oid) as def
       from pg_constraint con
       join pg_class rel on rel.oid = con.conrelid
       join pg_attribute att
         on att.attrelid = rel.oid
        and att.attnum = any (con.conkey)
      where rel.relname = 'user_profiles'
        and con.contype = 'c'
        and att.attname = $1`,
    [column],
  );
  return rows.length ? rows.map((r) => r.def).join(" ") : null;
}

describe("варианты анкеты приняты базой", () => {
  for (const { column, constName } of COLUMN_TO_OPTIONS) {
    it(`${column}: каждый вариант из ${String(constName)} проходит CHECK`, async () => {
      const def = await checkDefFor(column);
      if (!def) {
        // CHECK на колонку не навешен - ограничения нет, расходиться нечему.
        return;
      }
      const opts = OPTIONS[constName] as ReadonlyArray<{ value: string }>;
      expect(Array.isArray(opts), `${String(constName)} должен быть массивом вариантов`).toBe(true);

      const missing = opts
        .map((o) => o.value)
        .filter((v) => !def.includes(`'${v}'`));

      expect(
        missing,
        `Варианты предлагаются в интерфейсе, но отбиваются CHECK на user_profiles.${column}. ` +
          `Человек выберет такой вариант и получит 500 при сохранении шага. ` +
          `Нужна миграция, расширяющая CHECK. Текущий CHECK: ${def}`,
      ).toEqual([]);
    });
  }

  it("top_life_values: потолок длины в базе не ниже, чем разрешает интерфейс", async () => {
    // Отдельный случай: здесь CHECK ограничивает не набор значений, а ДЛИНУ
    // массива. Интерфейс (Chips max) и zod разрешают 5 - база обязана тоже.
    const def = await checkDefFor("top_life_values");
    expect(def, "CHECK на длину top_life_values должен существовать").toBeTruthy();

    const upper = Number((def!.match(/<=\s*(\d+)/) || [])[1]);
    expect(Number.isFinite(upper), `не смог прочитать верхнюю границу из: ${def}`).toBe(true);
    expect(
      upper,
      `База разрешает не больше ${upper} ценностей, а интерфейс и zod разрешают 5. ` +
        `Выбравший больше получит 500 при сохранении.`,
    ).toBeGreaterThanOrEqual(5);
  });
});
