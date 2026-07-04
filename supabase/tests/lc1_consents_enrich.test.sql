-- LC-1 — обогащение consents (status/source/action_id/categories/withdraw) +
-- record_consent (insert-or-reactivate) + withdraw_consents (status-flip).
--
-- Ключевой edge (advisor 2026-07-04): повторное согласие ПОСЛЕ отзыва должно
-- РЕАКТИВИРОВАТЬ (свежий явный клик «Согласен»), иначе «отзыв залипает» молча.

begin;

-- enum существует с тремя значениями
do $$
begin
  if (select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid
      where t.typname='consent_status') <> 3 then
    raise exception 'consent_status enum должен иметь 3 значения';
  end if;
end $$;

-- новые колонки существуют
do $$
declare need text[] := array['consent_status','source','action_id','categories','withdrawn_at','withdrawn_reason','telegram_id'];
        c text;
begin
  foreach c in array need loop
    if not exists (select 1 from information_schema.columns
                   where table_name='consents' and column_name=c) then
      raise exception 'нет колонки consents.%', c;
    end if;
  end loop;
end $$;

do $$
declare u uuid; n int; st text; wat timestamptz; aid1 text; aid2 text;
begin
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009800, 'approved', 'active') returning id into u;

  -- 1) record_consent вставляет active, с source/categories/action_id
  perform record_consent(u, 990009800::bigint, array['terms','pd'], 'v1', 'ru',
                         'sha-1', 'tg_bot', array['general_pd'], 'tg-webhook', 'telegram-bot');
  select count(*) into n from consents where user_id=u;
  if n <> 2 then raise exception 'ожидалось 2 согласия, %', n; end if;
  select consent_status::text, action_id into st, aid1 from consents where user_id=u and consent_type='pd';
  if st <> 'active' then raise exception 'pd должен быть active, %', st; end if;
  if aid1 is null then raise exception 'action_id не заполнен'; end if;
  if (select categories from consents where user_id=u and consent_type='pd') <> array['general_pd'] then
    raise exception 'categories не записаны'; end if;
  -- один action_id на весь батч
  if (select count(distinct action_id) from consents where user_id=u) <> 1 then
    raise exception 'ожидался единый action_id на батч'; end if;

  -- 2) повторный вызов идемпотентен: не плодит строки
  perform record_consent(u, 990009800::bigint, array['terms','pd'], 'v1', 'ru',
                         'sha-1', 'tg_bot', array['general_pd'], 'tg-webhook', 'telegram-bot');
  select count(*) into n from consents where user_id=u;
  if n <> 2 then raise exception 'повтор не должен плодить строки, %', n; end if;

  -- 3) withdraw_consents: active → withdrawn, возвращает число
  n := withdraw_consents(u, 'user request', null);
  if n <> 2 then raise exception 'withdraw должен вернуть 2, %', n; end if;
  select consent_status::text, withdrawn_at into st, wat from consents where user_id=u and consent_type='pd';
  if st <> 'withdrawn' then raise exception 'pd должен стать withdrawn, %', st; end if;
  if wat is null then raise exception 'withdrawn_at не проставлен'; end if;

  -- 4) РЕАКТИВАЦИЯ: свежее согласие той же версии → снова active, withdrawn_at очищен
  perform record_consent(u, 990009800::bigint, array['terms','pd'], 'v1', 'ru',
                         'sha-1', 'tg_bot', array['general_pd'], 'tg-webhook', 'telegram-bot');
  select consent_status::text, withdrawn_at, action_id into st, wat, aid2 from consents where user_id=u and consent_type='pd';
  if st <> 'active' then raise exception 'реактивация: pd должен снова быть active, %', st; end if;
  if wat is not null then raise exception 'реактивация: withdrawn_at должен очиститься'; end if;
  if aid2 = aid1 then raise exception 'реактивация: ожидался новый action_id'; end if;
  select count(*) into n from consents where user_id=u;
  if n <> 2 then raise exception 'реактивация не должна плодить строки, %', n; end if;

  -- 5) withdraw с фильтром типов затрагивает только их
  n := withdraw_consents(u, 'partial', array['pd']);
  if n <> 1 then raise exception 'частичный withdraw должен вернуть 1, %', n; end if;
  if (select consent_status::text from consents where user_id=u and consent_type='terms') <> 'active' then
    raise exception 'terms не должен быть затронут частичным withdraw'; end if;

  raise notice 'LC-1 consents enrich OK';
end $$;

rollback;
