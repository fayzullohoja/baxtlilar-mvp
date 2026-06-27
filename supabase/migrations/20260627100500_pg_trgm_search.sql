-- Phase A.5: pg_trgm extension + trgm indexes для /admin/clients search в Sprint 2.
-- Sprint 1 не использует, но extension и индексы нужны сразу — Sprint 2 будет чистым.

create extension if not exists pg_trgm;

create index if not exists user_identity_last_name_trgm_idx
  on user_identity using gin (last_name gin_trgm_ops) where superseded_at is null;

create index if not exists user_identity_first_name_trgm_idx
  on user_identity using gin (first_name gin_trgm_ops) where superseded_at is null;

create index if not exists user_identity_pinfl_idx
  on user_identity(pinfl) where superseded_at is null;

create index if not exists user_identity_passport_idx
  on user_identity((passport_series || passport_number)) where superseded_at is null;
