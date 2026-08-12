import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createDbClient } from "./query-builder";
import { configurePgTypes } from "./pg-types";

// ИНТЕГРАЦИОННАЯ проверка связки роут→query-builder→RPC против ЖИВОЙ сид-БД
// (реальный Postgres + тот же createDbClient/configurePgTypes, что в проде).
// Этот слой не покрывали unit(моки)/SQL(psql) тесты — из-за него accept_interest
// и admin_ban_expire_sweep ушли в main сломанными (set-returning читались
// скаляром → node-pg отдавал composite СТРОКОЙ → роут не мог прочитать поля).
// Гоняется только через scripts/test-db/run-integration-tests.sh (нужен DATABASE_URL).

let pool: Pool;
let sb: ReturnType<typeof createDbClient>;
let tid = 770000000;

async function seedUser(opts: { verification?: string; lifecycle?: string } = {}): Promise<string> {
  const id = randomUUID();
  tid += 1;
  await pool.query(
    `insert into users(id, telegram_id, lifecycle_state, onboarding_step, verification_status)
     values ($1, $2, $3, 'active', $4)`,
    [id, tid, opts.lifecycle ?? "active", opts.verification ?? "approved"],
  );
  return id;
}

beforeAll(() => {
  configurePgTypes();
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  sb = createDbClient((text, values) => pool.query(text, values));
});

afterAll(async () => {
  await pool.end();
});

describe("RPC shape — set-returning функции читаются как МАССИВ ОБЪЕКТОВ (не строка)", () => {
  it("accept_interest: роут получает {result,chat_id,outbox_id}, а не composite-строку (регресс C-026)", async () => {
    const a = await seedUser();
    const b = await seedUser();
    const { rows } = await pool.query(
      `insert into match_requests(sender_id, receiver_id, status, auto_decline_at)
       values ($1,$2,'pending', now() + interval '10 hour') returning id`,
      [a, b],
    );
    const reqId = rows[0].id as string;

    const { data, error } = await sb.rpc("accept_interest", { p_request: reqId, p_receiver: b });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true); // ← при баге здесь была строка
    // ровно то, что делает роут:
    const acc = (Array.isArray(data) ? data[0] : data) as { result?: string; chat_id?: string; outbox_id?: string };
    expect(acc.result).toBe("accepted"); // ← при баге было undefined → 409
    expect(acc.chat_id).toBeTruthy();
    expect(acc.outbox_id).toBeTruthy();
  });

  it("process_interest ('sent'): {result,chat_id,outbox_id} массивом", async () => {
    const a = await seedUser();
    const b = await seedUser();
    const { data, error } = await sb.rpc("process_interest", {
      p_sender: a,
      p_receiver: b,
      p_message: null,
      p_hours: 72,
      p_limit: 10,
    });
    expect(error).toBeNull();
    const row = (Array.isArray(data) ? data[0] : data) as { result?: string; outbox_id?: string };
    expect(row.result).toBe("sent");
    expect(row.outbox_id).toBeTruthy();
  });

  it("send_chat_message: {message_id,created_at,should_push,outbox_id} массивом", async () => {
    const a = await seedUser();
    const b = await seedUser();
    const [ca, cb] = a < b ? [a, b] : [b, a];
    const { rows } = await pool.query(
      `insert into chats(user_a, user_b) values ($1,$2) returning id`,
      [ca, cb],
    );
    const chatId = rows[0].id as string;
    const { data, error } = await sb.rpc("send_chat_message", { p_chat: chatId, p_sender: a, p_body: "hi" });
    expect(error).toBeNull();
    const sent = (Array.isArray(data) ? data[0] : data) as { message_id?: string; should_push?: boolean };
    expect(sent.message_id).toBeTruthy();
    expect(sent.should_push).toBe(true);
  });

  it("claim_tg_outbox: массив ПОЛНЫХ строк (id,user_id,event_type,payload,attempts)", async () => {
    const u = await seedUser();
    await sb.rpc("enqueue_tg_outbox", {
      p_user_id: u,
      p_event_type: "new_interest",
      p_payload: {},
      p_dedup_key: `itest:${randomUUID()}`,
    });
    const { data, error } = await sb.rpc("claim_tg_outbox", { p_limit: 50, p_lock_seconds: 60 });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    const rows = data as Array<{ id: string; user_id: string; event_type: string; attempts: number }>;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toHaveProperty("event_type");
    expect(rows[0]).toHaveProperty("user_id");
  });

  it("admin_ban_expire_sweep: МАССИВ (регресс — guard.ts итерирует data с доступом к полям)", async () => {
    const { data, error } = await sb.rpc("admin_ban_expire_sweep", { p_ttl_seconds: 86400, p_limit: 200 });
    expect(error).toBeNull();
    // Ключевое: массив, а не строка. При баге for..of по строке шёл бы по символам.
    expect(Array.isArray(data)).toBe(true);
  });

  it("create_feedback: {feedback_id,limited,deduplicated,screenshot_stored} массивом - иначе роут отвечает 500 на сохранённый отзыв", async () => {
    const u = await seedUser();
    const { data, error } = await sb.rpc("create_feedback", {
      p_user_id: u,
      p_rating: 5,
      p_body: "всё понятно, спасибо",
      p_screenshot_path: `${u}/1.png`,
      p_locale: "ru",
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true); // ← при баге здесь была строка "(uuid,f)"
    const row = (Array.isArray(data) ? data[0] : data) as {
      feedback_id?: string;
      limited?: boolean;
      deduplicated?: boolean;
      screenshot_stored?: boolean;
    };
    expect(row.feedback_id).toBeTruthy(); // ← при баге undefined → db_failed → 500
    expect(row.limited).toBe(false);
    // Оба флага обязаны доехать до роута ИМЕНОВАННЫМИ полями: по ним он решает,
    // сносить ли уже загруженный файл и что сказать человеку про скриншот.
    expect(row.deduplicated).toBe(false);
    expect(row.screenshot_stored).toBe(true);
  });

  it("create_feedback на дедупе: скриншот прикрепляется к найденной записи, а не теряется", async () => {
    const u = await seedUser();
    const first = await sb.rpc("create_feedback", {
      p_user_id: u, p_rating: 5, p_body: "экран платежа падает", p_screenshot_path: null, p_locale: "ru",
    });
    const firstId = (first.data as Array<{ feedback_id: string }>)[0].feedback_id;

    // Человек спохватился и в ту же минуту повторил отправку со скриншотом.
    const again = await sb.rpc("create_feedback", {
      p_user_id: u, p_rating: 5, p_body: "экран платежа падает", p_screenshot_path: `${u}/2.png`, p_locale: "ru",
    });
    const row = (again.data as Array<{
      feedback_id: string; limited: boolean; deduplicated: boolean; screenshot_stored: boolean;
    }>)[0];
    expect(row.feedback_id).toBe(firstId); // дубля отзыва не завели
    expect(row.deduplicated).toBe(true);
    expect(row.screenshot_stored).toBe(true); // файл доехал до записи - сносить его нельзя
  });

  it("create_feedback сверх суточного лимита: limited=true читается, а не превращается в 500", async () => {
    const u = await seedUser();
    // Тексты разные - иначе сработает дедуп двойного тапа (минутное окно).
    for (const body of ["раз", "два", "три"]) {
      const { data } = await sb.rpc("create_feedback", {
        p_user_id: u, p_rating: 4, p_body: body, p_screenshot_path: null, p_locale: "ru",
      });
      expect((data as Array<{ limited: boolean }>)[0].limited).toBe(false);
    }
    const { data } = await sb.rpc("create_feedback", {
      p_user_id: u, p_rating: 4, p_body: "четыре", p_screenshot_path: null, p_locale: "ru",
    });
    const row = (data as Array<{ feedback_id: string | null; limited: boolean }>)[0];
    expect(row.limited).toBe(true); // человек должен увидеть текст про лимит, а не ошибку
    expect(row.feedback_id).toBeNull();
  });

  it("get_recommendations / get_chat_list: массивы", async () => {
    const u = await seedUser();
    const rec = await sb.rpc("get_recommendations", { p_viewer: u, p_limit: 5, p_relax_level: 0 });
    expect(Array.isArray(rec.data)).toBe(true);
    const chats = await sb.rpc("get_chat_list", { p_user: u });
    expect(Array.isArray(chats.data)).toBe(true);
  });
});

describe("RPC shape — скалярные функции остаются СКАЛЯРАМИ (не массив)", () => {
  it("enqueue_tg_outbox → uuid (строка), не массив", async () => {
    const u = await seedUser();
    const { data } = await sb.rpc("enqueue_tg_outbox", {
      p_user_id: u,
      p_event_type: "new_interest",
      p_payload: {},
      p_dedup_key: `itest-scalar:${randomUUID()}`,
    });
    expect(Array.isArray(data)).toBe(false);
    expect(typeof data).toBe("string"); // uuid
  });

  it("is_matchable → boolean, не массив", async () => {
    const a = await seedUser();
    const b = await seedUser();
    const { data } = await sb.rpc("is_matchable", { p_sender: a, p_receiver: b });
    expect(Array.isArray(data)).toBe(false);
    expect(typeof data).toBe("boolean");
  });
});
