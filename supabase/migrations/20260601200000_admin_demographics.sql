-- S5+: демография для админки — один RPC возвращает агрегаты по полу/возрасту/городу/статусам.
-- Считаем только не удалённых пользователей. Пол/возраст/город берём из user_profiles (есть после анкеты).
create or replace function get_admin_demographics()
returns jsonb
language sql
stable
as $$
  with prof as (
    select u.id,
           u.lifecycle_state,
           u.verification_status,
           u.created_at,
           p.gender,
           p.city,
           case when p.birth_date is not null then date_part('year', age(p.birth_date))::int end as age
    from users u
    left join user_profiles p on p.user_id = u.id
    where u.deleted_at is null
  )
  select jsonb_build_object(
    'total', (select count(*) from prof),
    'with_profile', (select count(*) from prof where gender is not null),
    'gender', jsonb_build_object(
        'm', (select count(*) from prof where gender = 'm'),
        'f', (select count(*) from prof where gender = 'f')
    ),
    'active_gender', jsonb_build_object(
        'm', (select count(*) from prof where gender = 'm' and lifecycle_state = 'active'),
        'f', (select count(*) from prof where gender = 'f' and lifecycle_state = 'active')
    ),
    'age_buckets', (
      -- каждый профиль с возрастом попадает ровно в один бакет (включая «до 18» для грязных данных);
      -- n = всего в бакете (в т.ч. с неуказанным полом), m/f — разбивка по полу.
      select coalesce(jsonb_agg(jsonb_build_object('bucket', b, 'm', mc, 'f', fc, 'n', n) order by srt), '[]'::jsonb)
      from (
        select case
                 when age < 18 then 'до 18'
                 when age between 18 and 24 then '18–24'
                 when age between 25 and 29 then '25–29'
                 when age between 30 and 34 then '30–34'
                 when age between 35 and 39 then '35–39'
                 else '40+'
               end as b,
               min(case
                     when age < 18 then 0
                     when age between 18 and 24 then 1
                     when age between 25 and 29 then 2
                     when age between 30 and 34 then 3
                     when age between 35 and 39 then 4
                     else 5
                   end) as srt,
               count(*) filter (where gender = 'm') as mc,
               count(*) filter (where gender = 'f') as fc,
               count(*) as n
        from prof
        where age is not null
        group by 1
      ) t
    ),
    'cities', (
      select coalesce(jsonb_agg(jsonb_build_object('city', city, 'm', mc, 'f', fc, 'n', n) order by n desc), '[]'::jsonb)
      from (
        select city,
               count(*) filter (where gender = 'm') as mc,
               count(*) filter (where gender = 'f') as fc,
               count(*) as n
        from prof
        where city is not null
        group by city
      ) c
    ),
    'lifecycle', (
      select coalesce(jsonb_object_agg(lifecycle_state::text, n), '{}'::jsonb)
      from (select lifecycle_state, count(*) as n from prof group by lifecycle_state) l
    ),
    'verification', (
      select coalesce(jsonb_object_agg(coalesce(verification_status::text, 'none'), n), '{}'::jsonb)
      from (select verification_status, count(*) as n from prof group by verification_status) v
    ),
    -- окна привязаны к местному времени Узбекистана (Asia/Tashkent, UTC+5), а не к UTC
    'reg_today', (select count(*) from prof where created_at >= date_trunc('day', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent'),
    'reg_7d', (select count(*) from prof where created_at >= (date_trunc('day', now() at time zone 'Asia/Tashkent') - interval '6 days') at time zone 'Asia/Tashkent'),
    'reg_30d', (select count(*) from prof where created_at >= (date_trunc('day', now() at time zone 'Asia/Tashkent') - interval '29 days') at time zone 'Asia/Tashkent')
  );
$$;
