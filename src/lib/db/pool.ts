import "server-only";
import { Pool } from "pg";
import { env } from "@/lib/env";
import { configurePgTypes } from "./pg-types";

// Единый пул соединений к Postgres (Railway). На внутренней сети Railway
// (*.railway.internal) SSL не нужен; для внешних хостов включаем по PGSSL=require.
let _pool: Pool | null = null;

// F-115: серверные ограничения, чтобы кривой запрос или забытая транзакция
// не съели весь пул:
//  - statement_timeout=10s — Postgres сам прибивает медленный запрос
//    (расследовать в pg_stat_activity по application_name);
//  - idle_in_transaction_session_timeout=60s — забытая открытая транзакция
//    освобождает соединение через минуту;
//  - application_name — корреляция в pg_stat_activity / логе DBA.
const PG_OPTIONS =
  "-c statement_timeout=10000 -c idle_in_transaction_session_timeout=60000 -c application_name=baxtlilar-web";

export function pool(): Pool {
  if (!_pool) {
    configurePgTypes(); // timestamptz/date → строки, bigint → number (паритет с PostgREST)
    const useSsl = process.env.PGSSL === "require";
    _pool = new Pool({
      connectionString: env().DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PG_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      options: PG_OPTIONS,
    });
    // F-115: без on('error') Node.js КРАШИТСЯ при transient TCP RST на idle
    // клиенте. Логируем и продолжаем — pg сам удалит клиента из пула.
    _pool.on("error", (err) => {
      console.error("[pg.pool] idle client error:", err.message);
    });
  }
  return _pool;
}
