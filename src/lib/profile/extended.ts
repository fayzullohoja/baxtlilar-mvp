import "server-only";
import { EXTENDED_SCHEMA_VERSION } from "./schemas";

/**
 * C-099 — версионирование ответов анкеты.
 *
 * EXTENDED_SCHEMA_VERSION раньше был «мёртвым контрактом»: жил в zod-схеме и тесте,
 * но в прод НЕ писался, а колонки версии в user_profiles не было. После смены
 * формы cold-полей старые профили нельзя было отличить от новых и корректно
 * трактовать/мигрировать.
 *
 * stampExtended проставляет текущую версию в extended._meta.schema_version при
 * КАЖДОЙ записи cold-полей. Триггер user_profiles зеркалит её в колонку
 * schema_version (для запросов), не трогая её при hot-only обновлениях. Так версия
 * отражает форму именно сохранённого extended-блоба, а не «последнее касание».
 */
export function stampExtended(extended: Record<string, unknown>): Record<string, unknown> {
  const prevMeta = (extended._meta as Record<string, unknown> | undefined) ?? {};
  return { ...extended, _meta: { ...prevMeta, schema_version: EXTENDED_SCHEMA_VERSION } };
}
