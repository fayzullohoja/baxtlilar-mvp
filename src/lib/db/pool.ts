import "server-only";
import { Pool } from "pg";
import { env } from "@/lib/env";
import { configurePgTypes } from "./pg-types";

// Единый пул соединений к Postgres (Railway). На внутренней сети Railway
// (*.railway.internal) SSL не нужен; для внешних хостов включаем по PGSSL=require.
let _pool: Pool | null = null;

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
    });
  }
  return _pool;
}
