-- 20260626000000_v2_recommendations_viewer_gate.sql
-- V2 Phase A · Sprint 5: defense-in-depth для get_recommendations.
--
-- ДО: RPC возвращала approved кандидатов независимо от того кто viewer.
-- Shadow user мог напрямую вызвать RPC и получить feed данные в обход
-- page-level guard.
--
-- ПОСЛЕ: viewer side тоже фильтруется (must be active + approved).
-- Если viewer = shadow → CTE пустая → весь результат пустой.
--
-- Это 4-й эшелон защиты (Blueprint §2.8):
--   1. Middleware           (TODO Sprint 7)
--   2. Route handler        (Sprint 5: withPermission wrapper)
--   3. RPC SECURITY DEFINER (этот патч)
--   4. View filter          (опционально на match_candidates view, если будет)

create or replace function public.get_recommendations(p_viewer uuid, p_limit integer default 50)
  returns table(user_id uuid, display_name text, age integer, city text, vals text[], vector jsonb, main_photo_path text)
  language sql
  stable
as $function$
  with v as (
    select u.id, vp.gender, vp.looking_for_gender, vp.city, vp.values as vals,
           date_part('year', age(vp.birth_date))::int as age,
           vp.partner_age_min, vp.partner_age_max
    from users u
    join user_profiles vp on vp.user_id = u.id
    where u.id = p_viewer
      -- V2 defense-in-depth: shadow/rejected/paused/blocked viewer не должны
      -- получать рекомендации, даже если page guard был обойден.
      and u.lifecycle_state = 'active'
      and u.verification_status = 'approved'
  )
  select c.id, cp.display_name,
         date_part('year', age(cp.birth_date))::int as age,
         cp.city, cp.values as vals,
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
  raise notice 'V2 RPC viewer-gate migration applied. get_recommendations now no-op for shadow users.';
end $$;
