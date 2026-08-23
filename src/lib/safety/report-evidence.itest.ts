import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { chatPairKey } from "./chat-pair";

/**
 * Проверяет ровно то, ради чего правился /api/report: чат-доказательство
 * выводится из пары «жалобщик - нарушитель», а не принимается снаружи.
 *
 * До правки chat_id брался из тела запроса без проверок, и достаточно было
 * подставить id своего чата с посторонним, чтобы модератор открыл дело и
 * прочитал до 200 сообщений разговора двух непричастных людей.
 */
let pool: Pool;
let tid = 990000000;

async function seedUser(): Promise<string> {
  const id = randomUUID();
  tid += 1;
  await pool.query(
    `insert into users(id, telegram_id, lifecycle_state, onboarding_step, verification_status)
     values ($1, $2, 'active', 'active', 'approved')`,
    [id, tid],
  );
  return id;
}

async function seedChat(x: string, y: string): Promise<string> {
  const { userA, userB } = chatPairKey(x, y);
  const { rows } = await pool.query<{ id: string }>(
    "insert into chats(user_a, user_b) values ($1, $2) returning id",
    [userA, userB],
  );
  return rows[0].id;
}

/** Тот же поиск, что делает роут после правки. */
async function lookupEvidence(reporter: string, target: string): Promise<string | null> {
  const pair = chatPairKey(reporter, target);
  const { rows } = await pool.query<{ id: string }>(
    "select id from chats where user_a = $1 and user_b = $2",
    [pair.userA, pair.userB],
  );
  return rows.length ? rows[0].id : null;
}

beforeAll(() => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
});

afterAll(async () => {
  await pool.end();
});

describe("чат-доказательство в жалобе", () => {
  it("находит чат жалобщика с нарушителем независимо от порядка участников", async () => {
    const a = await seedUser();
    const b = await seedUser();
    const chat = await seedChat(a, b);

    expect(await lookupEvidence(a, b)).toBe(chat);
    // жалоба в обратную сторону обязана найти тот же чат
    expect(await lookupEvidence(b, a)).toBe(chat);
  });

  it("НЕ подтягивает чужой чат: жалоба на того, с кем переписки не было", async () => {
    const reporter = await seedUser();
    const target = await seedUser();
    const stranger = await seedUser();
    // у жалобщика есть чат с посторонним - именно его раньше можно было подсунуть
    await seedChat(reporter, stranger);

    expect(await lookupEvidence(reporter, target)).toBeNull();
  });

  it("отсутствие переписки - нормальный случай, а не ошибка", async () => {
    const a = await seedUser();
    const b = await seedUser();
    expect(await lookupEvidence(a, b)).toBeNull();
  });
});
