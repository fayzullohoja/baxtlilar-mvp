-- 2026-07-24 (T-109): проактивное истечение просроченных pending-интересов.
-- Раньше истечение было только ленивым (при касании пары в process_interest /
-- accept-decline / рендере /requests). Теперь housekeeping-крон раз в час
-- переводит pending с auto_decline_at <= now() в 'expired' — освобождая слот
-- отправителя и делая статус в БД правдой (для воронки/метрик).
create or replace function gc_expire_interests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update match_requests
     set status = 'expired'
   where status = 'pending'
     and auto_decline_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function gc_expire_interests() is
  'Housekeeping (T-109): pending-интересы старше 72ч → expired. Возвращает число обновлённых.';
