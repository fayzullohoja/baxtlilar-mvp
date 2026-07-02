-- AUTH-1 / DBL-1 — отмена/истечение предложенного бана обязаны восстанавливать
-- ИСТИННОЕ pre-ban состояние. paused-юзер (сам поставил паузу, скрыт из фида) не
-- должен воскресать в 'active' (виден в фиде, получает интересы) только потому,
-- что restore реконструируется из quiz_completion (даёт лишь active/onboarding).

begin;

do $$
declare
  uid uuid; adm uuid; upd timestamptz; r jsonb; st lifecycle_state;
begin
  insert into admin_users (login, role, password_hash)
    values ('t_auth1', 'superadmin', 'x') returning id into adm;

  ---------------------------------------------------------------------------
  -- ПУТЬ A — cancel: paused → pending_ban → cancel → снова paused
  ---------------------------------------------------------------------------
  insert into users (telegram_id, lifecycle_state, quiz_completion)
    values (990009100, 'paused', 'completed') returning id, updated_at into uid, upd;

  r := admin_ban_propose(uid, adm, 'test reason', upd);
  if not coalesce((r->>'ok')::boolean, false) then
    raise exception 'setup: propose failed: %', r;
  end if;

  select updated_at into upd from users where id = uid;
  -- guard.ts выводит 'active' из quiz_completion и передаёт как p_restore_state;
  -- RPC обязан предпочесть сохранённое истинное состояние (paused).
  r := admin_ban_cancel(uid, adm, 'active'::lifecycle_state, upd);
  if not coalesce((r->>'ok')::boolean, false) then
    raise exception 'setup: cancel failed: %', r;
  end if;

  select lifecycle_state into st from users where id = uid;
  if st <> 'paused' then
    raise exception 'AUTH-1: paused юзер восстановлен в % (ожидался paused)', st;
  end if;

  ---------------------------------------------------------------------------
  -- ПУТЬ B — expire sweep: paused → pending_ban → истёк → снова paused
  ---------------------------------------------------------------------------
  insert into users (telegram_id, lifecycle_state, quiz_completion)
    values (990009101, 'paused', 'completed') returning id, updated_at into uid, upd;

  r := admin_ban_propose(uid, adm, 'test reason', upd);
  if not coalesce((r->>'ok')::boolean, false) then
    raise exception 'setup: propose(B) failed: %', r;
  end if;

  update users set pending_ban_at = now() - interval '25 hours' where id = uid;
  perform admin_ban_expire_sweep(3600, 100);

  select lifecycle_state into st from users where id = uid;
  if st <> 'paused' then
    raise exception 'DBL-1: expire восстановил paused юзера в % (ожидался paused)', st;
  end if;

  raise notice 'AUTH-1/DBL-1: paused restored correctly on cancel and expire';
end $$;

rollback;
