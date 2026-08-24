import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

/**
 * Замечание 11 тестеров family launch: заблокированный исчезал полностью и
 * нигде не показывался, снять блокировку было нельзя.
 *
 * Здесь проверяется главное свойство списка: он показывает ТОЛЬКО мои
 * блокировки. Обратное направление - кто заблокировал меня - показывать
 * нельзя никогда: блокировка по замыслу тихая, и обратный список раскрыл бы
 * её тому, кого заблокировали.
 */
let pool: Pool;
let tid = 940_000_000 + Math.floor(Math.random() * 40_000_000);
const created: string[] = [];

async function seedUser(): Promise<string> {
  const id = randomUUID();
  tid += 1;
  await pool.query(
    `insert into users(id, telegram_id, lifecycle_state, onboarding_step, verification_status)
     values ($1, $2, 'active', 'active', 'approved')`,
    [id, tid],
  );
  created.push(id);
  return id;
}

/** Тот же запрос, что делает loadBlockedByMe. */
async function blockedByMe(viewer: string): Promise<string[]> {
  const { rows } = await pool.query<{ blocked_id: string }>(
    `select blocked_id from blocks where blocker_id = $1 order by created_at desc limit 200`,
    [viewer],
  );
  return rows.map((r) => r.blocked_id);
}

beforeAll(() => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
});

afterAll(async () => {
  if (created.length) {
    await pool.query("delete from blocks where blocker_id = any($1) or blocked_id = any($1)", [created]);
    await pool.query("delete from users where id = any($1)", [created]);
  }
  await pool.end();
});

describe("список заблокированных", () => {
  it("показывает тех, кого заблокировал я", async () => {
    const me = await seedUser();
    const a = await seedUser();
    const b = await seedUser();
    await pool.query("insert into blocks(blocker_id, blocked_id) values ($1,$2), ($1,$3)", [me, a, b]);

    const list = await blockedByMe(me);
    expect(list.sort()).toEqual([a, b].sort());
  });

  it("НЕ показывает тех, кто заблокировал меня - блокировка тихая", async () => {
    const me = await seedUser();
    const stranger = await seedUser();
    await pool.query("insert into blocks(blocker_id, blocked_id) values ($1,$2)", [stranger, me]);

    const list = await blockedByMe(me);
    expect(
      list,
      "в мой список попал тот, кто заблокировал МЕНЯ - это раскрывает тихую блокировку",
    ).toEqual([]);
  });

  it("после разблокировки человек уходит из списка", async () => {
    const me = await seedUser();
    const a = await seedUser();
    await pool.query("insert into blocks(blocker_id, blocked_id) values ($1,$2)", [me, a]);
    expect(await blockedByMe(me)).toEqual([a]);

    // то же, что делает /api/block с action=unblock
    await pool.query("delete from blocks where blocker_id = $1 and blocked_id = $2", [me, a]);
    expect(await blockedByMe(me)).toEqual([]);
  });
});
