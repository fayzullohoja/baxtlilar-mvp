-- DB-1 — серверные страховки (F-115) живут на РОЛИ приложения, а не в
-- connection-options: PgBouncer transaction-mode не пропускает startup options,
-- и без переноса пул остался бы без statement_timeout вовсе.

do $$
declare cfg text[];
begin
  select setconfig into cfg
  from pg_db_role_setting s
  join pg_roles r on r.oid = s.setrole
  where r.rolname = current_user and s.setdatabase = 0;

  if cfg is null then
    raise exception 'role-GUC не заданы для %', current_user;
  end if;
  if not (cfg @> array['statement_timeout=10000']) then
    raise exception 'statement_timeout=10000 не задан на роли: %', cfg;
  end if;
  if not (cfg @> array['idle_in_transaction_session_timeout=60000']) then
    raise exception 'idle_in_transaction_session_timeout=60000 не задан на роли: %', cfg;
  end if;
  if not (cfg @> array['application_name=baxtlilar-web']) then
    raise exception 'application_name=baxtlilar-web не задан на роли: %', cfg;
  end if;

  raise notice 'DB-1 role GUCs OK';
end $$;
