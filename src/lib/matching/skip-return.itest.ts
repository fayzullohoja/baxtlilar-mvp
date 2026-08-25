import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createDbClient } from "@/lib/db/query-builder";
import { configurePgTypes } from "@/lib/db/pg-types";
import { SKIP_REASONS, hiddenUntil } from "./skip-reasons";

/**
 * ИНТЕГРАЦИЯ против живой базы: доказывает, что отказ перестал быть приговором.
 *
 * Раньше строка в match_views исключала пару навсегда. При 25 опубликованных
 * анкетах (22 мужчины, 9 женщин на 2026-08-25) это тупик: у мужчины запас
 * кандидатов - девять человек при лимите тридцать отказов в сутки, то есть
 * вычистить ленту можно за один присест.
 *
 * Проверяем именно ЭФФЕКТ в выдаче get_recommendations, а не то, что колонка
 * записалась: записать можно что угодно, а вопрос в том, вернётся ли человек.
 *
 * Гоняется только через scripts/test-db/run-integration-tests.sh.
 */

let pool: Pool;
let sb: ReturnType<typeof createDbClient>;
// Случайная база, а не константа: иначе повторный прогон по той же базе падает
// на уникальности telegram_id.
let tid = 700_000_000 + Math.floor(Math.random() * 50_000_000);

async function seedProfile(o: {
  gender: "m" | "f";
  looking: "m" | "f";
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
     values ($1,$2,$3,'1994-01-01',18,60,'published')`,
    [id, o.gender, o.looking],
  );
  await pool.query(
    `insert into profile_photos(user_id, path, status, is_main) values ($1,$2,'approved',true)`,
    [id, `p/${id}.jpg`],
  );
  return id;
}

async function seedPair(): Promise<{ a: string; b: string }> {
  const a = await seedProfile({ gender: "m", looking: "f" });
  const b = await seedProfile({ gender: "f", looking: "m" });
  return { a, b };
}

async function sees(viewer: string, candidate: string): Promise<boolean> {
  const { data } = await sb.rpc("get_recommendations", {
    p_viewer: viewer,
    p_limit: 200,
    p_relax_level: 2,
  });
  return ((data as Array<{ user_id: string }>) ?? []).some((r) => r.user_id === candidate);
}

async function skip(
  viewer: string,
  target: string,
  reason: string | null,
  until: Date | null,
): Promise<void> {
  await pool.query(
    `insert into match_views(viewer_id, target_id, reason, hidden_until)
     values ($1,$2,$3,$4)
     on conflict (viewer_id, target_id) do update
       set reason = excluded.reason, hidden_until = excluded.hidden_until`,
    [viewer, target, reason, until],
  );
}

beforeAll(() => {
  configurePgTypes();
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  sb = createDbClient((text, values) => pool.query(text, values));
});
afterAll(async () => {
  await pool.end();
});

describe("отказ со сроком: кандидат возвращается, когда срок вышел", () => {
  it("до срока не виден, после срока виден снова", async () => {
    const { a, b } = await seedPair();
    expect(await sees(a, b)).toBe(true);

    // срок в будущем - скрыт
    await skip(a, b, "not_ready", new Date(Date.now() + 30 * 86400_000));
    expect(await sees(a, b)).toBe(false);

    // тот же отказ, но срок уже вышел - человек вернулся в ленту
    await skip(a, b, "not_ready", new Date(Date.now() - 60_000));
    expect(await sees(a, b)).toBe(true);
  });

  it("пустой срок значит навсегда", async () => {
    const { a, b } = await seedPair();
    await skip(a, b, "never", null);
    expect(await sees(a, b)).toBe(false);
  });

  it("старые отказы, сделанные до появления причин, остаются скрытыми", async () => {
    // Обе колонки пустые - ровно так лежат строки, записанные прежней версией.
    // Возвращать их задним числом было бы сюрпризом для человека.
    const { a, b } = await seedPair();
    await skip(a, b, null, null);
    expect(await sees(a, b)).toBe(false);
  });

  it("сроки из кода дают тот же эффект в базе", async () => {
    // Связываем чистую функцию с реальной выдачей: если кто-то поменяет число
    // дней в skip-reasons.ts, но забудет про смысл, тест это покажет.
    const { a, b } = await seedPair();
    await skip(a, b, "not_my_type", hiddenUntil("not_my_type", Date.now()));
    expect(await sees(a, b)).toBe(false);
    await skip(a, b, "not_my_type", hiddenUntil("not_my_type", Date.now() - 91 * 86400_000));
    expect(await sees(a, b)).toBe(true);
  });
});

describe("снятие отказов при правке фильтра", () => {
  it("возвращает скрытых по возрасту и гео, не трогая остальных", async () => {
    const viewer = await seedProfile({ gender: "m", looking: "f" });
    const byAge = await seedProfile({ gender: "f", looking: "m" });
    const byGeo = await seedProfile({ gender: "f", looking: "m" });
    const byTaste = await seedProfile({ gender: "f", looking: "m" });
    const byNever = await seedProfile({ gender: "f", looking: "m" });

    await skip(viewer, byAge, "age", null);
    await skip(viewer, byGeo, "geo", null);
    await skip(viewer, byTaste, "not_my_type", new Date(Date.now() + 90 * 86400_000));
    await skip(viewer, byNever, "never", null);
    for (const c of [byAge, byGeo, byTaste, byNever]) expect(await sees(viewer, c)).toBe(false);

    const { data } = await sb.rpc("clear_filter_skips", {
      p_viewer: viewer,
      p_kinds: ["age", "geo"],
    });
    expect(data).toBe(2);

    // причина отпала вместе с фильтром - эти двое вернулись
    expect(await sees(viewer, byAge)).toBe(true);
    expect(await sees(viewer, byGeo)).toBe(true);
    // а эти решения правкой рамок не отменяются
    expect(await sees(viewer, byTaste)).toBe(false);
    expect(await sees(viewer, byNever)).toBe(false);
  });

  it("снимает только запрошенный вид фильтра", async () => {
    const viewer = await seedProfile({ gender: "m", looking: "f" });
    const byAge = await seedProfile({ gender: "f", looking: "m" });
    const byGeo = await seedProfile({ gender: "f", looking: "m" });
    await skip(viewer, byAge, "age", null);
    await skip(viewer, byGeo, "geo", null);

    // поменяли только возрастные рамки - гео-отказ обязан остаться
    await sb.rpc("clear_filter_skips", { p_viewer: viewer, p_kinds: ["age"] });
    expect(await sees(viewer, byAge)).toBe(true);
    expect(await sees(viewer, byGeo)).toBe(false);
  });

  it("не снимает нефильтровые причины, даже если их попросили", async () => {
    // Защита от вызова с чужим списком: функция обязана игнорировать всё, что
    // не age/geo, иначе один неверный вызов отменил бы осознанные решения.
    const viewer = await seedProfile({ gender: "m", looking: "f" });
    const byNever = await seedProfile({ gender: "f", looking: "m" });
    await skip(viewer, byNever, "never", null);
    const { data } = await sb.rpc("clear_filter_skips", {
      p_viewer: viewer,
      p_kinds: ["never", "not_my_type", "profile_issue"],
    });
    expect(data).toBe(0);
    expect(await sees(viewer, byNever)).toBe(false);
  });
});

describe("список причин в коде и в базе не разошёлся", () => {
  it("CHECK принимает ровно SKIP_REASONS и ничего сверх", async () => {
    // Та же ловушка, что была с post_marriage_living: вариант предлагался в
    // интерфейсе и отбивался базой, регистрация вставала на обязательном шаге.
    const { a, b } = await seedPair();
    for (const r of SKIP_REASONS) {
      await expect(skip(a, b, r, null)).resolves.toBeUndefined();
    }
    await expect(skip(a, b, "boring", null)).rejects.toThrow();
  });

  it("null как причина разрешён - это отказы прежней версии", async () => {
    const { a, b } = await seedPair();
    await expect(skip(a, b, null, null)).resolves.toBeUndefined();
  });
});
