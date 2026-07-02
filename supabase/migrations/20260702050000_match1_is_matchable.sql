-- MATCH-1 — единый предикат совместимости, зеркалит ядро get_recommendations.
--
-- Роут /api/interest проверял получателя только на lifecycle_state='active' +
-- block. Ни gender, ни возраст, ни verification_status='approved', ни
-- profile.status='published' не проверялись → верифицированный отправитель мог
-- послать интерес ЛЮБОМУ active-юзеру по UUID (из ссылки/старого фида/перебора),
-- минуя всю matchability (в т.ч. одному полу). is_matchable закрывает это как
-- guard перед process_interest (defense-in-depth, единый источник предикатов).

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
            between sp.partner_age_min and sp.partner_age_max
      and date_part('year', age(sp.birth_date))::int
            between rp.partner_age_min and rp.partner_age_max
  );
$$;
