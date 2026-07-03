-- FUNNEL-1..4 — воронка + North Star для /admin/analytics (один RPC, паттерн
-- get_admin_demographics: jsonb, stable, только не удалённые).
--
-- Стадии воронки (gender-segmented; пол из user_profiles, до анкеты — только n):
--   signup        — deleted_at is null
--   verified      — verification_status = 'approved'
--   published     — user_profiles.status = 'published'
--   first_mutual  — участвует хотя бы в одной match_requests со status='accepted'
--   chat_unlocked — участвует хотя бы в одном chats-ряду
--   (пока ensureChat синхронный, first_mutual == chat_unlocked — расходятся
--    только при сбое создания чата; footnote в UI.)
--
-- empty_feed — доля active+approved+published юзеров, у кого STRICT tier 0
-- (НЕ degraded — деградация спрятала бы проблему пустого пула) даёт 0 кандидатов.
-- НАБОР ПРЕДИКАТОВ ЗЕРКАЛИТ get_recommendations level 0 (20260703000000):
-- взаимный пол, взаимные возрастные диапазоны, approved-фото, match_views dedup,
-- blocks, existing-request. Меняешь предикаты там — обнови здесь. Set-based
-- (self-join eligible×eligible c NOT EXISTS), не N вызовов RPC.
--
-- north_star — «Северная звезда» (источник правды: ChatGPT chat13 §2.1):
-- verified mutual interests with chat started = пары, где оба approved+published,
-- заявка accepted, чат существует и в нём есть >=1 сообщение. Safety-квалификаторы
-- спеки («нет жалоб в первые N дней», «нет блока сразу после старта») аппрокси-
-- мированы без time-window: исключаем пары, где есть report или block в любую
-- сторону. Дельта от §2.1: окно N дней не реализовано (нет события «жалоба
-- относится к паре» — берём любые reports между участниками).

create or replace function get_admin_funnel()
returns jsonb
language sql
stable
as $$
  with base as (
    select u.id,
           u.lifecycle_state,
           u.verification_status,
           p.gender,
           p.status as profile_status
    from users u
    left join user_profiles p on p.user_id = u.id
    where u.deleted_at is null
  ),
  mutual as (
    select distinct x.uid from (
      select mr.sender_id as uid from match_requests mr where mr.status = 'accepted'
      union all
      select mr.receiver_id from match_requests mr where mr.status = 'accepted'
    ) x
  ),
  in_chat as (
    select distinct x.uid from (
      select ch.user_a as uid from chats ch
      union all
      select ch.user_b from chats ch
    ) x
  ),
  eligible as (
    select u.id, p.gender, p.looking_for_gender, p.city,
           date_part('year', age(p.birth_date))::int as age,
           p.partner_age_min, p.partner_age_max
    from users u
    join user_profiles p on p.user_id = u.id
    where u.deleted_at is null
      and u.lifecycle_state = 'active'
      and u.verification_status = 'approved'
      and p.status = 'published'
  ),
  feed as (
    select e.id, e.gender, e.city,
           exists (
             select 1
             from eligible c
             where c.id <> e.id
               and c.gender = e.looking_for_gender
               and e.gender = c.looking_for_gender
               and c.age between e.partner_age_min and e.partner_age_max
               and e.age between c.partner_age_min and c.partner_age_max
               and exists (select 1 from profile_photos pp
                           where pp.user_id = c.id and pp.status = 'approved')
               and not exists (select 1 from match_views mv
                               where mv.viewer_id = e.id and mv.target_id = c.id)
               and not exists (
                 select 1 from blocks b
                 where (b.blocker_id = e.id and b.blocked_id = c.id)
                    or (b.blocker_id = c.id and b.blocked_id = e.id)
               )
               and not exists (
                 select 1 from match_requests mr
                 where (
                         ((mr.sender_id = e.id and mr.receiver_id = c.id)
                           or (mr.sender_id = c.id and mr.receiver_id = e.id))
                         and (mr.status = 'accepted' or (mr.status = 'pending' and mr.auto_decline_at > now()))
                       )
                    or (mr.sender_id = e.id and mr.receiver_id = c.id and mr.status = 'declined')
               )
           ) as has_feed
    from eligible e
  ),
  ns_pairs as (
    select distinct least(mr.sender_id, mr.receiver_id) as a,
                    greatest(mr.sender_id, mr.receiver_id) as b
    from match_requests mr
    join users us on us.id = mr.sender_id
    join users ur on ur.id = mr.receiver_id
    join user_profiles ps on ps.user_id = mr.sender_id
    join user_profiles pr on pr.user_id = mr.receiver_id
    where mr.status = 'accepted'
      and us.deleted_at is null and ur.deleted_at is null
      and us.verification_status = 'approved'
      and ur.verification_status = 'approved'
      and ps.status = 'published'
      and pr.status = 'published'
      and exists (
        select 1 from chats ch
        join chat_messages cm on cm.chat_id = ch.id
        where ch.user_a = least(mr.sender_id, mr.receiver_id)
          and ch.user_b = greatest(mr.sender_id, mr.receiver_id)
      )
      and not exists (
        select 1 from blocks b
        where (b.blocker_id = mr.sender_id and b.blocked_id = mr.receiver_id)
           or (b.blocker_id = mr.receiver_id and b.blocked_id = mr.sender_id)
      )
      and not exists (
        select 1 from reports r
        where (r.reporter_id = mr.sender_id and r.target_user_id = mr.receiver_id)
           or (r.reporter_id = mr.receiver_id and r.target_user_id = mr.sender_id)
      )
  )
  select jsonb_build_object(
    'funnel', jsonb_build_object(
      'signup', (select jsonb_build_object(
          'n', count(*),
          'm', count(*) filter (where gender = 'm'),
          'f', count(*) filter (where gender = 'f')) from base),
      'verified', (select jsonb_build_object(
          'n', count(*),
          'm', count(*) filter (where gender = 'm'),
          'f', count(*) filter (where gender = 'f'))
        from base where verification_status = 'approved'),
      'published', (select jsonb_build_object(
          'n', count(*),
          'm', count(*) filter (where gender = 'm'),
          'f', count(*) filter (where gender = 'f'))
        from base where profile_status = 'published'),
      'first_mutual', (select jsonb_build_object(
          'n', count(*),
          'm', count(*) filter (where gender = 'm'),
          'f', count(*) filter (where gender = 'f'))
        from base where id in (select uid from mutual)),
      'chat_unlocked', (select jsonb_build_object(
          'n', count(*),
          'm', count(*) filter (where gender = 'm'),
          'f', count(*) filter (where gender = 'f'))
        from base where id in (select uid from in_chat))
    ),
    'empty_feed', (select jsonb_build_object(
        'eligible', count(*),
        'empty', count(*) filter (where not has_feed),
        'by_gender', jsonb_build_object(
          'm', jsonb_build_object(
            'eligible', count(*) filter (where gender = 'm'),
            'empty', count(*) filter (where gender = 'm' and not has_feed)),
          'f', jsonb_build_object(
            'eligible', count(*) filter (where gender = 'f'),
            'empty', count(*) filter (where gender = 'f' and not has_feed))
        ),
        'by_city', (
          select coalesce(jsonb_agg(jsonb_build_object(
                   'city', city, 'eligible', el, 'empty', em) order by em desc, el desc), '[]'::jsonb)
          from (
            select f2.city, count(*) as el, count(*) filter (where not f2.has_feed) as em
            from feed f2
            where f2.city is not null
            group by f2.city
          ) t
        )
      ) from feed),
    'rates', jsonb_build_object(
      -- proxy: событие «открыл приложение» не трекается; знаменатель — все
      -- не удалённые, числитель — вышедшие из onboarding.
      'onboarding', (select jsonb_build_object(
          'total', count(*),
          'past_onboarding', count(*) filter (where lifecycle_state <> 'onboarding')) from base),
      'verification', (select jsonb_build_object(
          'submitted', count(*) filter (where verification_status in
            ('pending_review', 'needs_changes', 'approved', 'rejected', 'revoked')),
          'approved', count(*) filter (where verification_status = 'approved')) from base)
    ),
    'north_star', (select count(*) from ns_pairs)
  );
$$;
