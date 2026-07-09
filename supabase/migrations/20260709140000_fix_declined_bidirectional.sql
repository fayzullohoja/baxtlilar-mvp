-- FIX (2026-07-09, code-review): исключение declined было АСИММЕТРИЧНЫМ.
-- get_recommendations (20260706120000) исключал только viewer→cand declined,
-- но НЕ cand→viewer declined → кандидат, чей интерес просмотрщик отклонил,
-- снова всплывал в рекомендациях/мэтче дня. accepted/pending уже двунаправленны —
-- declined приводим к тому же. Return-колонки НЕ меняются (drop не нужен).
-- Скопировано дословно из 20260706120000, изменена ОДНА строка (declined-предикат).
-- ⚠️ DDL не покрыт vitest — проверить на staging-БД перед прод.

create or replace function public.get_recommendations(
  p_viewer uuid,
  p_limit integer default 50,
  p_relax_level integer default 0
)
  returns table(
    user_id uuid, display_name text, age integer, city text, region text,
    birth_region text, vals text[], vector jsonb, main_photo_path text, relax_level integer
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
         cp.city, cp.region, cp.birth_region, cp.top_life_values as vals,
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
    -- sargable возраст: возраст кандидата ∈ [eff_age_min, eff_age_max]
    and cp.birth_date <= current_date - make_interval(years => v.eff_age_min)
    and cp.birth_date >  current_date - make_interval(years => v.eff_age_max + 1)
    -- candidate-side возрастная преференция (снимается на relax level 2)
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
         or (((mr.sender_id = p_viewer and mr.receiver_id = c.id)
              or (mr.sender_id = c.id and mr.receiver_id = p_viewer))
             and mr.status = 'declined')
    )
  order by c.id
  limit p_limit;
$function$;
