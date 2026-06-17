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

/**
 * Распаковать `count`-запрос (`select('*', { count: 'exact', head: true })`):
 * при ошибке БД — БРОСИТЬ, иначе вернуть число (или 0).
 *
 * Зачем: дашборд читает `pending.count ?? 0`. На сбое БД `count` — null, и
 * виджет показывает «0 заявок на проверке», маскируя реальный бэклог модерации
 * (бизнес-риск: модератор не видит ждущих пользователей). Хелпер делает сбой видимым.
 */
export function unwrapCount(res: { count?: number | null; error: DbError | null }): number {
  if (res.error) throw new Error(`db count query failed: ${res.error.message}`);
  return res.count ?? 0;
}

/**
 * Распаковать одиночный результат (`rpc(...)`, `maybeSingle()`): при ошибке БД —
 * БРОСИТЬ, иначе вернуть строку/объект (или null, если строки нет).
 *
 * Зачем: страница карточки читает `const { data: user } = ...maybeSingle()` и затем
 * `if (!user) notFound()`. На сбое БД `data` — null, и модератор видит ложный 404
 * вместо реально существующего пользователя. Хелпер отделяет «реально нет строки»
 * (null → notFound) от «БД упала» (throw → видимая 500, можно повторить).
 */
export function unwrapOne<T = unknown>(res: { data: T | null; error: DbError | null }): T | null {
  if (res.error) throw new Error(`db query failed: ${res.error.message}`);
  return res.data ?? null;
}
