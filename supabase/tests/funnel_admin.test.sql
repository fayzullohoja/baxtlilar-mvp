-- FUNNEL-1..4 — get_admin_funnel(): воронка signup→verified→published→
-- first_mutual→chat_unlocked (gender-segmented), empty_feed_rate (STRICT tier 0),
-- rates (onboarding-completion, verification-approval) и North Star
-- (verified mutual interests with chat started, минус пары с blocks/reports).

begin;

do $$
declare
  u1 uuid; u2 uuid; u3 uuid; u4 uuid; u5 uuid; u6 uuid; u7 uuid; u8 uuid; u9 uuid; u10 uuid;
  ch12 uuid; ch45 uuid; ch910 uuid;
  j jsonb;
begin
  -- ===== фикстуры =====
  -- u1 м 30 + u2 ж 28: чистая north-star пара (accepted + чат + сообщение)
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009501, 'approved', 'active') returning id into u1;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status, city)
    values (u1, 'm', 'f', (current_date - interval '30 years' - interval '100 days')::date, 25, 35, 'published', 'tashkent');
  insert into profile_photos (user_id, path, status, is_main) values (u1, 'p/u1.jpg', 'approved', true);

  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009502, 'approved', 'active') returning id into u2;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status, city)
    values (u2, 'f', 'm', (current_date - interval '28 years' - interval '100 days')::date, 25, 35, 'published', 'tashkent');
  insert into profile_photos (user_id, path, status, is_main) values (u2, 'p/u2.jpg', 'approved', true);

  -- u3 ж 27: просто eligible (кормит фиды u1/u4/u9)
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009503, 'approved', 'active') returning id into u3;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status, city)
    values (u3, 'f', 'm', (current_date - interval '27 years' - interval '100 days')::date, 25, 35, 'published', 'tashkent');
  insert into profile_photos (user_id, path, status, is_main) values (u3, 'p/u3.jpg', 'approved', true);

  -- u4 м 30 + u5 ж 28: accepted + чат + сообщение, но БЛОК → north star их не считает
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009504, 'approved', 'active') returning id into u4;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status, city)
    values (u4, 'm', 'f', (current_date - interval '30 years' - interval '100 days')::date, 25, 35, 'published', 'tashkent');
  insert into profile_photos (user_id, path, status, is_main) values (u4, 'p/u4.jpg', 'approved', true);

  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009505, 'approved', 'active') returning id into u5;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status, city)
    values (u5, 'f', 'm', (current_date - interval '28 years' - interval '100 days')::date, 25, 35, 'published', 'tashkent');
  insert into profile_photos (user_id, path, status, is_main) values (u5, 'p/u5.jpg', 'approved', true);

  -- u6: ещё в онбординге, без анкеты — только в signup
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009506, 'not_started', 'onboarding') returning id into u6;

  -- u7 ж 24, prefs 45-50 → strict-фид ПУСТ (empty_feed), другой город
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009507, 'approved', 'active') returning id into u7;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status, city)
    values (u7, 'f', 'm', (current_date - interval '24 years' - interval '100 days')::date, 45, 50, 'published', 'samarkand');
  insert into profile_photos (user_id, path, status, is_main) values (u7, 'p/u7.jpg', 'approved', true);

  -- u8 ж: подала (pending_review), анкета draft → submitted, не approved, не published
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009508, 'pending_review', 'active') returning id into u8;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status, city)
    values (u8, 'f', 'm', (current_date - interval '26 years' - interval '100 days')::date, 25, 35, 'draft', 'tashkent');

  -- u9 м 30 + u10 ж 28: accepted + чат + сообщение, но REPORT → north star их не считает
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009509, 'approved', 'active') returning id into u9;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status, city)
    values (u9, 'm', 'f', (current_date - interval '30 years' - interval '100 days')::date, 25, 35, 'published', 'tashkent');
  insert into profile_photos (user_id, path, status, is_main) values (u9, 'p/u9.jpg', 'approved', true);

  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009510, 'approved', 'active') returning id into u10;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status, city)
    values (u10, 'f', 'm', (current_date - interval '28 years' - interval '100 days')::date, 25, 35, 'published', 'tashkent');
  insert into profile_photos (user_id, path, status, is_main) values (u10, 'p/u10.jpg', 'approved', true);

  -- связи
  insert into match_requests (sender_id, receiver_id, status, auto_decline_at)
    values (u1, u2, 'accepted', now() + interval '72 hours');
  insert into chats (user_a, user_b) values (least(u1, u2), greatest(u1, u2)) returning id into ch12;
  insert into chat_messages (chat_id, sender_id, body) values (ch12, u1, 'Ассалому алайкум!');

  insert into match_requests (sender_id, receiver_id, status, auto_decline_at)
    values (u4, u5, 'accepted', now() + interval '72 hours');
  insert into chats (user_a, user_b) values (least(u4, u5), greatest(u4, u5)) returning id into ch45;
  insert into chat_messages (chat_id, sender_id, body) values (ch45, u4, 'Салом');
  insert into blocks (blocker_id, blocked_id) values (u5, u4);

  insert into match_requests (sender_id, receiver_id, status, auto_decline_at)
    values (u9, u10, 'accepted', now() + interval '72 hours');
  insert into chats (user_a, user_b) values (least(u9, u10), greatest(u9, u10)) returning id into ch910;
  insert into chat_messages (chat_id, sender_id, body) values (ch910, u9, 'Салом!');
  insert into reports (reporter_id, target_user_id, reason_code) values (u10, u9, 'spam');

  -- ===== вызов =====
  select get_admin_funnel() into j;

  -- ===== воронка =====
  if (j->'funnel'->'signup'->>'n')::int <> 10 then raise exception 'signup n: ожидалось 10, %', j->'funnel'->'signup'; end if;
  if (j->'funnel'->'signup'->>'m')::int <> 3 or (j->'funnel'->'signup'->>'f')::int <> 6 then
    raise exception 'signup m/f: ожидалось 3/6, %', j->'funnel'->'signup'; end if;
  if (j->'funnel'->'verified'->>'n')::int <> 8 then raise exception 'verified: ожидалось 8, %', j->'funnel'->'verified'; end if;
  if (j->'funnel'->'published'->>'n')::int <> 8 then raise exception 'published: ожидалось 8, %', j->'funnel'->'published'; end if;
  if (j->'funnel'->'first_mutual'->>'n')::int <> 6 then raise exception 'first_mutual: ожидалось 6, %', j->'funnel'->'first_mutual'; end if;
  if (j->'funnel'->'chat_unlocked'->>'n')::int <> 6 then raise exception 'chat_unlocked: ожидалось 6, %', j->'funnel'->'chat_unlocked'; end if;

  -- ===== empty feed (STRICT tier 0) =====
  if (j->'empty_feed'->>'eligible')::int <> 8 then raise exception 'empty_feed eligible: ожидалось 8, %', j->'empty_feed'; end if;
  if (j->'empty_feed'->>'empty')::int <> 1 then raise exception 'empty_feed empty: ожидалось 1 (u7), %', j->'empty_feed'; end if;
  if (j->'empty_feed'->'by_gender'->'f'->>'empty')::int <> 1 then raise exception 'empty_feed f: ожидалось 1, %', j->'empty_feed'->'by_gender'; end if;
  if (j->'empty_feed'->'by_gender'->'m'->>'empty')::int <> 0 then raise exception 'empty_feed m: ожидалось 0, %', j->'empty_feed'->'by_gender'; end if;
  perform 1 from jsonb_array_elements(j->'empty_feed'->'by_city') e
    where e->>'city' = 'samarkand' and (e->>'empty')::int = 1 and (e->>'eligible')::int = 1;
  if not found then raise exception 'empty_feed by_city: ожидался samarkand 1/1, %', j->'empty_feed'->'by_city'; end if;

  -- ===== rates =====
  if (j->'rates'->'onboarding'->>'total')::int <> 10 or (j->'rates'->'onboarding'->>'past_onboarding')::int <> 9 then
    raise exception 'onboarding rate: ожидалось 9/10, %', j->'rates'; end if;
  if (j->'rates'->'verification'->>'submitted')::int <> 9 or (j->'rates'->'verification'->>'approved')::int <> 8 then
    raise exception 'verification rate: ожидалось 8/9, %', j->'rates'; end if;

  -- ===== North Star: только чистая пара u1-u2 =====
  if (j->>'north_star')::int <> 1 then
    raise exception 'north_star: ожидалась 1 (u1-u2; u4-u5 block, u9-u10 report), получено %', j->>'north_star'; end if;

  raise notice 'FUNNEL get_admin_funnel OK';
end $$;

rollback;
