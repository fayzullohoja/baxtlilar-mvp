-- Baxtlilar MVP — schema_v1
-- Источник истины: ~/Desktop/Baxtlilar/ Чат 12 §6, Чат 13 §1
-- Принцип: RLS off, доступ к таблицам только через service_role с сервера.

-- ============= ENUM types =============
create type lifecycle_state as enum ('onboarding','active','paused','blocked','deleted');
create type onboarding_step as enum (
  'language','consent','phone_input','otp_pending','doc_upload','selfie_upload',
  'moderation_pending','needs_changes','verification_rejected',
  'profile_basic','profile_photos','profile_preview','quiz','active'
);
create type verification_status as enum (
  'not_started','phone_verified','documents_uploaded','liveness_uploaded',
  'pending_review','needs_changes','approved','rejected','revoked'
);
create type profile_completion as enum ('not_started','in_progress','completed','pending_remoderation');
create type quiz_completion as enum ('not_started','in_progress','completed');
create type doc_status as enum ('pending_review','needs_changes','approved','rejected');
create type photo_status as enum ('uploaded','under_review','approved','needs_replacement','rejected','hidden_by_user');
create type profile_status as enum ('draft','under_review','needs_changes','approved','published','rejected','hidden');
create type complaint_status as enum ('new','in_progress','confirmed','not_confirmed','action_taken','closed','requires_clarification','escalated');
create type match_request_status as enum ('pending','accepted','declined','withdrawn','expired');
create type sanction_level as enum ('none','warning','interest_limited','chat_limited','hidden_from_recommendations','re_verification','temp_block','perm_block');
create type triggered_by_kind as enum ('user','system','admin');

-- ============= users =============
create table users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  telegram_username text,
  telegram_first_name text,
  telegram_last_name text,
  phone_number text,
  phone_verified boolean not null default false,
  phone_verified_at timestamptz,
  language text check (language in ('ru','uz')),
  lifecycle_state lifecycle_state not null default 'onboarding',
  onboarding_step onboarding_step not null default 'language',
  verification_status verification_status not null default 'not_started',
  profile_completion profile_completion not null default 'not_started',
  quiz_completion quiz_completion not null default 'not_started',
  sanction_level sanction_level not null default 'none',
  paused_at timestamptz,
  blocked_at timestamptz,
  blocked_reason text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index users_phone_unique on users(phone_number)
  where phone_verified = true and deleted_at is null;

-- ============= consents =============
create table consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  consent_type text not null,           -- terms · privacy · pd · documents
  consent_version text not null,
  accepted_at timestamptz not null default now()
);
create index consents_user_idx on consents(user_id);

-- ============= user_documents =============
create table user_documents (
  user_id uuid primary key references users(id) on delete cascade,
  passport_path text,
  selfie_path text,
  status doc_status,
  reject_reason text,
  reject_target text,                   -- 'passport' | 'selfie' | 'both'
  moderated_by text,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============= user_profiles =============
create table user_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  display_name text,
  gender text check (gender in ('m','f')),
  birth_date date,
  city text,
  bio text,
  marital_status text,
  has_children text,
  children_plan text,
  religion text,
  religion_importance int check (religion_importance between 1 and 5),
  values text[] not null default '{}',
  education text,
  employment text,
  looking_for_gender text check (looking_for_gender in ('m','f')),
  partner_age_min int check (partner_age_min >= 18),
  partner_age_max int check (partner_age_max >= 18),
  geo_preference text,
  languages text[] not null default '{}',
  status profile_status not null default 'draft',
  reject_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============= profile_photos =============
create table profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  path text not null,
  is_main boolean not null default false,
  status photo_status not null default 'under_review',
  reject_reason text,
  ord int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profile_photos_user_idx on profile_photos(user_id);
create unique index profile_photos_one_main on profile_photos(user_id) where is_main = true;

-- ============= otp_codes =============
create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index otp_codes_user_idx on otp_codes(user_id, created_at desc);

-- ============= quiz =============
create table quiz_answers (
  user_id uuid not null references users(id) on delete cascade,
  question_id text not null,
  answer_value text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
create table quiz_results (
  user_id uuid primary key references users(id) on delete cascade,
  vector jsonb,
  completed_at timestamptz not null default now()
);

-- ============= match_requests =============
create table match_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references users(id) on delete cascade,
  receiver_id uuid not null references users(id) on delete cascade,
  message text,
  status match_request_status not null default 'pending',
  auto_decline_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
create unique index match_requests_active_pair on match_requests(sender_id, receiver_id) where status = 'pending';
create index match_requests_receiver_idx on match_requests(receiver_id, status, created_at desc);
create index match_requests_sender_idx on match_requests(sender_id, status, created_at desc);

-- ============= match_views (дедуп ленты) =============
create table match_views (
  viewer_id uuid not null references users(id) on delete cascade,
  target_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (viewer_id, target_id)
);

-- ============= chats =============
create table chats (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references users(id) on delete cascade,
  user_b uuid not null references users(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  check (user_a < user_b)
);
create unique index chats_pair on chats(user_a, user_b);
create index chats_user_a_idx on chats(user_a, last_message_at desc nulls last);
create index chats_user_b_idx on chats(user_b, last_message_at desc nulls last);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index chat_messages_chat_idx on chat_messages(chat_id, created_at);

-- ============= daily_request_quotas =============
create table daily_request_quotas (
  user_id uuid not null references users(id) on delete cascade,
  on_date date not null,
  interests_sent int not null default 0,
  views_count int not null default 0,
  primary key (user_id, on_date)
);

-- ============= user_state_transitions (audit) =============
create table user_state_transitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  field text not null,
  from_value text,
  to_value text,
  reason text not null,
  triggered_by_kind triggered_by_kind not null,
  triggered_by_id text,
  created_at timestamptz not null default now()
);
create index user_state_transitions_user_idx on user_state_transitions(user_id, created_at desc);

-- ============= admin =============
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  login text not null unique,
  role text not null check (role in ('superadmin','moderator')),
  password_hash text not null,
  created_at timestamptz not null default now()
);
create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admin_users(id) on delete restrict,
  action text not null,
  entity text not null,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  ip text,
  created_at timestamptz not null default now()
);
create index admin_audit_log_admin_idx on admin_audit_log(admin_id, created_at desc);
create index admin_audit_log_entity_idx on admin_audit_log(entity, entity_id);

-- ============= safety =============
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id) on delete cascade,
  target_user_id uuid not null references users(id) on delete cascade,
  chat_id uuid references chats(id) on delete set null,
  reason_code text not null,
  comment text,
  status complaint_status not null default 'new',
  created_at timestamptz not null default now(),
  check (reporter_id <> target_user_id)
);
create index reports_target_idx on reports(target_user_id, status, created_at desc);

create table blocks (
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on blocks(blocked_id);

-- ============= updated_at триггер =============
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger users_updated_at before update on users for each row execute function set_updated_at();
create trigger user_documents_updated_at before update on user_documents for each row execute function set_updated_at();
create trigger user_profiles_updated_at before update on user_profiles for each row execute function set_updated_at();
create trigger profile_photos_updated_at before update on profile_photos for each row execute function set_updated_at();
create trigger match_requests_updated_at before update on match_requests for each row execute function set_updated_at();
