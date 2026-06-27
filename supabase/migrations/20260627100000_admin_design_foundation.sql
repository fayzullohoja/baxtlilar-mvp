-- Phase A.1 of admin redesign Sprint 1: prepare users for "avatar = approved selfie" (требование #4).
-- Idempotent: ALTER TABLE ... ADD COLUMN IF NOT EXISTS.

alter table users
  add column if not exists avatar_path text;

comment on column users.avatar_path is
  'Путь к approved селфи из последней успешной верификации. Заполняется в admin_approve_verification RPC. Рендерится везде где упоминается клиент (карточка, photo-таблица, audit, search).';
