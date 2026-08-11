import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createDbClient } from "@/lib/db/query-builder";
import { configurePgTypes } from "@/lib/db/pg-types";

// ИНТЕГРАЦИЯ против живого Postgres (throwaway, поднимается и уничтожается
// scripts/test-db/run-integration-tests.sh - прод не трогает). Доказывает
// РОВНО то свойство, ради которого disable_invite_codes_of_user (миграция
// 20260811160000) переехала из TS в одну SQL-функцию: если ВТОРАЯ запись
// (users.invite_revoked_at) внутри функции падает, ПЕРВАЯ (invite_codes.
// disabled_at) не остаётся применённой - обе живут в одной транзакции. Это
// свойство принципиально нельзя проверить моком (unit-тесты в store.test.ts
// проверяют только транспорт - какие параметры ушли в rpc() и как
// disableCodesOfUser реагирует на data/error) - мок не исполняет SQL и не
// умеет откатывать транзакцию, поэтому нужен реальный Postgres.
//
// Способ форсировать сбой ИМЕННО второго шага, не трогая саму функцию и не
// портя схему на постоянной основе: временный BEFORE UPDATE триггер на users,
// который бросает исключение конкретно на попытке проставить
// invite_revoked_at. Триггер снимается в afterEach - соседние тесты (и другие
// файлы, если когда-нибудь будут делить эту же БД) его не увидят.

let pool: Pool;
let sb: ReturnType<typeof createDbClient>;
let tid = 991000000;

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

async function seedActiveCode(ownerId: string): Promise<string> {
  const code = `IT${String(tid).slice(-4)}`;
  await pool.query(`insert into invite_codes(code, owner_id) values ($1, $2)`, [code, ownerId]);
  return code;
}

async function codeRow(ownerId: string): Promise<{ disabled_at: string | null; disabled_reason: string | null }> {
  const { rows } = await pool.query(
    `select disabled_at, disabled_reason from invite_codes where owner_id = $1`,
    [ownerId],
  );
  return rows[0] as { disabled_at: string | null; disabled_reason: string | null };
}

async function userRevoked(userId: string): Promise<string | null> {
  const { rows } = await pool.query(`select invite_revoked_at from users where id = $1`, [userId]);
  return (rows[0]?.invite_revoked_at as string | null) ?? null;
}

/** Временный триггер, обрубающий ИМЕННО попытку проставить invite_revoked_at. */
async function installSecondStepFailure(): Promise<void> {
  await pool.query(`
    create or replace function itest_fail_invite_revoke() returns trigger
    language plpgsql as $$
    begin
      if new.invite_revoked_at is distinct from old.invite_revoked_at then
        raise exception 'itest: simulated failure of invite_revoked_at update';
      end if;
      return new;
    end;
    $$;
  `);
  await pool.query(`
    create trigger itest_fail_invite_revoke_trg
      before update on users
      for each row execute function itest_fail_invite_revoke();
  `);
}

async function uninstallSecondStepFailure(): Promise<void> {
  await pool.query(`drop trigger if exists itest_fail_invite_revoke_trg on users;`);
  await pool.query(`drop function if exists itest_fail_invite_revoke();`);
}

beforeAll(() => {
  configurePgTypes();
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  sb = createDbClient((text, values) => pool.query(text, values));
});

afterEach(async () => {
  await uninstallSecondStepFailure();
});

afterAll(async () => {
  await pool.end();
});

describe("disable_invite_codes_of_user - атомарность (раунд исправлений 1)", () => {
  it("happy path: гасит строку кода И ставит персональный запрет одним вызовом (reason != 'ban')", async () => {
    const owner = await seedUser();
    await seedActiveCode(owner);

    const { data, error } = await sb.rpc("disable_invite_codes_of_user", {
      p_user_id: owner,
      p_reason: "leak",
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true, disabled_count: 1 });

    const code = await codeRow(owner);
    expect(code.disabled_at).not.toBeNull();
    expect(code.disabled_reason).toBe("leak");
    expect(await userRevoked(owner)).not.toBeNull();
  });

  it("reason='ban' - гасит строку, НО не трогает invite_revoked_at (симметрия с reviveBanDisabledCodes)", async () => {
    const owner = await seedUser();
    await seedActiveCode(owner);

    const { data } = await sb.rpc("disable_invite_codes_of_user", { p_user_id: owner, p_reason: "ban" });
    expect(data).toMatchObject({ ok: true });

    const code = await codeRow(owner);
    expect(code.disabled_at).not.toBeNull();
    expect(await userRevoked(owner)).toBeNull(); // персональный запрет НЕ поставлен
  });

  // ⛔ ГЛАВНЫЙ тест раунда исправлений: форсируем сбой ВТОРОГО шага (users)
  // ПОСЛЕ того, как первый шаг (invite_codes) внутри той же функции уже
  // выполнился бы успешно - и проверяем, что он ОТКАТЫВАЕТСЯ вместе со вторым,
  // а не остаётся закоммиченным. Это и есть дыра из ревью Task 8→10: "строка
  // погашена, право приглашать - нет", теперь недостижимая.
  it("сбой ВТОРОГО шага (users) откатывает и ПЕРВЫЙ (invite_codes) - партиального состояния не бывает", async () => {
    const owner = await seedUser();
    await seedActiveCode(owner);
    await installSecondStepFailure();

    const { data, error } = await sb.rpc("disable_invite_codes_of_user", {
      p_user_id: owner,
      p_reason: "leak",
    });
    // RPC честно сообщает о провале - исключение из тела функции вернулось
    // как error транспорта (см. query-builder.ts: catch → {data:null, error}).
    expect(error).not.toBeNull();
    expect(data).toBeNull();
    // Пин: сбой должен прийти ИМЕННО от нашего триггера (второй шаг), а не от
    // чего-то ещё. Без этой проверки тест остался бы зелёным и в случае, если
    // функция упала бы РАНЬШЕ первого UPDATE (например будущий рефакторинг
    // переставил бы операторы местами) - тогда "invite_codes не погашен" было
    // бы верно совсем по другой причине, и тест перестал бы измерять то, что
    // заявлено в его названии.
    expect(error?.message).toContain("simulated failure of invite_revoked_at");

    // ГЛАВНАЯ проверка: строка кода НЕ погашена, несмотря на то, что UPDATE
    // invite_codes стоит В ТЕЛЕ ФУНКЦИИ РАНЬШЕ упавшего UPDATE users. Без
    // транзакции (старый код на два отдельных .from().update()) первая
    // запись осталась бы закоммиченной - ровно та дыра из ревью.
    const code = await codeRow(owner);
    expect(code.disabled_at).toBeNull();
    expect(code.disabled_reason).toBeNull();
    // И персональный запрет тоже не появился - обе половины отката видны.
    expect(await userRevoked(owner)).toBeNull();
  });

  it("сбой второго шага НЕ ломает reason='ban' (тот путь второй шаг вообще не трогает)", async () => {
    const owner = await seedUser();
    await seedActiveCode(owner);
    await installSecondStepFailure();

    // Триггер бьёт ТОЛЬКО по попытке изменить invite_revoked_at - для
    // reason='ban' функция такую попытку не делает вообще, значит сбоя нет.
    const { data, error } = await sb.rpc("disable_invite_codes_of_user", { p_user_id: owner, p_reason: "ban" });
    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true });
    const code = await codeRow(owner);
    expect(code.disabled_at).not.toBeNull();
  });

  it("p_reason пустой - { ok:false, error:'reason_required' }, ничего не гасит", async () => {
    const owner = await seedUser();
    await seedActiveCode(owner);

    const { data } = await sb.rpc("disable_invite_codes_of_user", { p_user_id: owner, p_reason: "" });
    expect(data).toMatchObject({ ok: false, error: "reason_required" });
    const code = await codeRow(owner);
    expect(code.disabled_at).toBeNull(); // никто ничего не тронул
  });
});
