-- Отказ от кандидата перестаёт быть приговором навсегда.
--
-- Как было. Нажатие «Сейчас не подходит» писало строку в match_views, и запрос
-- подбора исключал эту пару НАВСЕГДА, ничего не спрашивая. При нынешнем размере
-- это тупик, а не строгость: на 2026-08-25 в проде 25 опубликованных анкет, из
-- них 22 мужчины и 9 женщин. У мужчины весь запас кандидатов - максимум девять
-- человек, а дневной лимит отказов тридцать. Он мог исчерпать всю ленту за один
-- присест и остаться с пустым экраном навсегда.
--
-- Как стало. У отказа появляется причина и срок. Причина решает срок:
--
--   age           - не подходит по возрасту   -> навсегда, но это жалоба на
--                                                 ФИЛЬТР: приложение предлагает
--                                                 поправить рамки, и при правке
--                                                 такие отказы снимаются
--   geo           - не мой город              -> то же самое про гео
--   not_ready     - сейчас не до знакомств    -> месяц (это про себя, не про него)
--   not_my_type   - просто не моё             -> три месяца
--   profile_issue - что-то не так с анкетой   -> навсегда, сигнал модерации
--   dismissed     - закрыл шторку молча       -> месяц
--   never         - больше не показывать      -> навсегда, осознанный выбор
--
-- Пустой hidden_until значит «навсегда». Так читается прямее, чем дата в
-- далёком будущем, и не требует договариваться, какая дата считается «никогда».
--
-- Старые строки (отказы до этой правки) остаются с пустыми обеими колонками,
-- то есть скрытыми навсегда - прежнее поведение для них сохраняется. Задним
-- числом возвращать людей, от которых уже отказались, было бы сюрпризом.

alter table match_views
  add column if not exists reason text,
  add column if not exists hidden_until timestamptz;

-- Набор причин закреплён в базе, а не только в коде. Список обязан совпадать с
-- SKIP_REASONS в src/lib/matching/skip-reasons.ts - расхождение ловит тест
-- skip-reasons-vs-db.itest.ts. Без этого пара «код разрешает, база отвергает»
-- всплывает уже на живом человеке (так уже было с post_marriage_living).
alter table match_views
  drop constraint if exists match_views_reason_check;
alter table match_views
  add constraint match_views_reason_check
  check (
    reason is null
    or reason in ('age', 'geo', 'not_ready', 'not_my_type', 'profile_issue', 'dismissed', 'never')
  );

comment on column match_views.reason is
  'Почему отказался. null - отказ сделан до появления причин.';
comment on column match_views.hidden_until is
  'До какого момента кандидат скрыт. null - навсегда.';

-- Тело функции взято из живой базы (миграция 20260824130000) и изменено ровно в
-- одном месте: условие по match_views. Всё остальное - фильтры, лестница
-- ослабления, порядок отбора, набор колонок - не тронуто.
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
    -- ЕДИНСТВЕННОЕ изменение против прошлой версии: отказ теперь бывает срочным.
    -- Пустой hidden_until - скрыт навсегда (в том числе все отказы, сделанные
    -- до появления причин). Дата в прошлом - срок вышел, человек возвращается.
    and not exists (
      select 1 from match_views mv
       where mv.viewer_id = p_viewer
         and mv.target_id = c.id
         and (mv.hidden_until is null or mv.hidden_until > now())
    )
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
  order by
    (cp.city = v.city) desc,
    (cp.top_life_values && v.vals) desc,
    abs(date_part('year', age(cp.birth_date))::int - v.age) asc,
    c.id
  limit p_limit;
$function$;

-- Снять отказы, причина которых отпала.
--
-- «Не подходит по возрасту» и «не мой город» - это претензия к ФИЛЬТРУ, а не к
-- человеку. Если бы мы просто прятали кандидата навсегда, вышла бы ловушка:
-- человек поправил рамки, а лента осталась пустой, потому что все, кого он
-- отсеял по старым рамкам, скрыты насовсем. Поэтому при правке предпочтений
-- соответствующие отказы снимаются.
--
-- Трогаем ТОЛЬКО причины, которые действительно зависят от фильтра. Отказы
-- «просто не моё», «больше не показывать» и жалобы на анкету остаются на месте:
-- их правкой рамок не отменить, и возвращать таких людей было бы неуважением к
-- уже принятому решению.
create or replace function public.clear_filter_skips(p_viewer uuid, p_kinds text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from match_views mv
   where mv.viewer_id = p_viewer
     and mv.reason = any (p_kinds)
     and mv.reason in ('age', 'geo');
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.clear_filter_skips(uuid, text[]) is
  'Снимает отказы, вызванные фильтрами (age/geo), когда человек поправил соответствующее предпочтение.';
