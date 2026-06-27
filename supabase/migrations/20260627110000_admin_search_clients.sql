-- Sprint 2: type-ahead поиск клиентов в /admin/clients.
-- Native query-builder НЕ умеет ILIKE/OR/JOIN, поэтому поиск живёт в одной
-- RPC, использующей pg_trgm GIN-индексы из 20260627100500. Возвращает jsonb
-- массив user_id в порядке релевантности (вызывается как скаляр через .rpc()).
--
-- Детектит вход: ПИНФЛ (14 цифр) · паспорт (AA1234567) · @username · телефон ·
-- иначе — ФИО/display_name по substring ILIKE с ранжированием trgm-similarity.

create or replace function admin_search_clients(p_q text, p_limit int default 50)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_q text := coalesce(trim(p_q), '');
  v_ids jsonb;
  v_lim int := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  -- Пустой запрос → последние зарегистрированные.
  if v_q = '' then
    select coalesce(jsonb_agg(id order by created_at desc), '[]'::jsonb)
      into v_ids
      from (select id, created_at from users order by created_at desc limit v_lim) s;
    return v_ids;
  end if;

  -- ПИНФЛ: ровно 14 цифр.
  if v_q ~ '^\d{14}$' then
    select coalesce(jsonb_agg(user_id), '[]'::jsonb) into v_ids
      from (
        select user_id from user_identity
        where superseded_at is null and pinfl = v_q
        limit v_lim
      ) s;
    return v_ids;
  end if;

  -- Паспорт: 2 буквы + 7 цифр.
  if v_q ~ '^[A-Za-z]{2}\d{7}$' then
    select coalesce(jsonb_agg(user_id), '[]'::jsonb) into v_ids
      from (
        select user_id from user_identity
        where superseded_at is null
          and (passport_series || passport_number) = upper(v_q)
        limit v_lim
      ) s;
    return v_ids;
  end if;

  -- @username (точное совпадение, без @).
  if left(v_q, 1) = '@' then
    select coalesce(jsonb_agg(id), '[]'::jsonb) into v_ids
      from (
        select id from users
        where telegram_username = substring(v_q from 2)
        limit v_lim
      ) s;
    return v_ids;
  end if;

  -- Телефон: + и цифры, длиной >= 5. Матчим по «голым» цифрам как подстроке.
  if v_q ~ '^\+?[0-9 ()-]{5,}$' then
    select coalesce(jsonb_agg(id), '[]'::jsonb) into v_ids
      from (
        select id from users
        where regexp_replace(coalesce(phone_number, ''), '\D', '', 'g')
              ilike '%' || regexp_replace(v_q, '\D', '', 'g') || '%'
        limit v_lim
      ) s;
    return v_ids;
  end if;

  -- ФИО / display_name: substring ILIKE (ускоряется trgm-GIN при >= 3 симв.),
  -- ранжирование по similarity. Дедуп по user_id.
  select coalesce(jsonb_agg(user_id order by sim desc), '[]'::jsonb) into v_ids
  from (
    select user_id, max(sim) as sim
    from (
      select user_id,
             greatest(
               similarity(last_name, v_q),
               similarity(first_name, v_q),
               similarity(coalesce(middle_name, ''), v_q)
             ) as sim
      from user_identity
      where superseded_at is null
        and (last_name ilike '%' || v_q || '%'
             or first_name ilike '%' || v_q || '%'
             or coalesce(middle_name, '') ilike '%' || v_q || '%')
      union all
      select up.user_id, similarity(up.display_name, v_q) as sim
      from user_profiles up
      where up.display_name is not null
        and up.display_name ilike '%' || v_q || '%'
    ) matches
    group by user_id
    order by max(sim) desc
    limit v_lim
  ) ranked;
  return v_ids;
end$$;
