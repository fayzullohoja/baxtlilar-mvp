-- 20260630000000_recommendations_v3_top_life_values.sql
-- Bug #3 from E2E test 2026-06-30: get_recommendations RPC селектила дропнутую
-- колонку `values` (Sprint 3 cleanup убрал её в пользу top_life_values).
-- Каждый вызов RPC падал в PostgREST и возвращал пустой результат → main feed
-- у всех verified юзеров показывал "Алгоритм ищет подходящего человека" forever.
--
-- Этот патч пересоздаёт RPC с теми же фильтрами (viewer-gate Sprint 5), но
-- selectit `top_life_values` вместо `values`. Имя поля в return-table осталось
-- `vals` для backwards-compat с recommend.ts/score.ts.

create or replace function public.get_recommendations(p_viewer uuid, p_limit integer default 50)
  returns table(user_id uuid, display_name text, age integer, city text, vals text[], vector jsonb, main_photo_path text)
  language sql
  stable
as $function$
  with v as (
    select u.id, vp.gender, vp.looking_for_gender, vp.city, vp.top_life_values as vals,
           date_part('year', age(vp.birth_date))::int as age,
           vp.partner_age_min, vp.partner_age_max
    from users u
    join user_profiles vp on vp.user_id = u.id
    where u.id = p_viewer
      and u.lifecycle_state = 'active'
      and u.verification_status = 'approved'
  )
  select c.id, cp.display_name,
         date_part('year', age(cp.birth_date))::int as age,
         cp.city, cp.top_life_values as vals,
         coalesce(cq.vector, '{}'::jsonb) as vector,
         (select pp.path from profile_photos pp
            where pp.user_id = c.id and pp.status = 'approved'
            order by pp.is_main desc, pp.ord asc limit 1) as main_photo_path
  from users c
  join user_profiles cp on cp.user_id = c.id
  left join quiz_results cq on cq.user_id = c.id
  cross join v
  where c.id <> p_viewer
    and c.lifecycle_state = 'active'
    and c.verification_status = 'approved'
    and cp.status = 'published'
    and cp.gender = v.looking_for_gender
    and v.gender = cp.looking_for_gender
    and date_part('year', age(cp.birth_date))::int between v.partner_age_min and v.partner_age_max
    and v.age between cp.partner_age_min and cp.partner_age_max
    and exists (select 1 from profile_photos pp where pp.user_id = c.id and pp.status = 'approved')
    and not exists (select 1 from match_views mv where mv.viewer_id = p_viewer and mv.target_id = c.id)
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = p_viewer and b.blocked_id = c.id)
         or (b.blocker_id = c.id and b.blocked_id = p_viewer)
    )
    and not exists (
      select 1 from match_requests mr
      where (
              ((mr.sender_id = p_viewer and mr.receiver_id = c.id)
                or (mr.sender_id = c.id and mr.receiver_id = p_viewer))
              and (mr.status = 'accepted' or (mr.status = 'pending' and mr.auto_decline_at > now()))
            )
         or (mr.sender_id = p_viewer and mr.receiver_id = c.id and mr.status = 'declined')
    )
  limit p_limit;
$function$;

do $$
begin
  raise notice 'V3 RPC migration applied: get_recommendations selects top_life_values.';
end $$;
