-- Волна 7 Фаза 2: инварианты staff-управления (last-superadmin, self-guards, uniqueness).
do $$
declare
  s1 uuid; s2 uuid; m1 uuid; r jsonb; newid uuid;
begin
  -- Чистим и создаём известных админов.
  delete from admin_users where login like 'stafftest_%';
  insert into admin_users(login, role, password_hash, active)
    values ('stafftest_super1', 'superadmin', 'scrypt$aa$bb', true) returning id into s1;
  insert into admin_users(login, role, password_hash, active)
    values ('stafftest_super2', 'superadmin', 'scrypt$aa$bb', true) returning id into s2;
  insert into admin_users(login, role, password_hash, active)
    values ('stafftest_mod1', 'moderator', 'scrypt$aa$bb', true) returning id into m1;

  -- CREATE: успех + уникальность логина.
  r := admin_create_staff(s1, 'stafftest_new', 'scrypt$cc$dd', 'moderator');
  assert (r->>'ok')::boolean, format('create should ok: %s', r);
  newid := (r->>'id')::uuid;
  r := admin_create_staff(s1, 'STAFFTEST_NEW', 'scrypt$cc$dd', 'moderator'); -- lower-collision
  assert (r->>'ok')::boolean is false and r->>'error' = 'login_taken', format('dup login: %s', r);
  r := admin_create_staff(s1, 'stafftest_badrole', 'scrypt$cc$dd', 'root');
  assert r->>'error' = 'bad_role', format('bad role: %s', r);

  -- SET ACTIVE: self-deactivate запрещён.
  r := admin_set_staff_active(s1, s1, false);
  assert r->>'error' = 'self_deactivate', format('self-deactivate must block: %s', r);

  -- Деактивировать super2 (super1 ещё активен) → ok.
  r := admin_set_staff_active(s1, s2, false);
  assert (r->>'ok')::boolean, format('deactivate super2 ok: %s', r);
  assert (select active is false and deactivated_at is not null from admin_users where id = s2),
    'super2 must be inactive with deactivated_at';

  -- Теперь super1 — последний активный super → деактивировать нельзя (другим актором).
  -- Сделаем m1 актором-инициатором (роль актора RPC не проверяет — гейт в роуте).
  r := admin_set_staff_active(m1, s1, false);
  assert r->>'error' = 'last_superadmin', format('last active super deactivate must block: %s', r);

  -- SET ROLE: разжаловать super при живом другом super. Реактивируем super2.
  r := admin_set_staff_active(s1, s2, true);
  assert (r->>'ok')::boolean, 'reactivate super2';
  r := admin_set_staff_role(s2, s1, 'moderator'); -- есть super2 → ok
  assert (r->>'ok')::boolean, format('demote super1 with super2 alive ok: %s', r);
  assert (select role = 'moderator' from admin_users where id = s1), 's1 now moderator';

  -- Теперь super2 — последний super. Разжаловать нельзя.
  r := admin_set_staff_role(m1, s2, 'moderator');
  assert r->>'error' = 'last_superadmin', format('demote last super must block: %s', r);

  -- self-demote запрещён (super2 разжалует сам себя).
  r := admin_set_staff_role(s2, s2, 'moderator');
  assert r->>'error' = 'self_demote', format('self-demote must block: %s', r);

  -- Очистку не делаем: audit_log ссылается на этих админов (on delete restrict),
  -- а ephemeral-БД харнесса и так выбрасывается после прогона.
  raise notice '✓ staff management invariants OK';
end$$;
