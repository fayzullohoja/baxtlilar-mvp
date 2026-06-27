-- Phase A.3: structured identity record. Replaces "passport is a jpg blob" with
-- typed fields. Created atomically by admin_approve_verification RPC (Task 8).
--
-- Provenance built-in: entered_by/entered_at/source_case_id tag every row.
-- Field-level edits later create a new row with superseded_at set on the old
-- (history kept, never deleted).

create table if not exists user_identity (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,

  -- ФИО
  last_name           text not null,
  first_name          text not null,
  middle_name         text,

  -- Person
  birth_date          date not null,
  gender              text not null check (gender in ('M','F')),
  citizenship         text not null default 'UZ',
  birth_place         text not null,

  -- Document
  passport_series     text not null check (passport_series ~ '^[A-Z]{2}$'),
  passport_number     text not null check (passport_number ~ '^[0-9]{7}$'),
  pinfl               text not null check (pinfl ~ '^[0-9]{14}$'),
  issued_by           text not null,
  issued_at           date not null,
  expires_at          date not null,

  -- Address
  region_code         text not null,
  district_code       text not null,
  locality            text not null,
  street_address      text not null,

  -- Provenance
  entered_by          uuid not null references admin_users(id),
  entered_at          timestamptz not null default now(),
  source_case_id      uuid references verification_cases(id),
  superseded_at       timestamptz,

  created_at          timestamptz not null default now()
);

-- Uniqueness — только активные (superseded_at IS NULL)
create unique index if not exists user_identity_pinfl_active_uniq
  on user_identity(pinfl) where superseded_at is null;

create unique index if not exists user_identity_passport_active_uniq
  on user_identity(passport_series, passport_number) where superseded_at is null;

create index if not exists user_identity_user_idx on user_identity(user_id) where superseded_at is null;

-- Validation trigger: age >= 18, expires_at > issued_at
create or replace function validate_user_identity()
returns trigger language plpgsql as $$
declare
  age_years integer;
begin
  age_years := extract(year from age(now(), new.birth_date))::int;
  if age_years < 18 then
    raise exception 'user_identity: age must be >= 18 (got %)', age_years;
  end if;
  if new.expires_at <= new.issued_at then
    raise exception 'user_identity: expires_at must be after issued_at';
  end if;
  return new;
end$$;

drop trigger if exists user_identity_validate on user_identity;
create trigger user_identity_validate
  before insert or update on user_identity
  for each row execute function validate_user_identity();
