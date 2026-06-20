-- 20260620600000_blocking_category_trigger.sql
-- F-final-3 (N1 verdict-fix): DB-инвариант на reject_category=blocking.
--
-- Проблема: app-layer guards (route.ts отказывает в retry, admin UI скрывает
-- downgrade-control) — НЕ достаточно. Direct UPDATE через service_role с
-- мисконфигом role или RAW SQL мигом downgrade'нет blocking → technical →
-- юзер показывает retry-кнопку → bypass R2.
--
-- Триггер: BEFORE UPDATE на user_documents. Если old.reject_category='blocking'
-- AND new.reject_category НЕ blocking, allow ТОЛЬКО когда new.status ≠ 'rejected'
-- (status=pending_review при retry/unblock-flow — category null'ится корректно).
--
-- Это закрывает «оставить status=rejected, но снять category» — единственный
-- путь к downgrade'у, который кто-то может сделать невольно.

create or replace function protect_blocking_category() returns trigger
language plpgsql as $$
begin
  if old.reject_category = 'blocking'
     and new.reject_category is distinct from 'blocking'
     and new.status = 'rejected' then
    raise exception 'blocking_reject_immutable: cannot downgrade blocking category while status=rejected'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_blocking_category on user_documents;
create trigger trg_protect_blocking_category
  before update on user_documents
  for each row
  execute function protect_blocking_category();
