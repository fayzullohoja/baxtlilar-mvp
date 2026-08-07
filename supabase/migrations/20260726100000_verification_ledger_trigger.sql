-- Ревью (инвариант 8): admin_approve_verification и admin_reject_verification
-- меняют users.verification_status сырым UPDATE и НЕ пишут в обязательный журнал
-- user_state_transitions — в отличие от всех прочих status-RPC (ban/unban/
-- blocking_reject/unblock/restart/erase). Ключевые решения верификации
-- (approved / needs_changes / rejected) нереконструируемы по журналу.
--
-- Чиним не переписыванием двух больших RPC (рискованно), а СТРАХОВОЧНОЙ сетью:
-- DEFERRABLE INITIALLY DEFERRED constraint-триггер срабатывает в КОНЦЕ транзакции,
-- когда все вставки в журнал уже сделаны. Поэтому он:
--   * пишет запись, если её никто не сделал (approve/reject — закрываем пробел);
--   * НЕ дублирует тех, кто пишет сам (blocking_reject/unblock/restart/transition_user),
--     так как видит их незакоммиченные строки в той же транзакции;
--   * покрывает и любой БУДУЩИЙ сырой UPDATE статуса (defense-in-depth).

create or replace function log_verification_status_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Триггер отложен до конца транзакции, поэтому к моменту срабатывания строка
  -- users могла быть УДАЛЕНА в той же транзакции (admin_hard_delete_user, erase,
  -- cascade). Вставка ledger для несуществующего юзера нарушила бы FK и уронила
  -- бы всю транзакцию удаления — молча выходим (журналировать уже некого).
  if not exists (select 1 from users where id = new.id) then
    return null;
  end if;

  -- now() = время НАЧАЛА транзакции; строки, вставленные в этой же транзакции,
  -- видны и имеют created_at = now(), поэтому проверка ловит «уже записано».
  if not exists (
    select 1 from user_state_transitions
     where user_id = new.id
       and field = 'verification_status'
       and to_value = new.verification_status::text
       and created_at >= now()
  ) then
    insert into user_state_transitions(
      user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id
    ) values (
      new.id, 'verification_status',
      old.verification_status::text, new.verification_status::text,
      'auto-ledger: verification status changed outside transition_user',
      'system', null
    );
  end if;
  return null;
end$$;

drop trigger if exists trg_users_verification_ledger on users;
create constraint trigger trg_users_verification_ledger
  after update on users
  deferrable initially deferred
  for each row
  when (old.verification_status is distinct from new.verification_status)
  execute function log_verification_status_change();

do $$ begin raise notice 'Verification ledger safety-net trigger ready.'; end $$;
