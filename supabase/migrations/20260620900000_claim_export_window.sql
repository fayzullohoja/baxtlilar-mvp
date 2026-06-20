-- H11 verdict-fix (part 2): атомарный rate-limit для /api/account/export.
-- Реализован через UPDATE ... WHERE ... RETURNING внутри SQL-функции
-- (custom query-builder не поддерживает .or() на JS-уровне).
--
-- N параллельных вызовов: ровно 1 пройдёт UPDATE (cooldown >= cooldown_seconds),
-- остальные получают boolean=false → route отдаёт 429.

create or replace function claim_export_window(
  p_user_id uuid,
  p_cooldown_seconds integer
) returns boolean
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_cutoff timestamptz := v_now - make_interval(secs => p_cooldown_seconds);
  v_id uuid;
begin
  update users
     set exported_at = v_now
   where id = p_user_id
     and (exported_at is null or exported_at < v_cutoff)
   returning id into v_id;
  return v_id is not null;
end;
$$;

revoke all on function claim_export_window(uuid, integer) from public;
