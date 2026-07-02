-- ADMIN-2 — повторный claim кейса тем же модератором не должен откатывать
-- прогресс (data_entry / ready_to_decide → assigned). Стейт-машина запрещает
-- обратные переходы; лишний POST /claim не должен их провоцировать.

begin;

do $$
declare
  uid uuid; adm uuid; cid uuid; r jsonb; st verification_case_state;
begin
  insert into admin_users (login, role, password_hash)
    values ('t_admin2', 'moderator', 'x') returning id into adm;

  insert into users (telegram_id, verification_status, onboarding_step, lifecycle_state)
    values (990009200, 'needs_changes', 'selfie_upload', 'onboarding') returning id into uid;
  update users set verification_status = 'pending_review' where id = uid; -- VF-1 триггер → кейс 'new'
  select id into cid from verification_cases where user_id = uid and state <> 'closed';

  r := admin_claim_verification(cid, adm);          -- new → assigned
  update verification_cases set state = 'data_entry' where id = cid; -- модератор дошёл до ввода

  r := admin_claim_verification(cid, adm);          -- повторный claim тем же админом
  select state into st from verification_cases where id = cid;
  if st <> 'data_entry' then
    raise exception 'ADMIN-2: повторный claim откатил state в % (ожидался data_entry)', st;
  end if;

  raise notice 'ADMIN-2: re-claim preserves state OK';
end $$;

rollback;
