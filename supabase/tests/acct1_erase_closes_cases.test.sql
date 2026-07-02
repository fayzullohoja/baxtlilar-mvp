-- ACCT-1 — erase_user (self-delete) обязан закрывать открытые verification_cases,
-- иначе удалённый юзер остаётся «призраком» в очереди модерации (и нарушает
-- VF-1-инвариант «pending_review ⟺ открытый кейс» на противоположном конце).

begin;

do $$
declare
  uid uuid;
  n int;
begin
  insert into users (telegram_id, verification_status, onboarding_step, lifecycle_state)
    values (990009001, 'needs_changes', 'selfie_upload', 'onboarding')
    returning id into uid;

  -- переход в pending_review → VF-1-триггер заводит открытый кейс
  update users set verification_status = 'pending_review' where id = uid;

  select count(*) into n from verification_cases where user_id = uid and state <> 'closed';
  if n <> 1 then
    raise exception 'setup: ожидался 1 открытый кейс, получено %', n;
  end if;

  perform erase_user(uid);

  select count(*) into n from verification_cases where user_id = uid and state <> 'closed';
  if n <> 0 then
    raise exception 'ACCT-1: erase_user оставил % открытых кейс(ов) у удалённого юзера', n;
  end if;

  raise notice 'ACCT-1: erase closes cases OK';
end $$;

rollback;
