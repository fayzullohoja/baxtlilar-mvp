-- VF-1 — Единый источник истины для очереди верификации.
--
-- Проблема: инвариант «users.verification_status='pending_review' ⟺ ровно один
-- открытый verification_case» держался на ad-hoc вставках в selfie/route.ts и
-- backfill-миграции. Путь needs_changes → /api/onboarding/fix делает только UPDATE
-- users (без вставки кейса) → юзер попадает в счётчик дашборда, но исчезает из
-- очереди (load-queue читает verification_cases) и застревает навсегда.
--
-- Решение: перенести создание кейса в БД. Один триггер на users ловит ВСЕ пути в
-- pending_review (selfie-submit, fix-resubmit, admin-unblock) атомарно и идемпотентно.
-- Партиальный unique index гарантирует не более одного открытого кейса на юзера.

-- 1) Функция: гарантировать открытый кейс при входе в pending_review.
create or replace function ensure_open_verification_case()
returns trigger
language plpgsql
as $$
begin
  -- На UPDATE реагируем только на реальную смену статуса (не на no-op апдейты
  -- прочих полей у уже-pending_review юзера).
  if tg_op = 'UPDATE' and old.verification_status is not distinct from new.verification_status then
    return null;
  end if;

  if new.verification_status <> 'pending_review' then
    return null;
  end if;

  -- Идемпотентно: создаём открытый кейс только если открытого ещё нет.
  if not exists (
    select 1 from verification_cases
    where user_id = new.id and state <> 'closed'
  ) then
    insert into verification_cases (user_id, state) values (new.id, 'new');
  end if;

  return null;
end;
$$;

-- 2) Триггер. `update of verification_status` — срабатывает только когда колонка
--    в SET-списке; WHEN сужает до входа в pending_review. OLD в WHEN не трогаем
--    (нельзя в combined insert-or-update триггере) — дедуп смены статуса в теле.
drop trigger if exists users_ensure_verification_case on users;
create trigger users_ensure_verification_case
  after insert or update of verification_status on users
  for each row
  when (new.verification_status = 'pending_review')
  execute function ensure_open_verification_case();

-- 3) Дедуп существующих данных перед unique-индексом: если у юзера уже >1
--    открытого кейса (легаси ad-hoc вставки), оставляем самый ранний, остальные
--    закрываем. На чистом проде no-op.
with ranked as (
  select id,
         row_number() over (partition by user_id order by created_at, id) as rn
  from verification_cases
  where state <> 'closed'
)
update verification_cases vc
set state = 'closed'
from ranked r
where vc.id = r.id and r.rn > 1;

-- 4) Инвариант на уровне БД: максимум один открытый кейс на юзера.
create unique index if not exists verification_cases_one_open_per_user
  on verification_cases (user_id)
  where state <> 'closed';

-- 5) Бэкфилл: любой текущий pending_review без открытого кейса получает его.
insert into verification_cases (user_id, state)
select u.id, 'new'
from users u
where u.verification_status = 'pending_review'
  and not exists (
    select 1 from verification_cases vc
    where vc.user_id = u.id and vc.state <> 'closed'
  );
