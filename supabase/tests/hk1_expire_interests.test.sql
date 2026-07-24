-- T-109: gc_expire_interests переводит просроченные pending в expired,
-- не трогая свежие pending и не-pending статусы.
begin;
set local search_path = public;

-- два верифицированных активных юзера-заглушки (минимум для FK match_requests)
insert into users (id, telegram_id, lifecycle_state, onboarding_step, verification_status)
values
  ('00000000-0000-0000-0000-0000000000a1', 900000001, 'active', 'active', 'approved'),
  ('00000000-0000-0000-0000-0000000000a2', 900000002, 'active', 'active', 'approved'),
  ('00000000-0000-0000-0000-0000000000a3', 900000003, 'active', 'active', 'approved'),
  ('00000000-0000-0000-0000-0000000000a4', 900000004, 'active', 'active', 'approved');

-- просроченный pending (должен истечь)
insert into match_requests (sender_id, receiver_id, status, auto_decline_at)
values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2',
        'pending', now() - interval '1 hour');
-- свежий pending (НЕ должен истечь)
insert into match_requests (sender_id, receiver_id, status, auto_decline_at)
values ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a4',
        'pending', now() + interval '10 hour');

select gc_expire_interests();

do $$
declare expired_cnt int; fresh_status text;
begin
  select count(*) into expired_cnt from match_requests
   where sender_id='00000000-0000-0000-0000-0000000000a1' and status='expired';
  if expired_cnt <> 1 then raise exception 'просроченный pending не истёк (got %)', expired_cnt; end if;

  select status into fresh_status from match_requests
   where sender_id='00000000-0000-0000-0000-0000000000a3';
  if fresh_status <> 'pending' then raise exception 'свежий pending зря тронут: %', fresh_status; end if;
end $$;

rollback;
