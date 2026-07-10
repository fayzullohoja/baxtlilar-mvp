-- 20260711010000_employment_status.sql
-- Ревью оунера Экран 4: разделить «занятость» на «Текущий статус занятости»
-- (новое поле) и «Формат работы» (существующее employment_format, теперь
-- условное/опциональное). Добавляем hot-колонку employment_status + CHECK.
-- Идемпотентно.

alter table user_profiles
  add column if not exists employment_status text;

alter table user_profiles
  drop constraint if exists user_profiles_employment_status_chk;
alter table user_profiles
  add constraint user_profiles_employment_status_chk
  check (
    employment_status is null
    or employment_status in (
      'working',
      'entrepreneur',
      'freelancer',
      'student',
      'home_family',
      'not_working',
      'na'
    )
  );

comment on column user_profiles.employment_status is
  'Anketa Экран 4. Текущий статус занятости. working|entrepreneur|freelancer|student|home_family|not_working|na.';
