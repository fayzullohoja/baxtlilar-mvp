-- OBS-4 — get_ops_metrics отражает глубину outbox (unsent), возраст старейшего,
-- dead-letter (attempts>=5 unsent) и глубину очереди верификации (state<>'closed').

begin;

do $$
declare u uuid; j jsonb; c uuid;
begin
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009950, 'approved', 'active') returning id into u;

  -- 3 unsent (один dead-letter attempts=5), 1 sent
  insert into tg_outbox (user_id, event_type, attempts, sent_at, created_at)
    values (u, 'verification_approved', 0, null, now() - interval '120 seconds');
  insert into tg_outbox (user_id, event_type, attempts, sent_at)
    values (u, 'verification_approved', 5, null);
  insert into tg_outbox (user_id, event_type, attempts, sent_at)
    values (u, 'tutorial_reminder', 1, null);
  insert into tg_outbox (user_id, event_type, attempts, sent_at)
    values (u, 'verification_rejected', 0, now());

  -- одна открытая verification_case (state <> closed)
  insert into verification_cases (user_id, state) values (u, 'new');
  insert into verification_cases (user_id, state) values (u, 'closed');

  select get_ops_metrics() into j;

  if (j->'outbox'->>'depth')::int <> 3 then
    raise exception 'outbox depth: ожидалось 3, %', j->'outbox'->>'depth'; end if;
  if (j->'outbox'->>'dead_letter')::int <> 1 then
    raise exception 'dead_letter: ожидалось 1, %', j->'outbox'->>'dead_letter'; end if;
  if (j->'outbox'->>'oldest_age_seconds')::int < 100 then
    raise exception 'oldest_age_seconds: ожидалось >=100, %', j->'outbox'->>'oldest_age_seconds'; end if;
  if (j->>'verification_queue_depth')::int <> 1 then
    raise exception 'verification_queue_depth: ожидалось 1, %', j->>'verification_queue_depth'; end if;

  raise notice 'OBS-4 get_ops_metrics OK';
end $$;

rollback;
