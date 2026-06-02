-- M5: атомарный инкремент попыток OTP (без lost-update при гонке неверных кодов).
create or replace function bump_otp_attempt(p_id uuid)
returns int
language sql
security invoker
set search_path = public, pg_temp
as $$
  update otp_codes set attempts = attempts + 1 where id = p_id returning attempts;
$$;
