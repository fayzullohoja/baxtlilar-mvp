import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createDbClient } from "@/lib/db/query-builder";
import { configurePgTypes } from "@/lib/db/pg-types";

// ИНТЕГРАЦИЯ против сид-БД (реальный query-builder) — доказывает ЭФФЕКТЫ карт
// T-106 (публикация → видимость в подборе) и T-111 (блок → невидимость + запрет
// интереса). Ранее эти карты были «сверены чтением кода»; тут — вживую в сиде.
// Гоняется только через scripts/test-db/run-integration-tests.sh.

let pool: Pool;
let sb: ReturnType<typeof createDbClient>;
let tid = 880000000;

/** Пользователь с анкетой (по умолчанию published/approved/active). */
async function seedProfile(o: {
  gender: "m" | "f";
  looking: "m" | "f";
  birth: string;
  pmin: number;
  pmax: number;
  status?: string;
}): Promise<string> {
  const id = randomUUID();
  tid += 1;
  await pool.query(
    `insert into users(id, telegram_id, lifecycle_state, onboarding_step, verification_status)
     values ($1,$2,'active','active','approved')`,
    [id, tid],
  );
  await pool.query(
    `insert into user_profiles(user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [id, o.gender, o.looking, o.birth, o.pmin, o.pmax, o.status ?? "published"],
  );
  // get_recommendations требует хотя бы одно approved-фото у кандидата
  await pool.query(
    `insert into profile_photos(user_id, path, status, is_main) values ($1, $2, 'approved', true)`,
    [id, `p/${id}.jpg`],
  );
  return id;
}

/** Матчабельная пара: A (m→f) видит B (f→m). */
async function seedPair(bStatus = "published"): Promise<{ a: string; b: string }> {
  const a = await seedProfile({ gender: "m", looking: "f", birth: "1994-01-01", pmin: 25, pmax: 40 });
  const b = await seedProfile({ gender: "f", looking: "m", birth: "1995-01-01", pmin: 25, pmax: 40, status: bStatus });
  return { a, b };
}

async function recsInclude(viewer: string, candidate: string): Promise<boolean> {
  const { data } = await sb.rpc("get_recommendations", { p_viewer: viewer, p_limit: 100, p_relax_level: 2 });
  const rows = (data as Array<{ user_id: string }>) ?? [];
  return rows.some((r) => r.user_id === candidate);
}

beforeAll(() => {
  configurePgTypes();
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  sb = createDbClient((text, values) => pool.query(text, values));
});
afterAll(async () => {
  await pool.end();
});

describe("T-106 — публикация анкеты открывает видимость в подборе", () => {
  it("опубликованная матчабельная анкета видна; неопубликованная — нет", async () => {
    const { a, b } = await seedPair("published");
    expect(await sb.rpc("is_matchable", { p_sender: a, p_receiver: b }).then((r) => r.data)).toBe(true);
    expect(await recsInclude(a, b)).toBe(true); // published → видна

    // снимаем публикацию → должна пропасть из подбора и is_matchable
    await pool.query(`update user_profiles set status = 'draft' where user_id = $1`, [b]);
    expect(await sb.rpc("is_matchable", { p_sender: a, p_receiver: b }).then((r) => r.data)).toBe(false);
    expect(await recsInclude(a, b)).toBe(false); // не опубликована → не видна
  });
});

describe("T-111 — блокировка убирает из подбора и запрещает интерес", () => {
  it("после блока: не в рекомендациях, интерес → 'blocked'", async () => {
    const { a, b } = await seedPair("published");
    expect(await recsInclude(a, b)).toBe(true); // baseline: виден

    // A блокирует B (то же, что blockUser: upsert в blocks)
    await pool.query(
      `insert into blocks(blocker_id, blocked_id) values ($1,$2)
       on conflict (blocker_id, blocked_id) do nothing`,
      [a, b],
    );

    expect(await recsInclude(a, b)).toBe(false); // блок → не в подборе

    // интерес A→B под блоком → 'blocked'
    const { data } = await sb.rpc("process_interest", {
      p_sender: a,
      p_receiver: b,
      p_message: null,
      p_hours: 72,
      p_limit: 10,
    });
    const row = (Array.isArray(data) ? data[0] : data) as { result?: string };
    expect(row.result).toBe("blocked");
  });

  it("блок односторонний в обе стороны: B тоже не видит A", async () => {
    const { a, b } = await seedPair("published");
    // B блокирует A
    await pool.query(
      `insert into blocks(blocker_id, blocked_id) values ($1,$2)
       on conflict (blocker_id, blocked_id) do nothing`,
      [b, a],
    );
    // A (заблокированный) не видит B, и B не видит A (get_recommendations гейтит обе стороны)
    expect(await recsInclude(a, b)).toBe(false);
    expect(await recsInclude(b, a)).toBe(false);
  });
});
