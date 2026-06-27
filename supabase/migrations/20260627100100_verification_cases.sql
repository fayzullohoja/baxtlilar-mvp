-- Phase A.2: case-management primitives. verification_cases supersedes the implicit
-- "open verification" derived from users.verification_status. Old code paths keep
-- working (legacy verification_status enum unchanged); new admin UI works through
-- verification_cases only.
--
-- Backfill: existing pending_review users get a 'new' case to start the queue.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'verification_case_state') then
    create type verification_case_state as enum (
      'new',
      'assigned',
      'in_review',
      'data_entry',
      'ready_to_decide',
      'closed'
    );
  end if;
end$$;

create table if not exists verification_cases (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  state         verification_case_state not null default 'new',
  assignee_id   uuid references admin_users(id),
  draft_payload jsonb not null default '{}'::jsonb,
  outcome       text check (outcome in ('approved','needs_changes','rejected_technical','rejected_blocking')),
  decided_by    uuid references admin_users(id),
  decided_at    timestamptz,
  claimed_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists verification_cases_state_idx on verification_cases(state);
create index if not exists verification_cases_assignee_idx on verification_cases(assignee_id) where assignee_id is not null;
create index if not exists verification_cases_user_idx on verification_cases(user_id);

-- Immutable timeline
create table if not exists case_events (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references verification_cases(id) on delete cascade,
  actor_id    uuid references admin_users(id),
  action      text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists case_events_case_idx on case_events(case_id, created_at);

create or replace function prevent_case_events_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'case_events is append-only';
end$$;

drop trigger if exists case_events_no_update on case_events;
create trigger case_events_no_update before update or delete on case_events
  for each row execute function prevent_case_events_mutation();

-- Internal notes from moderators
create table if not exists case_notes (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references verification_cases(id) on delete cascade,
  author_id   uuid not null references admin_users(id),
  body        text not null check (length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists case_notes_case_idx on case_notes(case_id, created_at);

-- updated_at auto-bump (for optimistic concurrency)
create or replace function bump_verification_cases_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists verification_cases_bump_updated_at on verification_cases;
create trigger verification_cases_bump_updated_at
  before update on verification_cases
  for each row execute function bump_verification_cases_updated_at();

-- Backfill: один открытый case на каждого pending_review юзера (idempotent)
insert into verification_cases (user_id, state, created_at)
select id, 'new', coalesce(verification_submitted_at, now())
from users
where verification_status = 'pending_review'
  and not exists (
    select 1 from verification_cases vc
    where vc.user_id = users.id and vc.state <> 'closed'
  );
