-- C-099: user_profiles.schema_version — триггер зеркалит extended._meta в колонку,
-- default 1, hot-only обновления версию не протухают.
begin;
set local search_path = public;

do $$
declare uid uuid := gen_random_uuid(); v int;
begin
  insert into users(id, telegram_id, lifecycle_state, onboarding_step, verification_status)
  values (uid, 987000001, 'onboarding', 'profile_basic', 'not_started');

  -- insert с _meta.schema_version=1 → колонка 1
  insert into user_profiles(user_id, extended)
  values (uid, '{"_meta":{"schema_version":1},"family":{}}'::jsonb);
  select schema_version into v from user_profiles where user_id = uid;
  assert v = 1, 'insert с _meta=1 → колонка 1, got ' || v;

  -- update extended с _meta.schema_version=2 → колонка 2 (триггер читает jsonb)
  update user_profiles set extended = '{"_meta":{"schema_version":2},"family":{}}'::jsonb
   where user_id = uid;
  select schema_version into v from user_profiles where user_id = uid;
  assert v = 2, 'update _meta=2 → колонка 2, got ' || v;

  -- hot-only: extended без _meta → колонка НЕ протухает (сохраняет 2)
  update user_profiles set extended = '{"family":{"x":1}}'::jsonb where user_id = uid;
  select schema_version into v from user_profiles where user_id = uid;
  assert v = 2, 'extended без _meta сохраняет прежнюю версию, got ' || v;
end$$;

-- default 1 при вставке без _meta
do $$
declare uid uuid := gen_random_uuid(); v int;
begin
  insert into users(id, telegram_id, lifecycle_state, onboarding_step, verification_status)
  values (uid, 987000002, 'onboarding', 'profile_basic', 'not_started');
  insert into user_profiles(user_id, extended) values (uid, '{"family":{}}'::jsonb);
  select schema_version into v from user_profiles where user_id = uid;
  assert v = 1, 'insert без _meta → default 1, got ' || v;
end$$;

rollback;
do $$ begin raise notice '✓ sv1 schema_version trigger OK'; end $$;
