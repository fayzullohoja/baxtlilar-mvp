-- Отзывы - права на create_feedback.
--
-- На проде рядом с приложением живёт роль только-на-чтение grafana_ro: она
-- ходит в ту же базу за витринами analytics.*. По плану тексты отзывов ей не
-- показываем - круг модераторов уже. Функция security definer с дефолтным
-- EXECUTE для PUBLIC отдавала ей запись в public.feedback в обход собственных
-- прав: прямой insert отбивался, а вызов функции проходил.
--
-- Тест держит три условия сразу, потому что дыру закрывает их сумма:
-- функция не definer, pg_temp перечислен явно, EXECUTE у PUBLIC отозван.

begin;

do $$
declare
  uid uuid;
  v_config text;
begin
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990011001, 'approved', 'active') returning id into uid;

  -- 1) Не security definer: функция не делает ничего, что требует прав
  -- владельца (не отключает триггеры, не пишет в чужие схемы), поэтому
  -- повышение прав ей не нужно - а вместе с ним уходит и весь класс дыр.
  if (select prosecdef from pg_proc where proname = 'create_feedback') then
    raise exception 'create_feedback объявлена security definer';
  end if;

  -- 2) pg_temp перечислен в search_path явно. Если его не назвать, Postgres
  -- ищет временную схему ПЕРВОЙ, и неквалифицированное имя feedback в теле
  -- функции подменяется временной таблицей вызывающего.
  select array_to_string(proconfig, ' | ') into v_config
    from pg_proc where proname = 'create_feedback';
  if v_config is null or v_config not like '%pg_temp%' then
    raise exception 'у create_feedback search_path без pg_temp: %', coalesce(v_config, '(пусто)');
  end if;

  -- 3) EXECUTE у PUBLIC отозван. Пустой proacl - это НЕ "никому не выдано",
  -- а дефолт "EXECUTE есть у всех", поэтому проверяем оба условия: список
  -- прав заполнен и PUBLIC (grantee = 0) в нём отсутствует.
  if (select proacl from pg_proc where proname = 'create_feedback') is null then
    raise exception 'proacl у create_feedback пуст - EXECUTE достаётся PUBLIC по умолчанию';
  end if;
  if exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
     where p.proname = 'create_feedback' and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception 'EXECUTE на create_feedback выдан PUBLIC';
  end if;

  -- 4) Поведение, а не только каталог: роль по образцу grafana_ro (кроме
  -- подключения и usage на схему у неё ничего нет) не должна суметь записать
  -- отзыв через функцию.
  create role bx_feedback_ro_probe nologin;
  perform set_config('role', 'bx_feedback_ro_probe', true);
  begin
    perform * from create_feedback(uid, 5, 'запись ролью только-на-чтение', null, 'ru');
    perform set_config('role', 'none', true);
    raise exception 'роль без прав на public.feedback записала отзыв через create_feedback';
  exception when insufficient_privilege then
    perform set_config('role', 'none', true);
  end;

  if exists (select 1 from feedback where user_id = uid) then
    raise exception 'после отбитого вызова в таблице всё равно появилась строка';
  end if;

  raise notice 'feedback: права create_feedback OK';
end $$;

rollback;
