-- 20260620200000_reject_category.sql
-- MAJOR #2: категоризация отказов (technical vs blocking) + условный retry.
--
-- Цель: отделить «плохое фото» (юзер ретраит) от «фейк/катфиш/несовершенно-
-- летний» (retry скрыт, юзер идёт в support). Сейчас все rejected равны —
-- катфиш может бесконечно ретраиться, угадывая фото.
--
-- text + CHECK вместо enum: добавление подкатегорий потом не требует ALTER TYPE.
-- needs_changes категорию не хранит — там семантически всегда technical-flow,
-- /fix-guard это закрывает CHECK constraint'ом.

alter table public.user_documents
  add column if not exists reject_category text null;

alter table public.user_documents
  drop constraint if exists user_documents_reject_category_check;
alter table public.user_documents
  add constraint user_documents_reject_category_check
  check (reject_category is null or reject_category in ('technical','blocking'));

-- Инвариант: категория возможна ТОЛЬКО при status='rejected'. needs_changes
-- по дизайну == technical-без-категории (см. /api/onboarding/fix guard).
alter table public.user_documents
  drop constraint if exists user_documents_category_only_on_reject;
alter table public.user_documents
  add constraint user_documents_category_only_on_reject
  check (
    reject_category is null
    or status = 'rejected'
  );

-- Partial index для фильтров в админке и аналитики.
create index if not exists idx_user_documents_reject_category
  on public.user_documents (reject_category)
  where reject_category is not null;

comment on column public.user_documents.reject_category is
  'technical = можно ретраить (плохое фото, блики); blocking = retry скрыт, юзер идёт в support. NULL = legacy/не отклонено.';

-- MAJOR #2 / R9 verdict: system-side audit (попытка retry после blocking)
-- требует admin_id=null. Допускаем NULL в колонке. Существующие записи не
-- затрагиваются (всегда non-null от админ-route'ов).
alter table public.admin_audit_log alter column admin_id drop not null;
