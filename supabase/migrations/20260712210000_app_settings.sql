-- Волна 7 Фаза 3 — системные настройки. Минимальный key-value стор (НЕ config-
-- движок): набор ключей фиксирован в коде (lib/admin/settings.ts), здесь — только
-- их значения. Реальные редактируемые значения: баннер-объявление для админов и
-- порог SLA дашборда. Апсерт из super-гейченного роута.

create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references admin_users(id),
  updated_at timestamptz not null default now()
);

-- Апсерт набора настроек за раз. Ключи ВАЙТЛИСТЯТСЯ прямо в RPC — даже если роут
-- пропустит мусор, произвольные ключи в стор не попадут.
create or replace function set_app_settings(p_admin uuid, p_settings jsonb)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare k text; v jsonb;
begin
  for k, v in select * from jsonb_each(p_settings) loop
    if k not in ('banner_on', 'banner_text', 'sla_warn_hours') then
      continue;
    end if;
    insert into app_settings(key, value, updated_by, updated_at)
    values (k, v, p_admin, now())
    on conflict (key) do update
      set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  end loop;
end$$;

do $$ begin raise notice 'Wave 7 app_settings + set_app_settings ready.'; end $$;
