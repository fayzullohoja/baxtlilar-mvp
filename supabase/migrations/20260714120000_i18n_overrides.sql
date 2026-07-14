-- Конструктор текстовок (Tier 1): DB-оверрайды строк локализации мини-аппа.
-- Оунер: «чтобы каждый раз не лезть в код чтобы просто менять текстовку экранов».
--
-- Модель: оверрайд заменяет ОДНУ листовую строку сообщения (dotted-key путь в
-- messages/<locale>.json, напр. "Anketa.selfTitle"). Наложение делается в
-- getRequestConfig (src/i18n/request.ts) поверх статичного JSON. Значения опций
-- (labelOf) — отдельный Tier 2, здесь НЕ покрываются.
--
-- Кэш-инвалидация: любой write в i18n_overrides бампает счётчик в
-- i18n_overrides_meta через statement-триггер. Оверлей читает этот счётчик
-- (дёшево, single-row) и пересобирает merged-словарь только при изменении версии.
-- Delete-safe: revert (DELETE строки) тоже бампает версию, в отличие от
-- max(updated_at), который на удалении не двигается.

create table if not exists i18n_overrides (
  id          uuid primary key default gen_random_uuid(),
  locale      text not null check (locale in ('ru', 'uz', 'en', 'tr')),
  -- dotted-путь до листовой строки в messages/<locale>.json (напр. "Anketa.selfTitle").
  -- Валидность (ключ реально существует и указывает на строку) проверяется в
  -- PUT-роуте по статичному JSON — здесь это свободный текст.
  key         text not null,
  value       text not null,
  -- кто последним правил (для «изменено кем» в UI). Полный трейл — в admin_audit_log.
  -- Без FK: намеренно развязано от таблицы админов (переживает миграции ролей).
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  unique (locale, key)
);

create index if not exists idx_i18n_overrides_locale on i18n_overrides (locale);

-- Single-row счётчик версии словаря оверрайдов. Читается оверлеем на каждый
-- (кэшируемый) запрос — дёшево. Бампается триггером на любой write.
create table if not exists i18n_overrides_meta (
  id       boolean primary key default true check (id = true),
  version  bigint not null default 1
);
insert into i18n_overrides_meta (id, version) values (true, 1)
  on conflict (id) do nothing;

create or replace function bump_i18n_overrides_version()
returns trigger language plpgsql as $$
begin
  update i18n_overrides_meta set version = version + 1 where id = true;
  return null; -- statement-level AFTER trigger: возвращаемое значение игнорируется
end $$;

drop trigger if exists trg_bump_i18n_overrides_version on i18n_overrides;
create trigger trg_bump_i18n_overrides_version
  after insert or update or delete on i18n_overrides
  for each statement execute function bump_i18n_overrides_version();
