-- Витрины аналитики по кодам-приглашениям (Task 11, финальная задача плана
-- 2026-08-11-invite-codes). Владельцу нужен ответ на один вопрос: открывать
-- вход всем или ещё рано - витрины ниже дают на него данные.
--
-- Схема analytics существует ТОЛЬКО на проде - создана вручную вне
-- supabase/migrations (см. комментарий в миграции 20260811120000 про
-- analytics.funnel_steps). Локальный/интеграционный прогон
-- (scripts/test-db/run-integration-tests.sh) поднимает ваниль-Postgres и
-- накатывает ВСЕ миграции подряд с ON_ERROR_STOP=1 - без явного создания
-- схемы здесь "create view analytics.v_..." упал бы с "schema analytics
-- does not exist" и уронил бы весь прогон. create schema if not exists на
-- проде - безопасный no-op (схема уже есть, ничего не пересоздаёт и не
-- меняет владельца), локально - создаёт пустую схему, в которую тут же
-- лягут витрины ниже.
create schema if not exists analytics;

-- ⛔ Про сам код в analytics.v_invites: код - секрет, дающий вход в закрытый
-- запуск (см. invite_codes в миграции 20260811120000). Роль grafana_ro шире
-- по составу людей, чем админка /admin/invites (там код целиком уже
-- показывается - см. load-invites.ts, это осознанно, инструмент модератора):
-- у Grafana есть Explore с произвольным SELECT по всей схеме, значит любой
-- с доступом к дашборду увидел бы код целиком, если бы мы его сюда положили.
-- Хуже: кулдаун на приём кода в боте ПЕРСОНАЛЬНЫЙ (per-user, Task 7), а не
-- глобальный - многоаккаунтный перебор уже отмечен в ходе плана как
-- непокрытый риск. Даже частичный показ (например 2 из 6 символов) сокращает
-- пространство перебора в 31^2 (~961) раз - заметное облегчение подбора
-- именно для этого нерешённого риска. Поэтому колонка кода - не фрагмент
-- секрета, а анонимный порядковый номер внутри своего типа (мастер/личный)
-- по дате выпуска: ноль информации о самом коде, но строки различимы, чтобы
-- увидеть распределение.
--
-- По той же причине НЕТ колонки label ("подпись мастер-кода"): это
-- свободный текст, который админ вписывает руками в форме "Зачем он" -
-- ничто не запрещает вписать туда имя человека или телефон (createMasterCode
-- в src/lib/invite/store.ts принимает любую непустую строку). Показывать
-- машинный секрет замаскированным, а рядом - открытый human-input без формата,
-- было бы непоследовательно: правило задачи "ни имён, ни идентификаторов
-- конкретных людей" должно держаться тем, что видно РОЛИ, а не тем, что
-- вписал оператор в спешке. Кто выпустил и зачем - смотрят в /admin/invites.
create or replace view analytics.v_invites as
select
  case when c.owner_id is null then 'мастер-код' else 'личный' end        as "тип",
  row_number() over (
    partition by (c.owner_id is null) order by c.created_at
  )                                                                        as "номер",
  (select count(*) from users u
    where u.invite_code_id = c.id and u.deleted_at is null)                as "привёл",
  (c.disabled_at is not null)                                             as "погашен",
  c.created_at::date                                                      as "выпущен"
from invite_codes c
order by "привёл" desc;

comment on view analytics.v_invites is
  'Коды-приглашения и сколько каждый привёл. Ни код, ни подпись мастер-кода не показываются (секрет входа / нефильтрованный human-input, роль grafana_ro шире админки) - строки различимы анонимным номером по типу и дате выпуска.';

-- Сводка по источникам входа: сколько вошло до запуска шлагбаума, сколько по
-- личному коду, сколько по мастер-коду, и сколько ещё не прошли ни один путь.
-- Отвечает на "открывать вход всем или ещё рано" одним взглядом на пропорции.
--
-- Бакеты СДЕЛАНЫ ВЗАИМОИСКЛЮЧАЮЩИМИ через "not invite_exempt" в фильтрах
-- личного/мастер-кода - без этого условия сумма НЕ равна "всего" (см. память
-- baxtlilar-grafana-analytics: "первая версия витрины смешала множества и
-- выдала 107%" - тот же класс ошибки, наступаем на него снова без guard'а).
-- Причина реального пересечения множеств - НЕ гипотетическая: handlers.ts
-- (handleStart, "if (payload && !user.invite_redeemed_at)") зовёт redeemCode
-- по /start-пейлоаду БЕЗ проверки invite_exempt. Человек, вошедший ДО запуска
-- (invite_exempt=true), может позже открыть чужую invite-ссылку - redeemCode
-- (gate.ts) охраняет UPDATE только условием ".is(invite_redeemed_at, null)",
-- тоже без учёта exempt - и получает invite_redeemed_at, оставаясь exempt.
-- Такой человек НЕ должен засчитываться как "пришедший по коду" (он и так
-- вошёл бы без него) - фильтр "not invite_exempt" явно отдаёт приоритет
-- exempt-статусу и не даёт этому случаю задвоить цифры.
--
-- "ещё без кода" - явный остаток (не invite_exempt и код ещё не введён):
-- люди в процессе онбординга ДО шага ввода кода, и те, кто зарегистрировался
-- в окне, когда рубильник invite_gate был выключен. Без этой колонки сумма
-- трёх "положительных" бакетов может быть меньше "всего", и разницу владелец
-- увидит только руками вычитая - для решения "открывать или рано" именно
-- этот непроходящий остаток может быть самым важным числом.
create or replace view analytics.v_invite_summary as
select
  count(*)                                                                          as "всего",
  count(*) filter (where invite_exempt)                                            as "вошли до запуска",
  count(*) filter (where not invite_exempt and invite_redeemed_at is not null
                     and invited_by is not null)                                    as "вошли по личному коду",
  count(*) filter (where not invite_exempt and invite_redeemed_at is not null
                     and invited_by is null)                                        as "вошли по мастер-коду",
  count(*) filter (where not invite_exempt and invite_redeemed_at is null)          as "ещё без кода"
from users
where deleted_at is null;

comment on view analytics.v_invite_summary is
  'Сводка по источникам входа: всего / до запуска / по личному коду / по мастер-коду / ещё без кода. Бакеты взаимоисключающие и в сумме дают "всего" - см. комментарий в миграции про exempt-пересечение.';

-- Распределение "сколько человек привёл один личный код" - показывает,
-- концентрирован ли рост на нескольких супер-инвайтерах или размазан ровно
-- по всем. Мастер-код намеренно исключён: его объём - решение оператора
-- (сколько офлайн-встреч провели), а не органическая вирусность людей.
create or replace view analytics.v_invite_distribution as
select
  invited_count                                                           as "число приглашённых",
  count(*)                                                                 as "число кодов"
from (
  select c.id,
    (select count(*) from users u
      where u.invite_code_id = c.id and u.deleted_at is null)              as invited_count
  from invite_codes c
  where c.owner_id is not null
) t
group by invited_count
order by invited_count;

comment on view analytics.v_invite_distribution is
  'Гистограмма "сколько человек привёл один личный код" - виден размах: рост размазан или держится на нескольких людях. Мастер-код не входит.';

-- Динамика по дням: сколько зарегистрировалось всего и по каждому источнику.
-- Для решения "открывать сейчас или подождать" тренд важнее одной цифры -
-- плато или ускорение видно только в динамике, не в сумме за всё время.
--
-- "not invite_exempt" в фильтрах личного/мастер-кода - тот же guard и по той
-- же причине, что в v_invite_summary выше (exempt-пользователь может задним
-- числом получить invite_redeemed_at через /start-ссылку без сброса exempt).
create or replace view analytics.v_invite_daily as
select
  date_trunc('day', created_at)::date                                                as "день",
  count(*)                                                                           as "всего",
  count(*) filter (where invite_exempt)                                              as "до запуска",
  count(*) filter (where not invite_exempt and invite_redeemed_at is not null
                     and invited_by is not null)                                     as "по личному коду",
  count(*) filter (where not invite_exempt and invite_redeemed_at is not null
                     and invited_by is null)                                         as "по мастер-коду"
from users
where deleted_at is null
group by 1
order by 1;

comment on view analytics.v_invite_daily is
  'Регистрации по дням, разбиты по источнику входа - тренд для решения "открывать вход или ещё рано".';

-- Права читателя Grafana. /usr/local/bin/baxtlilar-migrate пересдаёт их
-- автоматически после наката (см. память baxtlilar-grafana-analytics), но
-- здесь - явно, на случай ручного применения (psql < file). Guard на
-- существование роли: локально и в интеграционных тестах grafana_ro не
-- заведена (роль - часть ручной настройки Grafana на проде, вне миграций) -
-- без проверки голый GRANT уронил бы прогон ошибкой "role grafana_ro does
-- not exist", как и остальные миграции этого плана берегут локальный прогон
-- через to_regclass/аналогичные guard'ы.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'grafana_ro') then
    grant select on all tables in schema analytics to grafana_ro;
  end if;
end $$;
