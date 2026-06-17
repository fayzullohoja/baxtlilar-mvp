import "server-only";
import type { DbError } from "./query-builder";

/**
 * Распаковать результат запроса набора строк: при ошибке БД — БРОСИТЬ (громкий
 * отказ, видимая ошибка), иначе вернуть строки (или []).
 *
 * Зачем: admin-страницы делают `const { data } = await sb...` и читают только
 * `data`, игнорируя `error`. На рантайм-сбое БД (обрыв соединения, ошибка пула)
 * `run()` возвращает `{ data: null, error }`, и страница тихо рендерит «пусто» —
 * тот же класс «тихо-пустых» страниц, что и embed-баг. Этот хелпер превращает
 * такой сбой в исключение, чтобы он был ВИДЕН, а не маскировался под «нет данных».
 *
 * Применять ТОЛЬКО там, где ошибку и так не обрабатывают (read-only страницы).
 * Call-site'ы, которые осознанно ветвятся по `error` (transition_user→409,
 * bump_quota, process_interest и т.п.), оставлять как есть.
 */
export function unwrapRows<T = unknown>(res: { data: T[] | null; error: DbError | null }): T[] {
  if (res.error) throw new Error(`db query failed: ${res.error.message}`);
  return res.data ?? [];
}
