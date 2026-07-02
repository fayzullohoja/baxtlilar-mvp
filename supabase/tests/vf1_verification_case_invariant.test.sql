-- VF-1 — Инвариант очереди верификации (single source of truth).
--
-- Правило: как только users.verification_status='pending_review', у юзера должен
-- существовать РОВНО ОДИН открытый verification_case (state <> 'closed').
-- Инвариант обязан держаться на ЛЮБОМ пути в pending_review:
--   selfie-submit, needs_changes→resubmit (/api/onboarding/fix), admin-unblock.
--
-- Тест транзакционный (rollback в конце) — ничего не коммитит.
-- Любое нарушение → RAISE EXCEPTION → psql -v ON_ERROR_STOP=1 падает (RED).

begin;

-- Хелпер: открытых кейсов у юзера
create or replace function _open_cases(p uuid) returns int language sql as
$$ select count(*)::int from verification_cases where user_id = p and state <> 'closed' $$;

do $$
declare
  uid uuid;
  n int;
begin
  ---------------------------------------------------------------------------
  -- ПУТЬ A — needs_changes → повторная подача через /api/onboarding/fix.
  -- Роут делает ТОЛЬКО UPDATE users (без app-level вставки кейса). Это баг VF-1.
  ---------------------------------------------------------------------------
  insert into users (telegram_id, verification_status, onboarding_step, lifecycle_state)
    values (990000001, 'needs_changes', 'selfie_upload', 'onboarding')
    returning id into uid;

  update users set verification_status = 'pending_review', onboarding_step = 'moderation_pending'
    where id = uid;

  n := _open_cases(uid);
  if n <> 1 then
    raise exception 'FIX PATH: ожидался 1 открытый кейс, получено %', n;
  end if;

  ---------------------------------------------------------------------------
  -- ПУТЬ B — идемпотентность. Повторный переход в pending_review (напр. второй
  -- needs_changes-цикл) НЕ должен плодить второй открытый кейс.
  ---------------------------------------------------------------------------
  update users set verification_status = 'needs_changes' where id = uid;
  update users set verification_status = 'pending_review' where id = uid;

  n := _open_cases(uid);
  if n <> 1 then
    raise exception 'IDEMPOTENCY: ожидался 1 открытый кейс после повторного pending_review, получено %', n;
  end if;

  ---------------------------------------------------------------------------
  -- ПУТЬ C — selfie-submit: первый переход в pending_review у свежего юзера.
  ---------------------------------------------------------------------------
  insert into users (telegram_id, verification_status, onboarding_step, lifecycle_state)
    values (990000002, 'liveness_uploaded', 'selfie_upload', 'onboarding')
    returning id into uid;

  update users set verification_status = 'pending_review', onboarding_step = 'moderation_pending'
    where id = uid;

  n := _open_cases(uid);
  if n <> 1 then
    raise exception 'SELFIE PATH: ожидался 1 открытый кейс, получено %', n;
  end if;

  ---------------------------------------------------------------------------
  -- ПУТЬ D — admin-unblock: юзер с закрытым кейсом снова уходит в pending_review.
  -- Закрытый кейс не считается открытым → должен появиться новый открытый.
  ---------------------------------------------------------------------------
  insert into users (telegram_id, verification_status, onboarding_step, lifecycle_state)
    values (990000003, 'rejected', 'moderation_pending', 'onboarding')
    returning id into uid;
  insert into verification_cases (user_id, state) values (uid, 'closed');

  update users set verification_status = 'pending_review' where id = uid;

  n := _open_cases(uid);
  if n <> 1 then
    raise exception 'UNBLOCK PATH: ожидался 1 открытый кейс (закрытый не в счёт), получено %', n;
  end if;

  ---------------------------------------------------------------------------
  -- ПУТЬ E — переход НЕ в pending_review (напр. approved) кейс не создаёт.
  ---------------------------------------------------------------------------
  insert into users (telegram_id, verification_status, onboarding_step, lifecycle_state)
    values (990000004, 'pending_review', 'moderation_pending', 'onboarding')
    returning id into uid;
  update users set verification_status = 'approved' where id = uid;

  -- сам approve не обязан удалять открытый кейс (его закрывает admin-RPC),
  -- но и НЕ должен создавать новый сверх того, что уже был.
  n := (select count(*)::int from verification_cases where user_id = uid);
  if n > 1 then
    raise exception 'APPROVE PATH: approve не должен плодить лишние кейсы, всего %', n;
  end if;

  raise notice 'VF-1 invariant: ALL PATHS PASS';
end $$;

rollback;
