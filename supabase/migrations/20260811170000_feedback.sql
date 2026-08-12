-- Отзывы о приложении (спека docs/superpowers/specs/2026-08-11-feedback-design.md).
-- К family-запуску нужен канал, по которому первые люди скажут, что не так:
-- сейчас отзывы тонут в чате поддержки вперемешку с вопросами и не считаются.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- Оценка обязательна и проверяется В БАЗЕ, а не только формой: форму можно
  -- обойти прямым запросом, и тогда в таблицу приедет 0 или 99, а средняя
  -- оценка в витрине станет бессмыслицей.
  rating smallint not null check (rating between 1 and 5),
  -- Текст необязателен. Длина ограничена здесь же по той же причине.
  body text check (body is null or char_length(body) <= 1000),
  screenshot_path text,
  locale text not null default 'ru',
  created_at timestamptz not null default now()
);

-- Список в админке отсортирован по свежести, а суточный лимит считает записи
-- одного человека за сутки - оба запроса покрывает эта пара индексов.
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists feedback_user_created_idx on public.feedback (user_id, created_at desc);

/**
 * Создание отзыва: лимит, дедуп и вставка в ОДНОЙ транзакции.
 *
 * Почему не тремя запросами из Node: два параллельных запроса (двойной тап,
 * две вкладки) оба увидели бы "2 из 3" и оба вставили бы - лимит обходится
 * без всякого злого умысла. Advisory-лок по пользователю выстраивает их в
 * очередь; лок транзакционный, снимается сам.
 *
 * Возвращает limited = true вместо ошибки, потому что превышение лимита -
 * ожидаемое состояние, а не сбой: роуту надо ответить человеку понятным
 * текстом, а не пятисоткой.
 *
 * Исходов ТРИ - вставили, дедуп, лимит - и каждый назван отдельным столбцом.
 * Пока дедуп отдавал ровно то же, что вставка, вызывающий не мог отличить
 * "записали ваш отзыв" от "вашу отправку отбросили, вот старая строка". Цену
 * этой неразличимости платит скриншот: файл кладётся в бакет ДО вызова, а ключ
 * дедупа - только человек, оценка и текст, скриншот в него не входит. Поэтому и
 * screenshot_stored: он говорит, доехал ли принесённый файл до записи. Без него
 * роут либо оставляет файл на диске без единого указателя в базе (сборщика
 * осиротевших файлов в проекте нет), либо сносит тот, на который база ссылается.
 *
 * В ветке дедупа скриншот ПРИКРЕПЛЯЕМ к найденной записи, если своего у неё
 * нет. Это не украшение: человек, отправивший отзыв без картинки и добавивший
 * её повторной отправкой в ту же минуту (сюда же - повтор после ответа
 * "скриншот приложить не удалось"), иначе теряет её молча. Уже прикреплённый
 * скриншот при этом не затираем: первый файл человека дороже второго, а второй
 * сносит роут, увидев screenshot_stored = false.
 *
 * security INVOKER, а не definer: функция не делает ничего, ради чего берут
 * права владельца - не отключает триггеров и не пишет в чужие схемы. С definer
 * она раздавала запись в public.feedback любому, кто может подключиться к базе:
 * рядом с приложением живёт роль только-на-чтение grafana_ro (витрины
 * analytics.* ходят в ту же базу), и ей прямой insert отбивался, а вызов
 * функции проходил - ровно мимо решения "тексты отзывов ей не показываем".
 *
 * pg_temp в search_path назван ЯВНО и последним. Если его не назвать, Postgres
 * ищет временную схему ПЕРВОЙ, и неквалифицированное имя feedback в теле
 * подменяется временной таблицей вызывающего: отзыв уходит в никуда, суточный
 * лимит обнуляется, а на definer тем же приёмом выполняется чужой код с правами
 * владельца. Та же пара граблей уже разбиралась у claim_export_window
 * (20260620920000) и admin_hard_delete_user (20260704060000).
 *
 * Имя объявлено БЕЗ схемы намеренно: гейт src/lib/db/set-returning-guard.test.ts
 * ищет определения функций по неквалифицированному имени, и схемо-квалифицированное
 * объявление делает set-returning функцию невидимой для него - а это ровно тот
 * класс бага (C-026/C-032), ради которого гейт написан. search_path у функции
 * зафиксирован строкой ниже, так что схема от префикса не зависит.
 */
-- Файл обязан накатываться на базу, где уже лежит его прежняя редакция с двумя
-- выходными столбцами: CREATE OR REPLACE менять тип результата не умеет и
-- отбивается "cannot change return type of existing function", а harness и CI
-- гоняют миграции с ON_ERROR_STOP - падает не одна строка, а весь прогон.
-- На чистой базе это пустая операция. Право EXECUTE у PUBLIC отзывается ниже
-- заново, так что дроп его не возвращает.
drop function if exists create_feedback(uuid, int, text, text, text);

create or replace function create_feedback(
  p_user_id uuid,
  p_rating int,
  p_body text,
  p_screenshot_path text,
  p_locale text
) returns table (feedback_id uuid, limited boolean, deduplicated boolean, screenshot_stored boolean)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_shot text := nullif(p_screenshot_path, '');
  v_count int;
  v_dup uuid;
  v_dup_shot text;
  v_attached boolean := false;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('feedback:' || p_user_id::text));

  -- Дедуп двойного тапа: тот же человек, та же оценка, тот же текст в
  -- пределах минуты - это одно нажатие, отправленное дважды, а не два
  -- отзыва. Возвращаем существующую запись, человек видит благодарность.
  select id, screenshot_path into v_dup, v_dup_shot
  from feedback
  where user_id = p_user_id
    and rating = p_rating
    and body is not distinct from v_body
    and created_at > now() - interval '1 minute'
  order by created_at desc
  limit 1;

  if v_dup is not null then
    -- Скриншота у найденной записи нет, а этот вызов его принёс - значит
    -- человек добавляет забытую картинку, а не жмёт кнопку второй раз.
    if v_shot is not null and v_dup_shot is null then
      update feedback set screenshot_path = v_shot where id = v_dup;
      v_attached := true;
    end if;
    return query select v_dup, false, true, v_attached;
    return;
  end if;

  select count(*) into v_count
  from feedback
  where user_id = p_user_id and created_at > now() - interval '24 hours';

  if v_count >= 3 then
    return query select null::uuid, true, false, false;
    return;
  end if;

  insert into feedback (user_id, rating, body, screenshot_path, locale)
  values (p_user_id, p_rating, v_body, v_shot, p_locale)
  returning id into v_id;

  return query select v_id, false, false, v_shot is not null;
end;
$$;

-- Пустой список прав у функции - это НЕ "никому не выдано", а дефолт "EXECUTE
-- есть у всех", поэтому право отзываем явно (тот же приём, что у
-- claim_export_window в 20260620900000). Одного security invoker хватило бы -
-- запись отбилась бы уже на правах таблицы - но вторая линия здесь дешёвая:
-- если функцию когда-нибудь снова сделают definer, дыра не откроется молча.
revoke all on function create_feedback(uuid, int, text, text, text) from public;
