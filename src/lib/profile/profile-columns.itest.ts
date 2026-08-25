import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { PROFILE_COLUMNS, NON_EDITABLE_COLUMNS } from "./profile-columns";

/**
 * Сверка списка колонок в коде с настоящей таблицей.
 *
 * Зачем именно тест, а не «мы аккуратные». Редактор профиля раскладывает поля
 * раздела по этому списку: есть колонка - пишем в колонку, нет - в JSON-блок
 * extended. Если кто-то добавит колонку в миграции и забудет строку в
 * profile-columns.ts, поле поедет в extended. Это не упадёт и не залогируется:
 * запрос успешен, ответ ok, а значение просто не появится там, откуда его
 * читают анкета и подбор. Ровно тот класс дефекта, который в этом проекте уже
 * стоил живого бага - правка дохода сохранялась на клиенте и молча
 * перезатиралась сервером.
 *
 * Гоняется только через scripts/test-db/run-integration-tests.sh.
 */

let pool: Pool;

beforeAll(() => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
});
afterAll(async () => {
  await pool.end();
});

async function realColumns(): Promise<Set<string>> {
  const { rows } = await pool.query<{ column_name: string }>(
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'user_profiles'`,
  );
  return new Set(rows.map((r) => r.column_name));
}

describe("PROFILE_COLUMNS не разошёлся с таблицей user_profiles", () => {
  it("в коде перечислены ровно те колонки, что есть в базе", async () => {
    const real = await realColumns();
    const inCode = new Set(PROFILE_COLUMNS);

    const missingInCode = [...real].filter((c) => !inCode.has(c)).sort();
    const extraInCode = [...inCode].filter((c) => !real.has(c)).sort();

    // Сообщения намеренно подробные: тест упадёт у того, кто добавил колонку,
    // и он должен сразу увидеть, что именно дописать.
    expect(missingInCode, `появились колонки, не описанные в profile-columns.ts: ${missingInCode.join(", ")}`).toEqual([]);
    expect(extraInCode, `в profile-columns.ts перечислены несуществующие колонки: ${extraInCode.join(", ")}`).toEqual([]);
  });

  it("все запрещённые к правке колонки существуют в таблице", async () => {
    // Опечатка в NON_EDITABLE_COLUMNS означала бы дыру: поле считалось бы
    // запрещённым по одному написанию, а приходило бы по другому.
    const real = await realColumns();
    const ghosts = [...NON_EDITABLE_COLUMNS].filter((c) => !real.has(c)).sort();
    expect(ghosts, `в списке запретов есть несуществующие колонки: ${ghosts.join(", ")}`).toEqual([]);
  });

  it("паспортные и служебные поля точно под запретом", async () => {
    // Явная проверка самых важных: список запретов легко случайно проредить.
    for (const c of [
      "display_name",
      "birth_date",
      "gender",
      "status",
      "needs_marital_review",
      "needs_v4_review",
      "extended",
      "user_id",
    ]) {
      expect(NON_EDITABLE_COLUMNS.has(c), `${c} обязан быть запрещён к правке`).toBe(true);
    }
  });
});
