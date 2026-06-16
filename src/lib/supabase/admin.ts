import "server-only";
import { pool } from "@/lib/db/pool";
import { createDbClient } from "@/lib/db/query-builder";
import { createStorage } from "@/lib/storage/fs-store";

/**
 * Серверный клиент доступа к данным. Имя сохранено по историческим причинам —
 * под капотом теперь native Postgres (node-pg) + файловое хранилище (Railway Volume),
 * без Supabase/PostgREST. Поверхность .from()/.rpc()/.storage сохранена, чтобы не
 * переписывать call-site'ы. Только на сервере (service-уровень доступа, без RLS).
 */
let _client: ReturnType<typeof build> | null = null;

function build() {
  const db = createDbClient((text, values) => pool().query(text, values));
  return { from: db.from, rpc: db.rpc, storage: createStorage() };
}

export function supabaseAdmin() {
  if (!_client) _client = build();
  return _client;
}
