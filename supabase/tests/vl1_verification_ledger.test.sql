-- Инвариант 8: любое изменение users.verification_status попадает в
-- user_state_transitions ровно ОДИН раз (страховочный deferred-триггер).
--
-- Триггер DEFERRABLE INITIALLY DEFERRED — в проде срабатывает при COMMIT, когда
-- все вставки RPC уже сделаны (во всех status-RPC порядок: update users → insert
-- ledger, поэтому НЕотложенный триггер давал бы дубли). В тесте моделируем это
-- честно: сначала выполняем все изменения, затем SET CONSTRAINTS ALL IMMEDIATE
-- (форсирует отложенные срабатывания), и только потом проверяем.
begin;
set local search_path = public;
create temp sequence _vl_tid;
create temp table _vl (tag text primary key, uid uuid);

create or replace function _vl_user(p_ver verification_status) returns uuid language plpgsql as $$
declare uid uuid := gen_random_uuid();
begin
  insert into users(id, telegram_id, lifecycle_state, onboarding_step, verification_status)
  values (uid, nextval('_vl_tid'), 'onboarding', 'moderation_pending', p_ver);
  return uid;
end$$;

-- ── фаза 1: изменения (триггеры ещё отложены) ────────────────────────────────
do $$
declare u uuid;
begin
  -- 1) сырой update (как в admin_approve_verification) — журнал никто не пишет
  u := _vl_user('pending_review');
  insert into _vl values ('approve', u);
  update users set verification_status = 'approved' where id = u;

  -- 2) needs_changes (как в admin_reject_verification)
  u := _vl_user('pending_review');
  insert into _vl values ('needs_changes', u);
  update users set verification_status = 'needs_changes' where id = u;

  -- 3) RPC, который пишет журнал САМ (порядок как в blocking_reject: update → insert)
  u := _vl_user('pending_review');
  insert into _vl values ('self_written', u);
  update users set verification_status = 'rejected' where id = u;
  insert into user_state_transitions(user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
  values (u, 'verification_status', 'pending_review', 'rejected', 'rpc wrote it', 'admin', null);

  -- 4) смена НЕ-статусного поля
  u := _vl_user('approved');
  insert into _vl values ('other_field', u);
  update users set language = 'uz' where id = u;
end$$;

-- форсируем срабатывание отложенных триггеров (эквивалент COMMIT в проде)
set constraints all immediate;

-- ── фаза 2: проверки ─────────────────────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from user_state_transitions t join _vl v on v.uid = t.user_id
   where v.tag = 'approve' and t.field = 'verification_status' and t.to_value = 'approved';
  assert n = 1, 'сырой approve должен попасть в журнал ровно 1 раз, got ' || n;

  select count(*) into n from user_state_transitions t join _vl v on v.uid = t.user_id
   where v.tag = 'needs_changes' and t.field = 'verification_status' and t.to_value = 'needs_changes';
  assert n = 1, 'needs_changes должен попасть в журнал, got ' || n;

  select count(*) into n from user_state_transitions t join _vl v on v.uid = t.user_id
   where v.tag = 'self_written' and t.field = 'verification_status' and t.to_value = 'rejected';
  assert n = 1, 'запись RPC не должна дублироваться триггером, got ' || n;

  select count(*) into n from user_state_transitions t join _vl v on v.uid = t.user_id
   where v.tag = 'other_field' and t.field = 'verification_status';
  assert n = 0, 'смена не-статусного поля не должна писать в журнал, got ' || n;
end$$;

drop function _vl_user(verification_status);
rollback;
do $$ begin raise notice '✓ vl1 verification ledger trigger OK'; end $$;
