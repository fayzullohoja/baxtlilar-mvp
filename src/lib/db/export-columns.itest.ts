import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { configurePgTypes } from "./pg-types";
import { createDbClient } from "./query-builder";

/**
 * Страж против «выгрузка приходит молча неполной».
 *
 * Выгрузка своих данных запрашивала у user_state_transitions колонки
 * from_state/to_state, которых не существует (они называются
 * from_value/to_value). Запрос падал, ошибка глоталась через `?? []`, и человек
 * получал файл с ВСЕГДА пустой историей статусов - без признака потери, при
 * этом сгорала суточная попытка выгрузки.
 *
 * Тест бьёт по живой базе тем же набором колонок, что и роут: если кто-то
 * снова переименует колонку или опечатается, запрос упадёт здесь, а не у
 * человека, реализующего своё право на выгрузку.
 */
let pool: Pool;
let sb: ReturnType<typeof createDbClient>;

beforeAll(() => {
  configurePgTypes();
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  sb = createDbClient((text, values) => pool.query(text, values));
});

afterAll(async () => {
  await pool.end();
});

describe("колонки выгрузки персональных данных", () => {
  it("история статусов читается и наполняется", async () => {
    const uid = randomUUID();
    await pool.query(
      `insert into users(id, telegram_id, lifecycle_state, onboarding_step, verification_status)
       values ($1, $2, 'active', 'active', 'approved')`,
      [uid, 970000000 + Math.floor(Math.random() * 900000)],
    );
    await pool.query(
      `insert into user_state_transitions(user_id, field, from_value, to_value, reason, triggered_by_kind)
       values ($1, 'verification_status', 'pending_review', 'approved', 'тест', 'admin')`,
      [uid],
    );

    const res = await sb
      .from("user_state_transitions")
      .select("field, from_value, to_value, reason, triggered_by_kind, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });

    expect(res.error, `запрос упал: ${res.error?.message}`).toBeFalsy();
    expect(res.data?.length, "раздел истории статусов пришёл пустым").toBe(1);
    const row = res.data![0] as Record<string, unknown>;
    expect(row.field).toBe("verification_status");
    expect(row.from_value).toBe("pending_review");
    expect(row.to_value).toBe("approved");

    await pool.query("delete from user_state_transitions where user_id = $1", [uid]);
    await pool.query("delete from users where id = $1", [uid]);
  });

  it("несуществующая колонка честно даёт ошибку, а не пустоту", async () => {
    const res = await sb
      .from("user_state_transitions")
      .select("from_state, to_state")
      .limit(1);
    // Именно так падал прежний запрос. Убеждаемся, что такое не проходит молча.
    expect(res.error, "выборка несуществующих колонок обязана дать ошибку").toBeTruthy();
  });
});
