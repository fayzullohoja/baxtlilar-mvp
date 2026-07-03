import "server-only";
import { Pool } from "pg";
import { env } from "@/lib/env";
import { configurePgTypes } from "./pg-types";

// Единый пул соединений к Postgres (Railway). На внутренней сети Railway
// (*.railway.internal) SSL не нужен; для внешних хостов включаем по PGSSL=require.
let _pool: Pool | null = null;

// F-115 → DB-1: серверные ограничения (statement_timeout=10s,
// idle_in_transaction_session_timeout=60s, application_name) заданы на РОЛИ
// приложения миграцией 20260703020000_db1_role_gucs.sql, а не через
// connection-options: PgBouncer transaction-mode startup options не пропускает,
// а role-GUC работают одинаково с пулером и без.
//
// Топология подключений (DB-1):
//  - DATABASE_URL — рабочий путь; после ввода PgBouncer указывает на пулер
//    (transaction-mode, :6543), см. docs/pgbouncer-railway.md;
//  - DATABASE_DIRECT_URL — прямой Postgres (:5432) для миграций и будущего
//    LISTEN/NOTIFY-листенера чата (DB-3): LISTEN в transaction-mode не живёт.

export function pool(): Pool {
  if (!_pool) {
    configurePgTypes(); // timestamptz/date → строки, bigint → number (паритет с PostgREST)
    const useSsl = process.env.PGSSL === "require";
    _pool = new Pool({
      connectionString: env().DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PG_POOL_MAX ?? 15),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    // F-115: без on('error') Node.js КРАШИТСЯ при transient TCP RST на idle
    // клиенте. Логируем и продолжаем — pg сам удалит клиента из пула.
    _pool.on("error", (err) => {
      console.error("[pg.pool] idle client error:", err.message);
    });
  }
  return _pool;
}
