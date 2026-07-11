-- Волна 4 — масштаб на 10k. Три блока: (1) admin_search_clients v2 —
-- фильтры и пагинация переезжают в RPC, чтобы поиск+фильтр компоновались, а
-- страницы резались на стороне БД (раньше status/gender фильтровались в JS по
-- уже-урезанным 50 строкам → неполнота, а verification-фильтра и offset не было
-- вовсе). (2) очередь кейсов: release-RPC + индекс open-cases. (3) здоровье
-- очереди для дашборда (SLA/aging) + индекс фото-очереди.
--
-- Форма RPC — per-branch с ранним return: каждая ветка остаётся отдельным
-- index-friendly запросом (trgm-GIN на ФИО, btree на pinfl/username), фильтр +
-- offset/limit — общий хвост. UNION-CTE-вариант рисковал generic-планом с
-- seq-scan. Gender — через exists() (no-op когда фильтр не задан → нет лишнего
-- join на каждый дефолтный список). Фильтры сравниваются как ::text — никаких
-- enum-cast ошибок на мусорном URL-параметре.

-- created_at-индекс: директория и «показать ещё» сортируют по нему; funnel/
-- demographics тоже сканируют users. Без него дефолтный список = seqscan+top-N.
create index if not exists users_created_idx on users (created_at desc);

-- Старая 2-арг сигнатура несовместима с добавлением параметров → drop+create.
drop function if exists admin_search_clients(text, int);

create or replace function admin_search_clients(
  p_q             text default '',
  p_limit         int default 50,
  p_offset        int default 0,
  p_status        text default null,   -- lifecycle_state ИЛИ 'deleted' (псевдо)
  p_gender        text default null,   -- 'm' | 'f'
  p_verification  text default null,   -- verification_status
  p_include_deleted boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_q     text := coalesce(trim(p_q), '');
  v_ids   jsonb;
  v_lim   int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_off   int := greatest(coalesce(p_offset, 0), 0);
  v_status text := nullif(p_status, 'all');
  v_gender text := case when p_gender in ('m','f') then p_gender end;
  v_verif  text := nullif(p_verification, 'all');
  -- 'deleted' — псевдо-статус: показать soft-deleted (deleted_at is not null).
  -- `is not distinct from` — null-safe: при v_status=NULL (фильтр не задан) даёт
  -- FALSE, а не NULL. Иначе `not NULL` протекает в WHERE и исключает всё (3ВЛ).
  v_deleted_only boolean := (v_status is not distinct from 'deleted');
  v_life  text := case when v_status is not distinct from 'deleted' then null else v_status end;
  v_incl_deleted boolean := coalesce(p_include_deleted, false) or v_deleted_only;
begin
  -- ── Пустой запрос → директория: последние по created_at, с фильтрами ──
  if v_q = '' then
    select coalesce(jsonb_agg(id order by created_at desc), '[]'::jsonb) into v_ids
    from (
      select u.id, u.created_at
      from users u
      where (v_incl_deleted or u.deleted_at is null)
        and (not v_deleted_only or u.deleted_at is not null)
        and (v_life  is null or u.lifecycle_state::text    = v_life)
        and (v_verif is null or u.verification_status::text = v_verif)
        and (v_gender is null or exists (
              select 1 from user_profiles upg
              where upg.user_id = u.id and upg.gender = v_gender))
      order by u.created_at desc
      offset v_off limit v_lim
    ) s;
    return v_ids;
  end if;

  -- ── ПИНФЛ: ровно 14 цифр ──
  if v_q ~ '^\d{14}$' then
    select coalesce(jsonb_agg(user_id order by created_at desc), '[]'::jsonb) into v_ids
    from (
      select ui.user_id, u.created_at
      from user_identity ui
      join users u on u.id = ui.user_id
      where ui.superseded_at is null and ui.pinfl = v_q
        and (v_incl_deleted or u.deleted_at is null)
        and (not v_deleted_only or u.deleted_at is not null)
        and (v_life  is null or u.lifecycle_state::text    = v_life)
        and (v_verif is null or u.verification_status::text = v_verif)
        and (v_gender is null or exists (
              select 1 from user_profiles upg
              where upg.user_id = ui.user_id and upg.gender = v_gender))
      order by u.created_at desc
      offset v_off limit v_lim
    ) s;
    return v_ids;
  end if;

  -- ── Паспорт: 2 буквы + 7 цифр ──
  if v_q ~ '^[A-Za-z]{2}\d{7}$' then
    select coalesce(jsonb_agg(user_id order by created_at desc), '[]'::jsonb) into v_ids
    from (
      select ui.user_id, u.created_at
      from user_identity ui
      join users u on u.id = ui.user_id
      where ui.superseded_at is null
        and (ui.passport_series || ui.passport_number) = upper(v_q)
        and (v_incl_deleted or u.deleted_at is null)
        and (not v_deleted_only or u.deleted_at is not null)
        and (v_life  is null or u.lifecycle_state::text    = v_life)
        and (v_verif is null or u.verification_status::text = v_verif)
        and (v_gender is null or exists (
              select 1 from user_profiles upg
              where upg.user_id = ui.user_id and upg.gender = v_gender))
      order by u.created_at desc
      offset v_off limit v_lim
    ) s;
    return v_ids;
  end if;

  -- ── @username (точное, без @) ──
  if left(v_q, 1) = '@' then
    select coalesce(jsonb_agg(id order by created_at desc), '[]'::jsonb) into v_ids
    from (
      select u.id, u.created_at
      from users u
      where u.telegram_username = substring(v_q from 2)
        and (v_incl_deleted or u.deleted_at is null)
        and (not v_deleted_only or u.deleted_at is not null)
        and (v_life  is null or u.lifecycle_state::text    = v_life)
        and (v_verif is null or u.verification_status::text = v_verif)
        and (v_gender is null or exists (
              select 1 from user_profiles upg
              where upg.user_id = u.id and upg.gender = v_gender))
      order by u.created_at desc
      offset v_off limit v_lim
    ) s;
    return v_ids;
  end if;

  -- ── Телефон: + и цифры, матч по «голым» цифрам как подстроке ──
  if v_q ~ '^\+?[0-9 ()-]{5,}$' then
    select coalesce(jsonb_agg(id order by created_at desc), '[]'::jsonb) into v_ids
    from (
      select u.id, u.created_at
      from users u
      where regexp_replace(coalesce(u.phone_number, ''), '\D', '', 'g')
            ilike '%' || regexp_replace(v_q, '\D', '', 'g') || '%'
        and (v_incl_deleted or u.deleted_at is null)
        and (not v_deleted_only or u.deleted_at is not null)
        and (v_life  is null or u.lifecycle_state::text    = v_life)
        and (v_verif is null or u.verification_status::text = v_verif)
        and (v_gender is null or exists (
              select 1 from user_profiles upg
              where upg.user_id = u.id and upg.gender = v_gender))
      order by u.created_at desc
      offset v_off limit v_lim
    ) s;
    return v_ids;
  end if;

  -- ── ФИО / display_name: substring ILIKE (trgm-GIN на ФИО), ранж по similarity ──
  select coalesce(jsonb_agg(user_id order by sim desc), '[]'::jsonb) into v_ids
  from (
    select m.user_id, max(m.sim) as sim
    from (
      select ui.user_id,
             greatest(
               similarity(ui.last_name, v_q),
               similarity(ui.first_name, v_q),
               similarity(coalesce(ui.middle_name, ''), v_q)
             ) as sim
      from user_identity ui
      where ui.superseded_at is null
        and (ui.last_name  ilike '%' || v_q || '%'
             or ui.first_name ilike '%' || v_q || '%'
             or coalesce(ui.middle_name, '') ilike '%' || v_q || '%')
      union all
      select up2.user_id, similarity(up2.display_name, v_q) as sim
      from user_profiles up2
      where up2.display_name is not null
        and up2.display_name ilike '%' || v_q || '%'
    ) m
    join users u on u.id = m.user_id
    where (v_incl_deleted or u.deleted_at is null)
      and (not v_deleted_only or u.deleted_at is not null)
      and (v_life  is null or u.lifecycle_state::text    = v_life)
      and (v_verif is null or u.verification_status::text = v_verif)
      and (v_gender is null or exists (
            select 1 from user_profiles upg
            where upg.user_id = m.user_id and upg.gender = v_gender))
    group by m.user_id
    order by max(m.sim) desc
    offset v_off limit v_lim
  ) ranked;
  return v_ids;
end$$;


-- ── QZ-2: ручное освобождение кейса (владелец или суперадмин) ──────────────
-- Возвращает кейс в пул (assignee=null, state='new'), СОХРАНЯЯ draft_payload —
-- начатая работа не теряется, следующий модератор видит черновик. Это тот же
-- обход стейт-машины на уровне RPC, что и SLA-reclaim (data_entry→new).
create or replace function admin_release_case(
  p_case_id uuid,
  p_admin_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_state    verification_case_state;
  v_assignee uuid;
  v_is_super boolean;
begin
  select state, assignee_id into v_state, v_assignee
    from verification_cases where id = p_case_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'case_not_found');
  end if;
  if v_state = 'closed' then
    return jsonb_build_object('ok', false, 'error', 'case_closed');
  end if;
  if v_assignee is null then
    return jsonb_build_object('ok', true, 'already_unassigned', true);
  end if;

  select (role = 'superadmin') into v_is_super from admin_users where id = p_admin_id;
  if v_assignee <> p_admin_id and not coalesce(v_is_super, false) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;

  update verification_cases
    set assignee_id = null,
        state       = 'new',
        claimed_at  = null   -- draft_payload НЕ трогаем
    where id = p_case_id;

  perform _emit_case_event(
    p_case_id, p_admin_id, 'released',
    jsonb_build_object('prev_assignee', v_assignee, 'prev_state', v_state::text)
  );

  return jsonb_build_object('ok', true);
end$$;


-- ── QZ-7 / SG-04: здоровье очереди для дашборда (SLA / aging) ──────────────
create or replace function get_queue_health()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'open_total',   (select count(*) from verification_cases where state <> 'closed'),
    'unassigned',   (select count(*) from verification_cases where state <> 'closed' and assignee_id is null),
    'oldest_open_hours',
      coalesce((select round((extract(epoch from (now() - min(created_at))) / 3600)::numeric, 1)
                from verification_cases where state <> 'closed'), 0),
    'over_24h',     (select count(*) from verification_cases
                     where state <> 'closed' and created_at < now() - interval '24 hours'),
    'over_72h',     (select count(*) from verification_cases
                     where state <> 'closed' and created_at < now() - interval '72 hours'),
    'photos_over_24h', (select count(*) from profile_photos
                        where status in ('under_review','uploaded')
                          and created_at < now() - interval '24 hours')
  );
$$;


-- Недостающий trgm-GIN на display_name: name-поиск матчит и по нему (второе плечо
-- union), но индекса не было (только на ФИО из user_identity) → seqscan профилей
-- на каждый набор буквы. Закрываем — это основной путь поиска в директории.
create index if not exists user_profiles_display_name_trgm_idx
  on user_profiles using gin (display_name gin_trgm_ops)
  where display_name is not null;

-- ── PH-6 + очередь: партиальные индексы под ordered-scan очередей ──────────
create index if not exists profile_photos_review_queue_idx
  on profile_photos (created_at)
  where status in ('under_review', 'uploaded');

create index if not exists verification_cases_open_created_idx
  on verification_cases (created_at)
  where state <> 'closed';

do $$ begin raise notice 'Wave 4 scale: search v2 + release + queue-health + queue indexes ready.'; end $$;
