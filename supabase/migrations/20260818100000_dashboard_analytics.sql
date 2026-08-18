-- Витрины, ДОПОЛНЯЮЩИЕ уже существующую аналитику Baxtlilar
-- (shared/17. Baxtlilar/05. Мониторинг (Grafana)/). Состав панелей взят из
-- спеки, Чат 10 «Analytics - Метрики», разделы Executive dashboard и Safety
-- dashboard.
--
-- Почему витрины, а не запросы к public напрямую: роль grafana_ro имеет права
-- ТОЛЬКО на схему analytics (см. 20260811130000_invite_analytics и
-- 20260811180000_feedback_analytics). Дашборд, читающий public.users, на проде
-- упал бы с permission denied - и упал бы уже после импорта, когда это дороже
-- всего заметить. Плюс в Grafana есть Explore с произвольным SELECT по
-- доступной схеме: всё, что попало в analytics, считается видимым всем, у кого
-- есть дашборд, а это шире круга модераторов.
--
-- ⛔ Поэтому здесь только агрегаты. Ни telegram_id, ни телефонов, ни имён, ни
-- текстов жалоб, ни идентификаторов пользователей. Разбор конкретного человека
-- живёт в /admin, а не в Grafana.

-- ⚠️ Схема analytics на проде ведётся РУКАМИ, вне миграций (см. комментарий в
-- 20260811130000_invite_analytics). На 18.08.2026 там живут 24 витрины, снятые
-- через датасорс Grafana: v_summary, v_funnel, v_funnel_offpath, v_activity_daily,
-- v_match_funnel, v_match_requests_status, v_safety, v_verification_status,
-- v_verification_cases, v_profiles_status, v_photos_status, v_quiz, v_consents,
-- v_outbox_health, v_demographics_{gender,age,language,region}, v_invite*, v_feedback*.
--
-- Отсюда правило, которое стоило одной сломанной выкладки: ПЕРЕД добавлением
-- витрины сверься с этим списком на живой базе. Первая версия этой миграции
-- содержала свою v_funnel с другими колонками - create or replace view поверх
-- существующей падает с "cannot drop columns from view", а baxtlilar-migrate
-- идёт с остановкой на первой ошибке, то есть выкладка встала бы целиком.
--
-- Поэтому здесь ТОЛЬКО то, чего в тех 24 витринах нет: деньги, скорость
-- модерации в процентилях, качество общения в чатах, действующие санкции и
-- доля одобрения. Пользователи, воронка регистрации, демография, согласия,
-- очередь Telegram уже покрыты - дублировать их вредно: две витрины об одном
-- расходятся, и потом никто не знает, какой верить.
create schema if not exists analytics;

-- Границы суток везде прибиты к Asia/Tashkent по той же причине, что и в
-- v_feedback_daily: сервер живёт в UTC, и голый date_trunc уводит ночные
-- события во вчера, а вечер и ночь здесь - основная масса активности.

-- Доля одобренных считается от РЕШЁННЫХ дел, а не от всех: пока заявки висят в
-- очереди, знаменатель мал и процент скачет. Отдельной строкой - размер очереди,
-- чтобы было видно, на чём именно посчитано.
create or replace view analytics.v_verification_summary as
select
  count(*) filter (where verification_status = 'approved')                         as approved,
  count(*) filter (where verification_status in ('approved','rejected','revoked')) as decided,
  round(100.0 * count(*) filter (where verification_status = 'approved')
        / nullif(count(*) filter (where verification_status in ('approved','rejected','revoked')), 0), 1) as approve_rate_pct,
  count(*) filter (where verification_status = 'pending_review')                   as awaiting_review
from public.users where lifecycle_state <> 'deleted';

comment on view analytics.v_verification_summary is
  'Проверка личности: одобрено, решено всего, доля одобренных от решённых, ждут очереди. Доля от решённых, а не от всех - иначе метрика падает просто оттого, что заявок пришло много.';

-- Знакомства. Главная метрика продукта по спеке - безопасный взаимный интерес
-- между проверенными людьми, поэтому она здесь, а свайп-метрик нет намеренно.
--
-- Чаты считаются по фактическим сообщениям, а не по chats.last_message_at:
-- это поле проставляет приложение, и строить на нём метрику вслепую нельзя -
-- при живой переписке оно бывает пустым, и панель молча показывает ноль.
create or replace view analytics.v_matching_summary as
select
  (select count(*) from public.match_requests where status = 'accepted')::bigint as mutual_interests,
  (select count(*) from public.chats)::bigint                                    as chats_total,
  (select count(distinct chat_id) from public.chat_messages)::bigint             as chats_with_messages,
  round(100.0 * (select count(*) from public.chats)
        / nullif((select count(*) from public.match_requests where status = 'accepted'), 0), 1) as mutual_to_chat_pct,
  round(100.0 * (select count(distinct chat_id) from public.chat_messages)
        / nullif((select count(*) from public.chats), 0), 1)                     as first_message_pct,
  (select round(100.0 * count(*) filter (where senders >= 2) / nullif(count(*), 0), 1)
     from (select chat_id, count(distinct sender_id) as senders
             from public.chat_messages group by chat_id) t)                      as reply_pct;

comment on view analytics.v_matching_summary is
  'Взаимные интересы, чаты и доля отвеченных. «Ответили» - это чаты, где написали ОБА: один написал и тишина - ещё не знакомство. Чаты считаются по фактическим сообщениям, а не по chats.last_message_at (поле заполняет приложение, на нём метрику строить нельзя).';

-- Безопасность. Доли считаются от активных пользователей: от всех
-- зарегистрированных они размывались бы теми, кто не дошёл до общения.
create or replace view analytics.v_safety_summary as
select
  (select count(*) from public.reports)::bigint                    as reports_total,
  (select count(distinct reporter_id) from public.reports)::bigint as reporters,
  (select count(distinct blocker_id) from public.blocks)::bigint   as blockers,
  round(100.0 * (select count(distinct reporter_id) from public.reports)
        / nullif((select count(*) from public.users where lifecycle_state = 'active'), 0), 2) as complaint_rate_pct,
  round(100.0 * (select count(distinct blocker_id) from public.blocks)
        / nullif((select count(*) from public.users where lifecycle_state = 'active'), 0), 2) as block_rate_pct,
  (select count(*) from (select target_user_id from public.reports
                          group by target_user_id having count(*) >= 2) t)::bigint as repeat_offenders;

comment on view analytics.v_safety_summary is
  'Жалобы и блокировки в долях от активных пользователей, плюс повторные нарушители (на кого пожаловались двое и больше). Без идентификаторов и текстов: кто именно - разбирают в /admin, роль grafana_ro шире круга модераторов.';

create or replace view analytics.v_sanctions as
select sanction_level::text as sanction, count(*)::bigint as users
from public.users where sanction_level <> 'none'
group by 1 order by 2 desc;

comment on view analytics.v_sanctions is 'Действующие санкции по уровням. Пустая витрина - нормальное состояние, а не поломка.';

-- Модерация: сколько ждёт и как долго решают. Человек ждёт ответа по своим
-- документам - это его первое впечатление о продукте, поэтому SLA здесь, а не
-- в технических метриках.
create or replace view analytics.v_moderation_summary as
select
  count(*) filter (where state <> 'closed')::bigint as queue_open,
  round(avg(extract(epoch from (decided_at - created_at)) / 3600)
        filter (where decided_at is not null)::numeric, 1) as avg_decision_hours,
  round((percentile_cont(0.9) within group (order by extract(epoch from (decided_at - created_at)) / 3600)
         filter (where decided_at is not null))::numeric, 1) as p90_decision_hours
from public.verification_cases;

comment on view analytics.v_moderation_summary is
  'Очередь верификации и скорость решений: среднее и 90-й процентиль в часах. Процентиль рядом со средним нужен потому, что среднее прячет хвост - десять быстрых решений скрывают одного человека, ждущего третьи сутки.';

-- Деньги. Пока платежей нет, витрина честно отдаёт нули - это не поломка.
create or replace view analytics.v_money_summary as
select
  (select count(distinct user_id) from public.subscriptions where status = 'active')::bigint as paying_users,
  round(100.0 * (select count(distinct user_id) from public.subscriptions where status = 'active')
        / nullif((select count(*) from public.users where lifecycle_state = 'active'), 0), 2) as premium_conversion_pct,
  (select coalesce(sum(amount), 0) from public.payment_sessions where status = 'paid')::bigint as revenue_total,
  (select round(100.0 * count(*) filter (where status = 'paid') / nullif(count(*), 0), 1)
     from public.payment_sessions)                                                             as payment_success_pct;

comment on view analytics.v_money_summary is
  'Платящие, конверсия, выручка (в сумах) и доля успешных оплат. Низкая доля успешных - проблема платёжного провайдера, а не спроса: это разные выводы и разные действия.';

-- Права читателя Grafana. Guard на существование роли - как в соседних
-- миграциях: локально и в интеграционном прогоне grafana_ro не заведена (роль
-- создаётся руками при настройке Grafana на проде, вне миграций), и голый
-- grant уронил бы весь прогон ошибкой "role grafana_ro does not exist".
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'grafana_ro') then
    grant usage on schema analytics to grafana_ro;
    grant select on
      analytics.v_verification_summary, analytics.v_matching_summary,
      analytics.v_safety_summary, analytics.v_sanctions,
      analytics.v_moderation_summary, analytics.v_money_summary
      to grafana_ro;
  end if;
end $$;
