-- MATCH-1 — degradation ladder: get_recommendations(p_viewer, p_limit, p_relax_level).
--
-- Проблема (BIZ launch-blocker): на малом пуле строгие взаимные возрастные
-- диапазоны дают пустой фид → «Алгоритм ищет…» навсегда → уход юзера. Вместо
-- пустого результата приложение (MATCH-2, recommend.ts) пробует уровни:
--   level 0 — strict, текущее поведение (дефолт: старые вызовы не меняются);
--   level 1 — возрастное окно ЗРИТЕЛЯ расширяется на ±5 лет, floor 18
--             (greatest(18, min-5) — никогда не показываем младше 18);
--   level 2 — дополнительно снимается candidate-side возрастная преференция
--             (кандидат, чьи prefs не покрывают зрителя).
-- ВСЁ остальное инвариантно на каждом уровне: lifecycle active, verification
-- approved, published, ВЗАИМНЫЙ ПОЛ, approved-фото, match_views dedup, blocks,
-- existing-request. City не релаксится — города нет в SQL-фильтрах вообще
-- (только JS-скоринг в score.ts).
--
-- Return несёт relax_level (эхо параметра) — story-генератор обязан честно
-- сказать «мы расширили возрастной диапазон» (MATCH-3).

drop function if exists public.get_recommendations(uuid, integer);

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
    and date_part('year', age(cp.birth_date))::int between v.eff_age_min and v.eff_age_max
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

-- is_matchable синхронизируется с ladder: гейт /api/interest должен пропускать
-- ВСЁ, что ladder мог легитимно показать (иначе юзер не может отправить интерес
-- собственному «матчу дня» с relax-уровня). Зеркалим level 2 = самый широкий
-- легальный: окно отправителя ±5 (floor 18), candidate-side преференция снята.
-- Статусы и взаимный пол — инвариантны. Blocks проверяет роут отдельно.
create or replace function is_matchable(p_sender uuid, p_receiver uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from user_profiles sp
    join user_profiles rp on rp.user_id = p_receiver
    join users ru on ru.id = p_receiver
    where sp.user_id = p_sender
      and ru.lifecycle_state = 'active'
      and ru.verification_status = 'approved'
      and rp.status = 'published'
      and rp.gender = sp.looking_for_gender
      and sp.gender = rp.looking_for_gender
      and date_part('year', age(rp.birth_date))::int
            between greatest(18, sp.partner_age_min - 5) and sp.partner_age_max + 5
  );
$$;
