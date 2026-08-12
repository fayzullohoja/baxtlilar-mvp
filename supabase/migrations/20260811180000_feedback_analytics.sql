-- Витрины по отзывам (Task 9 плана 2026-08-11-feedback). Схема analytics
-- существует только на проде (создана вручную вне supabase/migrations, см.
-- комментарий в 20260811130000_invite_analytics), поэтому create schema if not
-- exists - на проде безопасный no-op, локально создаёт пустую схему. Без него
-- интеграционный прогон scripts/test-db/run-integration-tests.sh, который
-- накатывает ВСЕ миграции подряд с ON_ERROR_STOP=1, упал бы на "schema
-- analytics does not exist" - и не на этой строке, а целиком.
create schema if not exists analytics;

-- ⛔ Текстов отзывов здесь НЕТ и быть не должно. Человек может написать в
-- отзыв что угодно, включая чужие имена и обстоятельства, а роль grafana_ro
-- шире круга модераторов: в Grafana есть Explore с произвольным SELECT по всей
-- схеме, то есть любой с доступом к дашборду прочитал бы тексты целиком.
-- Тексты читают только в /admin/feedback. По той же причине нет ни user_id, ни
-- пути к скриншоту - только признак "картинка была".
create or replace view analytics.v_feedback_daily as
select
  -- Граница суток прибита к Asia/Tashkent, а не к часовому поясу сессии. Голый
  -- date_trunc над timestamptz считает день по TimeZone клиента: на сервере с
  -- UTC отзыв, оставленный в 2 часа ночи по Ташкенту, уезжает во вчера и портит
  -- среднюю сразу за оба дня, а вечерне-ночная активность здесь не край, а
  -- основная масса. Хуже того, одна и та же витрина отдавала бы разные числа
  -- датасорсу Grafana и psql с VPS. Тот же приём и по той же причине - в
  -- 20260601200000_admin_demographics (окна регистраций) и в bump_quota.
  --
  -- К суточному лимиту отзывов это отношения НЕ имеет: там намеренно скользящее
  -- окно now() - 24 часа, а не календарный день, и тексты про лимит это окно
  -- честно описывают (гейт src/i18n/feedback-rate-limit-copy.test.ts). Здесь
  -- календарный день нужен только отчёту.
  (created_at at time zone 'Asia/Tashkent')::date as day,
  count(*)                            as feedback_count,
  round(avg(rating)::numeric, 2)      as avg_rating,
  count(*) filter (where screenshot_path is not null) as with_screenshot
from public.feedback
group by 1
order by 1 desc;

comment on view analytics.v_feedback_daily is
  'Отзывы по дням (сутки по Asia/Tashkent, а не по часовому поясу клиента): сколько, средняя оценка, сколько со скриншотом. Ни текстов, ни идентификаторов людей - роль grafana_ro шире круга модераторов, тексты читают в /admin/feedback.';

-- Распределение оценок: средняя скрывает поляризацию (две единицы и две
-- пятёрки дают ту же тройку, что четыре тройки), а решение «чинить или нет»
-- зависит именно от этого.
create or replace view analytics.v_feedback_ratings as
select rating, count(*) as feedback_count
from public.feedback
group by 1
order by 1;

comment on view analytics.v_feedback_ratings is
  'Распределение оценок 1-5. Нужно рядом со средней: средняя одинакова у ровных троек и у поляризации «или восторг, или отвращение», а чинить надо только второе.';

-- Права читателя Grafana. /usr/local/bin/baxtlilar-migrate пересдаёт их
-- автоматически после наката, но здесь - явно, на случай ручного применения.
-- Guard на существование роли: локально и в интеграционном прогоне grafana_ro
-- не заведена (роль - часть ручной настройки Grafana на проде, вне миграций),
-- и голый grant уронил бы весь прогон ошибкой "role grafana_ro does not exist".
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'grafana_ro') then
    grant usage on schema analytics to grafana_ro;
    grant select on analytics.v_feedback_daily, analytics.v_feedback_ratings to grafana_ro;
  end if;
end $$;
