-- Волна 7 Фаза 2 — управление персоналом (Staff). Super создаёт/деактивирует/
-- меняет роль аккаунтов админов. Инварианты защищены НА УРОВНЕ RPC (race-safe,
-- под row-lock), т.к. это единственная защита (RLS выключен):
--   1) всегда есть ≥1 АКТИВНЫЙ superadmin (нельзя деактивировать/разжаловать
--      последнего) — иначе система остаётся без владельца;
--   2) нельзя деактивировать/разжаловать САМ СЕБЯ (защита от случайного
--      self-lockout).
-- Пароль хешируется в Node (scrypt, lib/admin/password.ts) и передаётся готовым.

alter table admin_users
  add column if not exists active boolean not null default true,
  add column if not exists deactivated_at timestamptz,
  add column if not exists created_by uuid references admin_users(id);

create index if not exists admin_users_active_idx on admin_users(active) where active = true;

-- ── создать аккаунт ─────────────────────────────────────────────────────────
create or replace function admin_create_staff(
  p_actor uuid,
  p_login text,
  p_password_hash text,
  p_role text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_login text := lower(trim(p_login)); v_id uuid;
begin
  if v_login is null or length(v_login) < 3 then
    return jsonb_build_object('ok', false, 'error', 'bad_login');
  end if;
  if p_role not in ('superadmin', 'moderator') then
    return jsonb_build_object('ok', false, 'error', 'bad_role');
  end if;
  if p_password_hash is null or p_password_hash = '' then
    return jsonb_build_object('ok', false, 'error', 'bad_password');
  end if;

  begin
    insert into admin_users(login, role, password_hash, created_by, active)
    values (v_login, p_role, p_password_hash, p_actor, true)
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'login_taken');
  end;

  insert into admin_audit_log(admin_id, action, entity, entity_id, new_value)
  values (p_actor, 'staff_create', 'admin_user', v_id::text,
          jsonb_build_object('login', v_login, 'role', p_role));

  return jsonb_build_object('ok', true, 'id', v_id);
end$$;

-- ── деактивировать / реактивировать ─────────────────────────────────────────
create or replace function admin_set_staff_active(
  p_actor uuid,
  p_target uuid,
  p_active boolean
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_role text; v_was_active boolean; v_other_supers int;
begin
  select role, active into v_role, v_was_active
    from admin_users where id = p_target for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if p_active = false then
    if p_target = p_actor then
      return jsonb_build_object('ok', false, 'error', 'self_deactivate');
    end if;
    if v_role = 'superadmin' then
      select count(*) into v_other_supers
        from admin_users
        where role = 'superadmin' and active = true and id <> p_target;
      if v_other_supers = 0 then
        return jsonb_build_object('ok', false, 'error', 'last_superadmin');
      end if;
    end if;
  end if;

  update admin_users
    set active = p_active,
        deactivated_at = case when p_active then null else now() end
    where id = p_target;

  insert into admin_audit_log(admin_id, action, entity, entity_id, new_value)
  values (p_actor, case when p_active then 'staff_reactivate' else 'staff_deactivate' end,
          'admin_user', p_target::text, jsonb_build_object('active', p_active));

  return jsonb_build_object('ok', true);
end$$;

-- ── сменить роль ────────────────────────────────────────────────────────────
create or replace function admin_set_staff_role(
  p_actor uuid,
  p_target uuid,
  p_role text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_cur_role text; v_active boolean; v_other_supers int;
begin
  if p_role not in ('superadmin', 'moderator') then
    return jsonb_build_object('ok', false, 'error', 'bad_role');
  end if;

  select role, active into v_cur_role, v_active
    from admin_users where id = p_target for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- Разжалование superadmin → moderator: беречь инвариант «≥1 активный super».
  if v_cur_role = 'superadmin' and p_role <> 'superadmin' then
    if p_target = p_actor then
      return jsonb_build_object('ok', false, 'error', 'self_demote');
    end if;
    select count(*) into v_other_supers
      from admin_users
      where role = 'superadmin' and active = true and id <> p_target;
    if v_other_supers = 0 then
      return jsonb_build_object('ok', false, 'error', 'last_superadmin');
    end if;
  end if;

  update admin_users set role = p_role where id = p_target;

  insert into admin_audit_log(admin_id, action, entity, entity_id, old_value, new_value)
  values (p_actor, 'staff_set_role', 'admin_user', p_target::text,
          jsonb_build_object('role', v_cur_role), jsonb_build_object('role', p_role));

  return jsonb_build_object('ok', true);
end$$;

do $$ begin raise notice 'Wave 7 staff mgmt: active/created_by + create/set-active/set-role RPCs ready.'; end $$;
