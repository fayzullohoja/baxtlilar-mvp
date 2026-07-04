-- LC-1 — обогащение consents под юр-требования РУз «О ПД»: жизненный цикл
-- согласия (active/withdrawn/outdated), источник, correlation-id действия,
-- категории ПД, отзыв. Плюс два RPC:
--   record_consent   — единая точка записи (insert-or-REACTIVATE);
--   withdraw_consents — статус-флип active→withdrawn (proof сохраняется).
--
-- Гейтится на юриста (см. docs/lawyer-brief-2026-07-04.md): нужны ли ОТДЕЛЬНЫЕ
-- гранулярные согласия на спец-категории (религия/здоровье/финансы) или зонтичного
-- pd-согласия достаточно. Если нужны гранулярные — самый дешёвый путь: доп.
-- типизированные/категоризированные строки в ТОТ ЖЕ момент бот-согласия (эта
-- схема это уже поддерживает через consent_type + categories), а НЕ новые экраны.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'consent_status') then
    create type consent_status as enum ('active','withdrawn','outdated');
  end if;
end $$;

alter table consents
  add column if not exists consent_status consent_status not null default 'active',
  add column if not exists source text not null default 'tg_bot',
  -- волатильный default → при backfill каждая существующая строка получает
  -- собственный uuid (per-row в бэкфилле); новые батчи группируются в record_consent.
  add column if not exists action_id text not null default gen_random_uuid()::text,
  add column if not exists categories text[],
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawn_reason text,
  add column if not exists telegram_id bigint;

create index if not exists consents_user_status_idx on consents(user_id, consent_status);

-- record_consent — insert-or-reactivate. ON CONFLICT по существующему
-- UNIQUE(user_id, consent_type, consent_version). Реактивация (advisor-edge):
-- свежее явное согласие ПОСЛЕ отзыва снимает withdrawn и возвращает active —
-- иначе «отзыв залипает». Один action_id на весь батч типов.
create or replace function record_consent(
  p_user_id     uuid,
  p_telegram_id bigint,
  p_types       text[],
  p_version     text,
  p_language    text,
  p_sha         text,
  p_source      text,
  p_categories  text[],
  p_ip          text default null,
  p_user_agent  text default null
) returns void
language plpgsql
as $$
declare v_action_id text := gen_random_uuid()::text;
begin
  insert into consents (
    user_id, telegram_id, consent_type, consent_version, language,
    consent_text_sha256, source, categories, action_id, ip, user_agent,
    consent_status, accepted_at
  )
  select p_user_id, p_telegram_id, t, p_version, p_language,
         p_sha, p_source, p_categories, v_action_id, p_ip, p_user_agent,
         'active', now()
  from unnest(p_types) as t
  on conflict (user_id, consent_type, consent_version) do update set
    consent_status      = 'active',
    withdrawn_at        = null,
    withdrawn_reason    = null,
    accepted_at         = now(),
    source              = excluded.source,
    categories          = excluded.categories,
    language            = excluded.language,
    consent_text_sha256 = excluded.consent_text_sha256,
    action_id           = excluded.action_id,
    telegram_id         = excluded.telegram_id;
end $$;

-- withdraw_consents — механизм отзыва (LC-7 UI отложен до решения юриста о
-- retention). НЕ удаляет строку: proof-of-consent сохраняется, статус меняется.
-- p_types = null → все активные; иначе только перечисленные типы.
create or replace function withdraw_consents(
  p_user_id uuid,
  p_reason  text default null,
  p_types   text[] default null
) returns integer
language plpgsql
as $$
declare n integer;
begin
  update consents
     set consent_status = 'withdrawn',
         withdrawn_at = now(),
         withdrawn_reason = p_reason
   where user_id = p_user_id
     and consent_status = 'active'
     and (p_types is null or consent_type = any(p_types));
  get diagnostics n = row_count;
  return n;
end $$;
