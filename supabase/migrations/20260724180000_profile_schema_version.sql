-- C-099 — версионирование ответов анкеты (schema_version в хранилище).
--
-- Было: EXTENDED_SCHEMA_VERSION/_meta.schema_version жили только в zod-схеме
-- (мёртвый контракт), в прод не писались; колонки версии не было. После смены
-- формы cold-полей старые профили не отличить и не мигрировать.
--
-- Стало: колонка user_profiles.schema_version (default 1 → backfill existing) +
-- триггер, который зеркалит extended._meta.schema_version в колонку. Приложение
-- проставляет _meta через stampExtended (src/lib/profile/extended.ts) при записи
-- cold-полей; hot-only обновления _meta не трогают → колонка не «протухает».

alter table user_profiles
  add column if not exists schema_version int not null default 1;

-- Триггер: колонка = версия из свежего extended._meta, иначе сохраняем прежнюю
-- (на update NEW.schema_version уже несёт OLD-значение), иначе 1. Так версия
-- меняется ТОЛЬКО когда extended-блоб реально перезаписан с _meta.
create or replace function user_profiles_sync_schema_version()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.schema_version := coalesce(
    (new.extended -> '_meta' ->> 'schema_version')::int,
    new.schema_version,
    1
  );
  return new;
end$$;

drop trigger if exists trg_user_profiles_schema_version on user_profiles;
create trigger trg_user_profiles_schema_version
  before insert or update on user_profiles
  for each row execute function user_profiles_sync_schema_version();

-- Backfill: у существующих строк колонка уже 1 (default). Если у кого-то в
-- extended._meta уже лежит версия — подтянем её в колонку.
update user_profiles
   set schema_version = coalesce((extended -> '_meta' ->> 'schema_version')::int, 1)
 where extended ? '_meta';

do $$ begin raise notice 'C-099 user_profiles.schema_version + sync trigger ready.'; end $$;
