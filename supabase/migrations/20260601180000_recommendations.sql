-- S5: рекомендации — жёсткие фильтры в SQL (взаимный пол/возраст, verified+published,
-- ≥1 approved-фото, исключить self/просмотренных/заблокированных/уже-в-запросе). Скоринг — в JS.
create or replace function get_recommendations(p_viewer uuid, p_limit int default 50)
returns table (
  user_id uuid,
  display_name text,
  age int,
  city text,
  vals text[],
  vector jsonb,
  main_photo_path text
)
language sql
stable
as $$
  with v as (
    select u.id,
           vp.gender,
           vp.looking_for_gender,
           vp.city,
           vp.values as vals,
           date_part('year', age(vp.birth_date))::int as age,
           vp.partner_age_min,
           vp.partner_age_max
    from users u
    join user_profiles vp on vp.user_id = u.id
    where u.id = p_viewer
  )
  select c.id,
         cp.display_name,
         date_part('year', age(cp.birth_date))::int as age,
         cp.city,
         cp.values as vals,
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
      where ((mr.sender_id = p_viewer and mr.receiver_id = c.id)
          or (mr.sender_id = c.id and mr.receiver_id = p_viewer))
        and mr.status in ('pending', 'accepted')
    )
  limit p_limit;
$$;
