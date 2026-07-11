-- Волна 4 — admin_search_clients v2 (фильтры+offset+deleted, компонуются с
-- поиском), admin_release_case (owner/super gate, draft сохраняется, событие),
-- get_queue_health. Ключевая регрессия: фильтр должен применяться ПРИ непустом q
-- (раньше терялся) + deleted исключён по умолчанию + offset режет страницы.

begin;

do $$
declare
  adm uuid; mod2 uuid; ud uuid;
  cid1 uuid; cid2 uuid;
  p1 jsonb; p2 jsonb; res jsonb; h jsonb;
  i int;
begin
  insert into admin_users (login, role, password_hash)
    values ('t_w4_super', 'superadmin', 'x') returning id into adm;
  insert into admin_users (login, role, password_hash)
    values ('t_w4_mod', 'moderator', 'x') returning id into mod2;

  -- 6 активных: gender m/f чередованием, display_name 'Zearch i', created_at distinct.
  for i in 1..6 loop
    insert into users (telegram_id, verification_status, lifecycle_state, created_at)
      values (990040000 + i, 'approved', 'active', now() - (i || ' minutes')::interval)
      returning id into ud;
    insert into user_profiles (user_id, display_name, gender, looking_for_gender, birth_date, status)
      values (ud, 'Zearch ' || i, case when i % 2 = 0 then 'm' else 'f' end,
              case when i % 2 = 0 then 'f' else 'm' end, '1995-01-01', 'published');
  end loop;

  -- 1 soft-deleted (не должен появляться по умолчанию)
  insert into users (telegram_id, verification_status, lifecycle_state, deleted_at)
    values (990040099, 'approved', 'deleted', now()) returning id into ud;
  insert into user_profiles (user_id, display_name, gender, looking_for_gender, birth_date, status)
    values (ud, 'Zearch del', 'm', 'f', '1995-01-01', 'published');

  -- A) default empty: deleted исключён → 6
  if jsonb_array_length(admin_search_clients('')) <> 6 then
    raise exception 'default empty: ожидалось 6, got %', jsonb_array_length(admin_search_clients('')); end if;

  -- B) status=deleted (псевдо) → только удалённый = 1
  if jsonb_array_length(admin_search_clients('', 50, 0, 'deleted')) <> 1 then
    raise exception 'deleted-only: ожидалось 1'; end if;

  -- C) include_deleted → все 7
  if jsonb_array_length(admin_search_clients('', 50, 0, null, null, null, true)) <> 7 then
    raise exception 'include_deleted: ожидалось 7'; end if;

  -- D) name 'Zearch' по display_name, deleted исключён → 6
  if jsonb_array_length(admin_search_clients('Zearch')) <> 6 then
    raise exception 'name search: ожидалось 6, got %', jsonb_array_length(admin_search_clients('Zearch')); end if;

  -- E) РЕГРЕССИЯ: фильтр gender применяется ПРИ непустом q (раньше молча терялся)
  if jsonb_array_length(admin_search_clients('Zearch', 50, 0, null, 'm')) <> 3 then
    raise exception 'name+gender=m: ожидалось 3 (фильтр при поиске сломан), got %',
      jsonb_array_length(admin_search_clients('Zearch', 50, 0, null, 'm')); end if;
  if jsonb_array_length(admin_search_clients('Zearch', 50, 0, null, 'f')) <> 3 then
    raise exception 'name+gender=f: ожидалось 3'; end if;

  -- F) offset режет страницы: page1 ∩ page2 = ∅, каждая по 3
  p1 := admin_search_clients('', 3, 0);
  p2 := admin_search_clients('', 3, 3);
  if jsonb_array_length(p1) <> 3 or jsonb_array_length(p2) <> 3 then
    raise exception 'offset: страницы не по 3'; end if;
  if p1 @> (p2->0) then
    raise exception 'offset: page2[0] найден на page1 (пересечение страниц)'; end if;

  -- ── release ──
  insert into verification_cases (user_id, state, assignee_id, claimed_at, draft_payload)
    select id, 'data_entry', adm, now(), '{"passport_number":"123"}'::jsonb
    from users where telegram_id = 990040001 returning id into cid1;
  insert into verification_cases (user_id, state, assignee_id, claimed_at, draft_payload)
    select id, 'assigned', adm, now(), '{}'::jsonb
    from users where telegram_id = 990040002 returning id into cid2;

  -- owner освобождает cid1 → пул, но draft сохранён
  res := admin_release_case(cid1, adm);
  if (res->>'ok')::boolean is not true then raise exception 'release owner: не ok'; end if;
  if (select assignee_id from verification_cases where id = cid1) is not null then
    raise exception 'release: assignee не сброшен'; end if;
  if (select state::text from verification_cases where id = cid1) <> 'new' then
    raise exception 'release: state не new'; end if;
  if (select draft_payload->>'passport_number' from verification_cases where id = cid1) <> '123' then
    raise exception 'release: draft_payload НЕ сохранён (работа потеряна)'; end if;
  if not exists (select 1 from case_events where case_id = cid1 and action = 'released') then
    raise exception 'release: событие released не записано'; end if;

  -- moderator (не владелец, не super) НЕ освобождает чужой cid2 → not_owner
  res := admin_release_case(cid2, mod2);
  if (res->>'ok')::boolean is true then
    raise exception 'release: чужой moderator не должен освобождать'; end if;
  if res->>'error' <> 'not_owner' then
    raise exception 'release: ожидался not_owner, got %', res->>'error'; end if;

  -- superadmin МОЖЕТ освободить чужой кейс (mod2 владелец, adm=super ≠ владелец)
  update verification_cases set assignee_id = mod2 where id = cid2;
  res := admin_release_case(cid2, adm);
  if (res->>'ok')::boolean is not true then
    raise exception 'release: superadmin должен освобождать чужой кейс'; end if;

  -- ── queue-health ──
  h := get_queue_health();
  if (h->>'open_total')::int < 1 then
    raise exception 'queue_health: open_total >= 1 ожидался, got %', h->>'open_total'; end if;
  if h->'oldest_open_hours' is null then
    raise exception 'queue_health: нет oldest_open_hours'; end if;

  raise notice '✓ wave4 search+queue asserts passed';
end$$;

rollback;
