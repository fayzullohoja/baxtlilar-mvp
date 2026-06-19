-- 20260619200000_identity_binding.sql
-- Phase F-006 + F-007 (security-audit 2026-06-19):
--   F-006: cooldown на повторную регистрацию с тем же телефоном после delete,
--          чтобы один человек не крутил delete→re-register и не обнулял жалобы/
--          блоки жертвы (identity-reset loop).
--   F-007: дедуп паспортов/селфи по sha256 — катфиш использует ту же
--          фотографию документа на N аккаунтах.
--
-- Безопасное (additive): новые таблицы/колонки. Старый UNIQUE на
-- users(telegram_id) заменяется на partial UNIQUE, чтобы re-register того же
-- TG-аккаунта стал возможен ПОСЛЕ delete (см. soft-delete в /api/account).

-- F-006: партиал-UNIQUE по telegram_id (только активные строки).
-- Старая constraint держит UNIQUE на ВСЕХ строках включая deleted — мешает
-- новой регистрации с тем же TG-id после delete.
alter table users drop constraint if exists users_telegram_id_key;
create unique index if not exists users_telegram_id_active_unique
  on users(telegram_id)
  where lifecycle_state <> 'deleted';

-- F-006: список заблокированных телефонов на N дней. Запись добавляется при
-- /api/account?action=delete (phone_hash посчитан до обнуления номера).
-- Бот проверяет phone_blacklist в handleContact до апсерта.
create table if not exists phone_blacklist (
  id uuid primary key default gen_random_uuid(),
  phone_hash text not null,
  blocked_at timestamptz not null default now(),
  until_at timestamptz not null,
  reason text
);
-- index без WHERE-предиката (now() — STABLE, не IMMUTABLE, и Postgres
-- запрещает её в predicate'е). Без предиката индекс покрывает все строки;
-- запросы вида WHERE phone_hash=? AND until_at>now() прекрасно его используют.
create index if not exists phone_blacklist_hash_idx
  on phone_blacklist(phone_hash);

-- F-007: sha256 паспорта и селфи (hex 64 chars). Считается на upload, дедуп
-- на admin-approve: одинаковый passport_sha256 у двух approved строк = тот же
-- документ → отказ модератора с reason 'duplicate_identity'.
alter table user_documents
  add column if not exists passport_sha256 text,
  add column if not exists selfie_sha256 text;

-- partial-индексы по approved-строкам: дешёвый lookup для дедупа.
create index if not exists user_documents_passport_sha256_approved_idx
  on user_documents(passport_sha256)
  where passport_sha256 is not null and status = 'approved';
create index if not exists user_documents_selfie_sha256_approved_idx
  on user_documents(selfie_sha256)
  where selfie_sha256 is not null and status = 'approved';
