import "server-only";
import { types } from "pg";

/**
 * Привести парсеры типов node-pg к тому, что отдавал Supabase/PostgREST, под который
 * писалась вся кодовая база:
 *  - timestamptz/timestamp → СТРОКА (сырой Postgres-формат "2026-06-16 13:57:32.205+00"),
 *    а не JS Date. Иначе ломаются: курсор SSE-чата (`cursor.replace(" ","T")`),
 *    сравнения read_through, клиентская нормализация дат, и т.п.
 *  - date → СТРОКА "YYYY-MM-DD" (иначе Date со сдвигом TZ ломает ageFromDate/возраст).
 *  - int8/bigint → number (telegram_id; PostgREST отдавал число, код ждёт `as number`).
 *    Безопасно: telegram_id < 2^53.
 *
 * Вызывается один раз до создания пула. Парсеры в node-pg глобальные.
 */
let configured = false;

export function configurePgTypes(): void {
  if (configured) return;
  const asString = (v: string): string => v; // вернуть сырую строку без парсинга
  types.setTypeParser(1184, asString); // timestamptz
  types.setTypeParser(1114, asString); // timestamp
  types.setTypeParser(1082, asString); // date
  types.setTypeParser(20, (v: string) => Number(v)); // int8 / bigint → number
  configured = true;
}
