-- DZ-2/3 — admin_restart_onboarding (wipe consents + reset, guard blocked) и
-- admin_hard_delete_user (полное удаление, обход append-only case_events).

begin;

do $$
declare adm uuid; u1 uuid; u2 uuid; u3 uuid; cid uuid; cid3 uuid; blocked jsonb;
begin
  insert into admin_users (login, role, password_hash)
    values ('t_dz', 'superadmin', 'x') returning id into adm;

  -- ── restart ──
  insert into users (telegram_id, verification_status, lifecycle_state,
                     quiz_completion, profile_completion, onboarding_step)
    values (990010200, 'approved', 'active', 'completed', 'completed', 'active')
    returning id into u1;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, status)
    values (u1, 'm', 'f', '1995-01-01', 'published');
  perform record_consent(u1, 990010200::bigint, array['pd'], 'v1', 'ru', 'sha',
                         'tg_bot', array['general_pd']);

  perform admin_restart_onboarding(u1, adm, 'test restart');
  if exists (select 1 from user_profiles where user_id = u1) then
    raise exception 'restart: профиль не стёрт'; end if;
  if exists (select 1 from consents where user_id = u1) then
    raise exception 'restart: СОГЛАСИЯ не стёрты'; end if;
  if (select lifecycle_state::text from users where id = u1) <> 'onboarding' then
    raise exception 'restart: lifecycle не onboarding'; end if;
  if (select onboarding_step::text from users where id = u1) <> 'bot_language' then
    raise exception 'restart: step не bot_language'; end if;
  if (select verification_status::text from users where id = u1) <> 'not_started' then
    raise exception 'restart: verification не not_started'; end if;
  if not exists (select 1 from users where id = u1) then
    raise exception 'restart: юзер удалён (должен остаться)'; end if;

  -- guard: blocked не рестартим (не отмываем бан)
  update users set lifecycle_state = 'blocked' where id = u1;
  blocked := admin_restart_onboarding(u1, adm, 'x');
  if (blocked->>'ok')::boolean is true then
    raise exception 'restart: blocked должен быть отклонён'; end if;

  -- ── hard-delete (с case_events — проверяем обход append-only триггера) ──
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990010201, 'pending_review', 'onboarding') returning id into u2;
  select id into cid from verification_cases where user_id = u2 and state <> 'closed';
  if cid is null then raise exception 'триггер VF-1 не создал кейс'; end if;
  insert into case_events (case_id, actor_id, action, payload) values (cid, adm, 'test', '{}');

  perform admin_hard_delete_user(u2, adm, 'spam account');
  if exists (select 1 from users where id = u2) then
    raise exception 'hard-delete: юзер не удалён'; end if;
  if exists (select 1 from verification_cases where id = cid) then
    raise exception 'hard-delete: кейс не удалён'; end if;
  if exists (select 1 from case_events where case_id = cid) then
    raise exception 'hard-delete: case_events не удалены (триггер не обойдён)'; end if;

  -- триггер восстановлен после hard-delete? прямое удаление event должно падать
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990010202, 'pending_review', 'onboarding') returning id into u3;
  select id into cid3 from verification_cases where user_id = u3 and state <> 'closed';
  insert into case_events (case_id, actor_id, action, payload) values (cid3, adm, 'test', '{}');
  begin
    delete from case_events where case_id = cid3;
    raise exception 'триггер append-only НЕ восстановлен после hard-delete';
  exception when others then
    if sqlerrm not like '%append-only%' then raise; end if;
  end;

  raise notice 'DZ-2/3 restart + hard-delete OK';
end $$;

rollback;
