-- DB-5 — sargable возрастной фильтр + покрывающий индекс.
--
-- Было: date_part('year', age(cp.birth_date))::int between eff_min and eff_max —
-- функция по колонке, планировщик не может использовать индекс по birth_date →
-- Seq Scan на user_profiles при КАЖДОМ /main (горячий путь, DBS-03).
--
-- Стало: диапазон по самой birth_date (эквивалент по семантике age(), проверено
-- set-equality тестом db5 на границах дней рождения):
--   age >= eff_min  ⟺  birth_date <= current_date - eff_min лет
--   age <= eff_max  ⟺  birth_date >= current_date - (eff_max+1) лет + 1 день
-- Плюс частичный покрывающий индекс (gender, looking_for_gender, birth_date)
-- WHERE status='published' — равенства по полу + диапазон по birth_date.
--
-- CAVEAT (leap-year): у рождённых 29 февраля возможно расхождение в 1 день с
-- age() на невисокосных границах — допустимо для возрастного фильтра знакомств.

create index if not exists user_profiles_reco_idx
  on user_profiles (gender, looking_for_gender, birth_date)
  where status = 'published';

create or replace function public.get_recommendations(
  p_viewer uuid,
  p_limit integer default 50,
  p_relax_level integer default 0
)
  returns table(
    user_id uuid, display_name text, age integer, city text, vals text[],
    vector jsonb, main_photo_path text, relax_level integer
  )
  language sql
  stable
as $function$
  with v as (
    select u.id, vp.gender, vp.looking_for_gender, vp.city, vp.top_life_values as vals,
           date_part('year', age(vp.birth_date))::int as age,
           case when p_relax_level >= 1
                then greatest(18, vp.partner_age_min - 5)
                else vp.partner_age_min end as eff_age_min,
           case when p_relax_level >= 1
                then vp.partner_age_max + 5
                else vp.partner_age_max end as eff_age_max
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
            order by pp.is_main desc, pp.ord asc limit 1) as main_photo_path,
         p_relax_level as relax_level
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
    -- DB-5: sargable диапазон вместо date_part(age(...)) — использует reco_idx
    and cp.birth_date <= (current_date - make_interval(years => v.eff_age_min))::date
    and cp.birth_date >= (current_date - make_interval(years => v.eff_age_max + 1) + interval '1 day')::date
    and (p_relax_level >= 2 or v.age between cp.partner_age_min and cp.partner_age_max)
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
