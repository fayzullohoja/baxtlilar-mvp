-- Техдолг: подбор брал произвольную сотню кандидатов до расчёта совпадения.
--
-- Находка аудита. get_recommendations отбирал кандидатов , то есть по порядку uuid, а скоринг применялся уже к этой случайной
-- сотне. Сегодня безвредно (подходящих у каждого меньше сотни), но начиная
-- примерно с 200-250 опубликованных анкет лучший кандидат систематически
-- вываливался бы из выдачи - молча, без единого признака.
--
-- Тело функции взято из живой базы и изменено точечно: заменён только order by.
-- Логика фильтров, лестница ослабления и набор колонок не тронуты.

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
  -- Порядок отбора. Раньше здесь стояло order by c.id - то есть сотня
  -- кандидатов бралась в порядке uuid, произвольно, и только потом JS считал
  -- совпадение по этой сотне. Лучший человек мог оказаться сто первым и не
  -- показаться вовсе. При 23 анкетах незаметно, при нескольких тысячах - нет.
  --
  -- Сортируем по дешёвому приближению к той же оценке, что считает JS: город
  -- (+30 в score), наличие общих ценностей (до +30) и близость возраста (до
  -- +20). Вектор здесь не считаем - он дорогой и живёт в JS, но три из четырёх
  -- слагаемых уже дают срез, коррелирующий с итогом.
  --
  -- c.id последним - устойчивый порядок при равных, иначе выдача скачет между
  -- запросами и человек видит разных людей на одном и том же экране.
  order by
    (cp.city = v.city) desc,
    (cp.top_life_values && v.vals) desc,
    abs(date_part('year', age(cp.birth_date))::int - v.age) asc,
    c.id
  limit p_limit;
$function$;
