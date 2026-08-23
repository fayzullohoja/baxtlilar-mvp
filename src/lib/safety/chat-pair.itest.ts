import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { chatPairKey } from "./chat-pair";

/**
 * Сверяет нормализацию пары в JS с least()/greatest() самого Postgres.
 *
 * Смысл: chatPairKey ищет чат одним равенством по (user_a, user_b), опираясь на
 * то, что порядок строк совпадает с порядком uuid в базе. Если это когда-нибудь
 * разойдётся, жалоба перестанет находить существующий чат и модератор потеряет
 * доказательство - молча, без ошибки. Здесь это проверяется против живой базы,
 * а не принимается на веру.
 */
let pool: Pool;

beforeAll(() => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
});

afterAll(async () => {
  await pool.end();
});

describe("нормализация пары участников чата", () => {
  it("совпадает с least/greatest базы на 200 случайных пар", async () => {
    const pairs = Array.from({ length: 200 }, () => [randomUUID(), randomUUID()] as const);
    const mismatches: string[] = [];

    for (const [x, y] of pairs) {
      const { rows } = await pool.query<{ lo: string; hi: string }>(
        "select least($1::uuid, $2::uuid) as lo, greatest($1::uuid, $2::uuid) as hi",
        [x, y],
      );
      const mine = chatPairKey(x, y);
      if (mine.userA !== rows[0].lo || mine.userB !== rows[0].hi) {
        mismatches.push(`${x} / ${y}: база ${rows[0].lo}/${rows[0].hi}, функция ${mine.userA}/${mine.userB}`);
      }
    }

    expect(mismatches, `расхождений: ${mismatches.length}\n${mismatches.slice(0, 3).join("\n")}`).toEqual([]);
  });

  it("порядок аргументов не влияет на результат", () => {
    const x = randomUUID();
    const y = randomUUID();
    expect(chatPairKey(x, y)).toEqual(chatPairKey(y, x));
  });

  it("регистр не влияет на результат", () => {
    const x = randomUUID();
    const y = randomUUID();
    expect(chatPairKey(x.toUpperCase(), y)).toEqual(chatPairKey(x, y));
  });
});
