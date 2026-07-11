-- F4 hard-gate (ревью оунера): профили с needs_marital_review=true (семейное
-- положение «в процессе развода» / «в браке, но живу отдельно», см.
-- MARITAL_STATUS_NEEDS_REVIEW) ПОЛНОСТЬЮ выпадают из мэтчинга до одобрения
-- оператором — не показываются в подборе, не могут слать/получать интерес, и
-- сами видят пустой фид («на проверке»). Оператор чистит флаг в админке
-- (/api/admin/users/[id]/approve-marital) → needs_marital_review=false → профиль
-- снова в мэтчинге.
--
-- Тела функций воспроизведены из живого прод-определения (pg_get_functiondef)
-- 2026-07-11 + добавлены 4 условия needs_marital_review = false (viewer/candidate
-- в get_recommendations; sender/receiver в is_matchable). Аддитивно, backward-safe
-- (у не-флагнутых профилей флаг=false → поведение не меняется).

CREATE OR REPLACE FUNCTION public.get_recommendations(p_viewer uuid, p_limit integer DEFAULT 50, p_relax_level integer DEFAULT 0)
 RETURNS TABLE(user_id uuid, display_name text, age integer, city text, region text, birth_region text, vals text[], vector jsonb, main_photo_path text, relax_level integer)
 LANGUAGE sql
 STABLE
AS $function$
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
      -- F4: флагнутый viewer видит пустой фид (сам «на проверке»)
      and vp.needs_marital_review = false
  )
  select c.id, cp.display_name,
         date_part('year', age(cp.birth_date))::int as age,
         cp.city, cp.region, cp.birth_region, cp.top_life_values as vals,
         coalesce(cq.vector, '{}'::jsonb) as vector,
         (select pp.path from profile_photos pp
            where pp.user_id = c.id and pp.status = 'approved'
              and pp.photo_type <> 'family'
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
    -- F4: флагнутый кандидат скрыт из подбора до одобрения оператором
    and cp.needs_marital_review = false
    and cp.gender = v.looking_for_gender
    and v.gender = cp.looking_for_gender
    -- sargable возраст: возраст кандидата ∈ [eff_age_min, eff_age_max]
    and cp.birth_date <= current_date - make_interval(years => v.eff_age_min)
    and cp.birth_date >  current_date - make_interval(years => v.eff_age_max + 1)
    -- candidate-side возрастная преференция (снимается на relax level 2)
    and (p_relax_level >= 2 or v.age between cp.partner_age_min and cp.partner_age_max)
    and exists (select 1 from profile_photos pp
                where pp.user_id = c.id and pp.status = 'approved'
                  and pp.photo_type <> 'family')
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
         or (((mr.sender_id = p_viewer and mr.receiver_id = c.id)
              or (mr.sender_id = c.id and mr.receiver_id = p_viewer))
             and mr.status = 'declined')
    )
  order by c.id
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.is_matchable(p_sender uuid, p_receiver uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1
    from user_profiles sp
    join user_profiles rp on rp.user_id = p_receiver
    join users ru on ru.id = p_receiver
    where sp.user_id = p_sender
      -- F4: флагнутый sender не может инициировать мэтч, флагнутый receiver скрыт
      and sp.needs_marital_review = false
      and rp.needs_marital_review = false
      and ru.lifecycle_state = 'active'
      and ru.verification_status = 'approved'
      and rp.status = 'published'
      and rp.gender = sp.looking_for_gender
      and sp.gender = rp.looking_for_gender
      and date_part('year', age(rp.birth_date))::int
            between greatest(18, sp.partner_age_min - 5) and sp.partner_age_max + 5
  );
$function$;
