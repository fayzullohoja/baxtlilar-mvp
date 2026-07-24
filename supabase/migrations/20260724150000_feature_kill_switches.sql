-- C-033 — Feature kill switches. Реюзаем app_settings как стор; добавляем набор
-- ключей feature_<name>_enabled и АТОМАРНУЮ, вайтлистящую RPC для одного флага.
-- Значения читаются приложением в рантайме (не константа сборки) → выключение
-- фичи без деплоя. Переключение — super-only роут + запись в admin_audit_log.

create or replace function set_feature_flag(p_admin uuid, p_feature text, p_enabled boolean)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare k text;
begin
  -- вайтлист имён фич прямо в RPC: даже если роут пропустит мусор, произвольный
  -- ключ в стор не попадёт (та же защита, что в set_app_settings).
  if p_feature not in ('verification', 'matching', 'interests', 'chat', 'payments') then
    raise exception 'unknown feature: %', p_feature;
  end if;
  if p_enabled is null then
    raise exception 'enabled must not be null';
  end if;
  k := 'feature_' || p_feature || '_enabled';
  insert into app_settings(key, value, updated_by, updated_at)
  values (k, to_jsonb(p_enabled), p_admin, now())
  on conflict (key) do update
    set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
end$$;

do $$ begin raise notice 'C-033 set_feature_flag + feature_<name>_enabled keys ready.'; end $$;
