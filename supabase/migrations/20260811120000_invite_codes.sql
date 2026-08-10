-- Коды-приглашения для закрытого family-запуска.
-- Спека: docs/superpowers/specs/2026-08-11-invite-codes-design.md
--
-- ВАЖНО: новое значение enum нельзя использовать в той же транзакции, где оно
-- добавлено. Здесь оно и не используется - вставка в analytics.funnel_steps идёт
-- текстом, а не enum-значением.

alter type onboarding_step add value if not exists 'bot_invite_code';

create table if not exists invite_codes (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  owner_id        uuid references users(id) on delete cascade,
  label           text,
  disabled_at     timestamptz,
  disabled_reason text,
  created_at      timestamptz not null default now()
);

comment on table invite_codes is
  'Коды-приглашения. owner_id IS NULL = мастер-код владельца (оффлайн-встречи).';

-- Один АКТИВНЫЙ код на человека. Частичный индекс: после гашения тому же
-- человеку можно выпустить новый, старый остаётся в истории.
create unique index if not exists invite_codes_one_active_per_owner
  on invite_codes(owner_id)
  where owner_id is not null and disabled_at is null;

create index if not exists invite_codes_code_active_idx
  on invite_codes(code) where disabled_at is null;

alter table users
  add column if not exists invited_by         uuid references users(id) on delete set null,
  add column if not exists invite_code_id     uuid references invite_codes(id) on delete set null,
  add column if not exists invite_redeemed_at timestamptz,
  add column if not exists invite_exempt      boolean not null default false;

comment on column users.invite_exempt is
  'Вошёл до включения шлагбаума - шаг кода не показывать.';
comment on column users.invite_redeemed_at is
  'Пусто + заполненный invite_code_id = код из ссылки ждёт своего шага.';

create index if not exists users_invited_by_idx on users(invited_by)
  where invited_by is not null;

-- Все, кто зарегистрировался ДО запуска, проходят по старым правилам.
update users set invite_exempt = true where invite_exempt = false;

-- Шаг в справочник воронки Grafana, между "Передача контакта" (3) и
-- "Приветственный экран" (4). Существующие ord сдвигаем на 1.
--
-- ord - первичный ключ без DEFERRABLE, поэтому сдвиг на +1 одним запросом
-- ломается на промежуточном дубликате: строка 4 переезжает в 5, а 5 ещё занята.
-- Сдвигаем в два прохода через заведомо свободный диапазон +1000.
--
-- Двойная проверка, ДВУМЯ вложенными IF (не одним AND):
--  - to_regclass - analytics.funnel_steps создана вручную прямо на проде
--    (это отдельная схема для Grafana, вне supabase/migrations), поэтому в
--    локальной/тестовой БД, поднятой только из миграций, её нет - без этой
--    проверки любой локальный rebuild (npm run test:integration) падал бы
--    здесь с "relation analytics.funnel_steps does not exist". Именно
--    вложенным IF, а не "and not exists (...)" одним выражением: PL/pgSQL
--    разбирает подзапрос вложенного IF только при входе в внешнюю ветку,
--    а составное "A and B" разбирается целиком сразу и падает на этапе
--    парсинга, даже если A уже ложно;
--  - not exists (... step = 'bot_invite_code') - сам сдвиг ord не идемпотентен,
--    без неё повторный прогон сдвинул бы воронку ещё раз и молча испортил
--    порядок шагов.
do $$
begin
  if to_regclass('analytics.funnel_steps') is not null then
    if not exists (select 1 from analytics.funnel_steps where step = 'bot_invite_code') then
      update analytics.funnel_steps set ord = ord + 1000 where ord >= 4;
      update analytics.funnel_steps set ord = ord - 999  where ord >= 1004;
      insert into analytics.funnel_steps (ord, step, phase, label)
      values (4, 'bot_invite_code', 'Бот', 'Код приглашения')
      on conflict (step) do nothing;
    end if;
  end if;
end $$;
