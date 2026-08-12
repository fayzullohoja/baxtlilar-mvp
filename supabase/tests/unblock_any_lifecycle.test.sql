-- Отмена блокирующего отказа должна работать не только в онбординге
-- (фикс 2026-08-12, миграция 20260812140000_unblock_any_lifecycle.sql) и
-- обязана оставлять след модератору
-- (миграция 20260812150000_unblock_leaves_trace.sql).
--
-- Тупик, который чинили: по shadow-active человек проходит анкету и публикуется,
-- пока верификация ещё в очереди - lifecycle_state='active' при
-- verification_status='pending_review'. Модератор выносит блокирующий отказ
-- (гард admin_blocking_reject требует ровно pending_review, у такого человека он
-- и есть). Отмена ошибочного отказа возвращала
-- {"ok": false, "error": "wrong_lifecycle", "current": "active"} - вернуть
-- человека было нечем, кроме ручной правки в БД.
--
-- Проверяем случаи:
--   1. active + блокирующий отказ → отмена ПРОХОДИТ: verification_status снова
--      pending_review, lifecycle остаётся active, onboarding_step НЕ тронут,
--      заведён НОВЫЙ открытый кейс (старый закрыт решением модератора), чёрные
--      списки реально сняты, и в таймлайне нового кейса лежит след отменённого
--      решения.
--   2. onboarding на верификационном шаге → старое поведение цело: шаг
--      возвращается на moderation_pending.
--   3. paused → отмена ПРОХОДИТ, состояние паузы не тронуто. Третье из трёх
--      разрешённых состояний: без своего случая правка, вернувшая ему тупик,
--      прошла бы CI незамеченной.
--   4. blocked / pending_ban / deleted → отмена ОТКАЗЫВАЕТ, каждое своим
--      случаем: ось бана ведут admin_ban_* и /unban, воскрешать этой кнопкой
--      нельзя. Три состояния - три проверки, иначе выпадение любого из списка
--      мимо теста.
--   5. отказ НЕ блокирующий → по-прежнему отказ. Причём в ДВУХ видах:
--      reject_category = NULL (то, что реально производит технический отказ
--      модератора) и литерал 'technical' (легален по CHECK-констрейнту). Это
--      разные половины coalesce(reject_category, ''), и NULL - единственная,
--      которая доходит до гарда в проде.
--
-- Случаи 2-5 - регрессия: миграция 140000 трогает ровно один гард, 150000
-- добавляет ровно одну запись в case_events, всё остальное тело обязано вести
-- себя как прежде.
--
-- ПРО ЧЁРНЫЕ СПИСКИ. Фикстура намеренно заводит человека С телефоном и С двумя
-- хешами документов: без них admin_blocking_reject не пишет НИ ОДНОГО
-- тумбстоуна, и любая проверка очистки становится проверкой нуля против нуля.
-- Счётчики в ответе RPC - это count(*), то есть всегда >= 0, поэтому сверять их
-- «больше или равно нулю» бессмысленно: сверяем точные числа И отсутствие строк
-- в самих таблицах.
--
-- Тест транзакционный (rollback в конце) - ничего не коммитит.
-- Нарушение → RAISE EXCEPTION → psql -v ON_ERROR_STOP=1 падает (RED).

begin;

-- Хелпер-основание: человек с ПОЛНЫМ набором данных, по которым блокирующий
-- отказ пишет тумбстоуны (телефон + два хеша), доведённый до взятого в работу
-- кейса. Дальше вызывающий сам решает, какое решение выносит модератор.
--
-- Телефон и хеши выводим из p_tg: на user_documents висят частичные unique по
-- passport_sha256/selfie_sha256 для rejected+blocking, и общие литералы
-- столкнули бы фикстуры друг с другом внутри одной транзакции.
--
-- p_step / p_lifecycle - где человек находится В МОМЕНТ решения модератора: они
-- проставляются ПОСЛЕ создания кейса, ровно как это делает shadow-active.
create or replace function _ual_claimed_case(
  p_tg bigint,
  p_step onboarding_step,
  p_lifecycle lifecycle_state,
  out o_uid uuid,
  out o_adm uuid,
  out o_case_id uuid
) language plpgsql as $$
declare cid uuid; r jsonb;
begin
  insert into admin_users (login, role, password_hash)
    values ('t_ual_' || p_tg::text, 'superadmin', 'x') returning id into o_adm;

  insert into users (telegram_id, phone_number, verification_status, onboarding_step, lifecycle_state)
    values (p_tg, '+9989' || p_tg::text, 'liveness_uploaded', 'selfie_upload', 'onboarding')
    returning id into o_uid;

  -- selfie-submit: pending_review → VF-1 триггер заводит открытый кейс
  update users set verification_status = 'pending_review', onboarding_step = 'moderation_pending'
    where id = o_uid;
  select id into cid from verification_cases where user_id = o_uid and state <> 'closed';
  if cid is null then
    raise exception 'UNBLOCK-ANY: подготовка - не создан открытый кейс для tg %', p_tg;
  end if;
  o_case_id := cid;

  -- Человек уходит вперёд по shadow-active (или остаётся на месте - случай 2).
  update users set onboarding_step = p_step, lifecycle_state = p_lifecycle where id = o_uid;
  insert into user_documents (user_id, status, passport_sha256, selfie_sha256)
    values (o_uid, 'pending_review', 'sha-passport-' || p_tg::text, 'sha-selfie-' || p_tg::text);

  r := admin_claim_verification(cid, o_adm);
  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception 'UNBLOCK-ANY: подготовка - claim не прошёл: %', r::text;
  end if;
end$$;

-- Хелпер: довести человека до блокирующего отказа ровно тем путём, которым это
-- делает модератор - через кейс (admin_blocking_reject_case), а не сырым
-- вызовом admin_blocking_reject. Это важно для случая 1: решение по кейсу
-- ЗАКРЫВАЕТ кейс, поэтому появление открытого кейса после отмены доказуемо
-- является НОВЫМ кейсом, а не пережившим решение старым.
create or replace function _ual_blocking_reject(
  p_tg bigint,
  p_step onboarding_step,
  p_lifecycle lifecycle_state,
  out o_uid uuid,
  out o_adm uuid,
  out o_case_id uuid
) language plpgsql as $$
declare r jsonb;
begin
  select c.o_uid, c.o_adm, c.o_case_id into o_uid, o_adm, o_case_id
    from _ual_claimed_case(p_tg, p_step, p_lifecycle) c;

  -- admin_blocking_reject требует настроенный app.session_secret (phone-tombstone).
  perform set_config('app.session_secret', 'test-secret-for-unblock-any', true);
  r := admin_blocking_reject_case(o_case_id, o_adm, 'подозрение на подделку', 'fake',
                                  now() + interval '1 year');
  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception 'UNBLOCK-ANY: подготовка - blocking_reject_case не отработал: %', r::text;
  end if;
end$$;

-- Хелпер-проверка: сколько тумбстоунов лежит на человеке прямо сейчас.
-- Используется и ДО отмены (доказать, что фикстура реалистична и они вообще
-- есть), и ПОСЛЕ (доказать, что сняты). Без первой половины вторая ничего не
-- проверяет.
create or replace function _ual_assert_tombstones(
  p_uid uuid, p_phone int, p_sha int, p_where text
) returns void language plpgsql as $$
declare n_phone int; n_sha int;
begin
  select count(*) into n_phone from phone_blacklist
    where linked_user_id = p_uid and reason = 'verification_blocking_reject';
  select count(*) into n_sha from document_sha_blacklist
    where source_user_id = p_uid and reason = 'verification_blocking_reject';
  if n_phone <> p_phone or n_sha <> p_sha then
    raise exception '%: чёрные списки - телефон % (ожидался %), хеши % (ожидались %)',
      p_where, n_phone, p_phone, n_sha, p_sha;
  end if;
end$$;

-- Хелпер: отказ по забаненной/удалённой оси. Три состояния, одна проверка:
-- отмена обязана вернуть banned_lifecycle и НЕ тронуть ничего - ни статус, ни
-- очередь, ни чёрные списки.
create or replace function _ual_assert_refused(
  p_tg bigint, p_case text, p_apply text
) returns void language plpgsql as $$
declare uid uuid; adm uuid; r jsonb; upd timestamptz; ls text; vs text; n int;
begin
  select o_uid, o_adm into uid, adm from _ual_blocking_reject(p_tg, 'ready', 'active');

  -- Ось бана приходит ПОСЛЕ отказа - обычный порядок: сначала отказали, потом
  -- забанили/удалили. p_apply - сырой UPDATE, потому что нас интересует гард
  -- отмены, а не путь, которым человек попал в это состояние.
  execute format(p_apply, uid);

  select updated_at into upd from users where id = uid;
  r := admin_unblock_verification(uid, adm, upd);
  if coalesce((r->>'ok')::boolean, false) is not false then
    raise exception '%: ВОСКРЕШЁН отменой отказа по верификации: %', p_case, r::text;
  end if;
  if r->>'error' <> 'banned_lifecycle' then
    raise exception '%: код ошибки % (ожидался banned_lifecycle - отказ должен быть отличим)',
      p_case, r->>'error';
  end if;

  -- И ничего не поменялось: ни статус, ни очередь, ни чёрные списки.
  select lifecycle_state::text, verification_status::text into ls, vs from users where id = uid;
  if vs <> 'rejected' then
    raise exception '%: отказавший вызов всё равно сменил статус на % (lifecycle %)', p_case, vs, ls;
  end if;
  select count(*) into n from verification_cases where user_id = uid and state <> 'closed';
  if n <> 0 then
    raise exception '%: человек вернулся в очередь модератора - открытых кейсов %', p_case, n;
  end if;
  perform _ual_assert_tombstones(uid, 1, 2, p_case);
end$$;

do $$
declare
  r jsonb; st text; vs text; ls text; uid uuid; adm uuid; cid uuid; cid2 uuid;
  n int; upd timestamptz; case_upd timestamptz;
begin
  ---------------------------------------------------------------------------
  -- СЛУЧАЙ 1 - тупик, ради которого всё. Человек опубликовался (active), но
  -- верификация ещё шла и получила блокирующий отказ. Отмена обязана пройти.
  ---------------------------------------------------------------------------
  select o_uid, o_adm, o_case_id into uid, adm, cid
    from _ual_blocking_reject(990081401, 'ready', 'active');

  -- Подготовка привела ровно в то состояние, которое воспроизводит тупик.
  select lifecycle_state::text, verification_status::text, onboarding_step::text
    into ls, vs, st from users where id = uid;
  if ls <> 'active' or vs <> 'rejected' or st <> 'ready' then
    raise exception '1: ПОДГОТОВКА СЛОМАНА - lifecycle=% status=% step=% (ожидались active/rejected/ready)', ls, vs, st;
  end if;

  -- Решение модератора закрыло кейс: открытых нет. Именно поэтому появление
  -- открытого кейса ниже доказывает, что он НОВЫЙ.
  select count(*) into n from verification_cases where user_id = uid and state <> 'closed';
  if n <> 0 then
    raise exception '1: ПОДГОТОВКА СЛОМАНА - решение не закрыло кейс, открытых %', n;
  end if;

  -- Тумбстоуны на месте ДО отмены. Это не украшение: без этой проверки любая
  -- сверка очистки ниже превращается в ноль против ноля и пропускает поломку.
  perform _ual_assert_tombstones(uid, 1, 2, '1: ПОДГОТОВКА СЛОМАНА');

  select updated_at into upd from users where id = uid;
  r := admin_unblock_verification(uid, adm, upd);
  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception '1: ТУПИК - отмена блокирующего отказа отклонена для активного человека: %', r::text;
  end if;

  select lifecycle_state::text, verification_status::text, onboarding_step::text
    into ls, vs, st from users where id = uid;
  if vs <> 'pending_review' then
    raise exception '1: verification_status = % (ожидался pending_review)', vs;
  end if;
  if ls <> 'active' then
    raise exception '1: отмена сдвинула lifecycle_state в % (ожидался active - ось бана не наша)', ls;
  end if;
  if st <> 'ready' then
    raise exception '1: отмена выбросила человека из анкеты - шаг % (ожидался ready)', st;
  end if;

  -- В истории не должно быть записи о переходе шага, которого не было.
  select count(*) into n from user_state_transitions
    where user_id = uid and field = 'onboarding_step';
  if n <> 0 then
    raise exception '1: в историю записан несуществующий переход шага (% строк)', n;
  end if;

  -- Человек снова виден модератору: вход в pending_review завёл новый кейс.
  select count(*) into n from verification_cases where user_id = uid and state <> 'closed';
  if n <> 1 then
    raise exception '1: человек не вернулся в очередь - открытых кейсов % (ожидался 1)', n;
  end if;
  select id into cid2 from verification_cases where user_id = uid and state <> 'closed';
  if cid2 = cid then
    raise exception '1: переиспользован закрытый кейс % вместо нового', cid;
  end if;

  -- Чёрные списки СНЯТЫ - иначе человек не сможет перезалить документы, хотя
  -- кнопка обещает ровно обратное. Сверяем и точные числа в ответе RPC, и
  -- пустоту самих таблиц: ответ мог бы соврать, таблица - нет.
  if coalesce((r->>'phone_tombstone_cleared')::int, -1) <> 1 then
    raise exception '1: снято тумбстоунов телефона % (ожидался ровно 1): %',
      r->>'phone_tombstone_cleared', r::text;
  end if;
  if coalesce((r->>'sha_tombstones_cleared')::int, -1) <> 2 then
    raise exception '1: снято тумбстоунов по хешам % (ожидались ровно 2): %',
      r->>'sha_tombstones_cleared', r::text;
  end if;
  perform _ual_assert_tombstones(uid, 0, 0, '1: чёрные списки не сняты');

  -- След отменённого решения лежит в таймлайне НОВОГО кейса. Без него модератор
  -- открывает чистую заявку и штампует approve поверх подделки: карточка
  -- клиента с историей ему закрыта, а строку user_documents отмена обнулила.
  select count(*) into n from case_events
    where case_id = cid2
      and action = 'blocking_reject_revoked'
      and actor_id = adm
      and payload->>'revoked_reject_category' = 'blocking'
      and payload->>'revoked_reject_reason' = 'подозрение на подделку'
      and payload->>'prior_case_id' = cid::text;
  if n <> 1 then
    raise exception '1: в новом кейсе нет следа отменённого отказа (% подходящих событий) - решение принимается вслепую', n;
  end if;

  ---------------------------------------------------------------------------
  -- СЛУЧАЙ 2 - регрессия: до-анкетный человек на верификационном шаге. Ему
  -- возврат на moderation_pending осмыслен и обязан сохраниться, иначе экран
  -- /onboarding/pending для него недостижим.
  ---------------------------------------------------------------------------
  select o_uid, o_adm into uid, adm
    from _ual_blocking_reject(990081402, 'moderation_pending', 'onboarding');

  select onboarding_step::text into st from users where id = uid;
  if st <> 'verification_rejected' then
    raise exception '2: ПОДГОТОВКА СЛОМАНА - до-анкетному человеку blocking-reject не выставил verification_rejected (шаг %)', st;
  end if;

  select updated_at into upd from users where id = uid;
  r := admin_unblock_verification(uid, adm, upd);
  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception '2: отмена отклонена для онбординга - сломана старая дорога: %', r::text;
  end if;

  select lifecycle_state::text, verification_status::text, onboarding_step::text
    into ls, vs, st from users where id = uid;
  if st <> 'moderation_pending' then
    raise exception '2: onboarding_step = % (ожидался moderation_pending - до-анкетный путь сломан)', st;
  end if;
  if vs <> 'pending_review' then
    raise exception '2: verification_status = % (ожидался pending_review)', vs;
  end if;
  if ls <> 'onboarding' then
    raise exception '2: lifecycle_state = % (ожидался onboarding)', ls;
  end if;

  -- Шаг реально сменился - значит в истории строка про него быть ОБЯЗАНА,
  -- и с настоящим from_value, а не с литералом.
  select count(*) into n from user_state_transitions
    where user_id = uid and field = 'onboarding_step'
      and from_value = 'verification_rejected' and to_value = 'moderation_pending';
  if n <> 1 then
    raise exception '2: история перехода шага не записана (% подходящих строк)', n;
  end if;

  ---------------------------------------------------------------------------
  -- СЛУЧАЙ 3 - пауза. Третье из трёх состояний, которые миграция объявила
  -- разрешёнными (онбординг, активный, на паузе) и на которые смотрит предикат
  -- кнопки UNBLOCK_FORBIDDEN_LIFECYCLE в DangerZone.tsx. Без своего случая
  -- правка, вернувшая паузе тупик banned_lifecycle, прошла бы CI как есть.
  ---------------------------------------------------------------------------
  select o_uid, o_adm into uid, adm
    from _ual_blocking_reject(990081405, 'ready', 'paused');

  select updated_at into upd from users where id = uid;
  r := admin_unblock_verification(uid, adm, upd);
  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception '3: отмена отклонена человеку на паузе - тупик вернулся: %', r::text;
  end if;

  select lifecycle_state::text, verification_status::text into ls, vs from users where id = uid;
  if vs <> 'pending_review' then
    raise exception '3: verification_status = % (ожидался pending_review)', vs;
  end if;
  if ls <> 'paused' then
    raise exception '3: отмена сняла паузу - lifecycle_state = % (ожидался paused)', ls;
  end if;
  select count(*) into n from verification_cases where user_id = uid and state <> 'closed';
  if n <> 1 then
    raise exception '3: человек на паузе не вернулся в очередь - открытых кейсов %', n;
  end if;
  perform _ual_assert_tombstones(uid, 0, 0, '3: чёрные списки не сняты');

  ---------------------------------------------------------------------------
  -- СЛУЧАЙ 4 - ось бана. Три запрещённых состояния проверяем ПОРОЗНЬ: гард -
  -- это список, и выпадение любого элемента обязано валить тест. 'pending_ban'
  -- тут не формальность, а рабочая середина процедуры двух суперадминов:
  -- потеряй его гард - и отмена снимет чёрные списки и вернёт человека в
  -- очередь прямо посреди бана.
  ---------------------------------------------------------------------------
  perform _ual_assert_refused(990081403, '4a (blocked)',
    $q$update users set lifecycle_state = 'blocked', blocked_at = now(),
            blocked_reason = 'подделка документов' where id = %L$q$);

  -- pending_ban: users_pending_ban_consistency требует все три поля разом,
  -- users_no_both_block_and_pending - чтобы blocked_at при этом был пуст.
  perform _ual_assert_refused(990081406, '4b (pending_ban)',
    $q$update users u set lifecycle_state = 'pending_ban', pending_ban_at = now(),
            pending_ban_by_admin_id = (select id from admin_users
                                        where login = 't_ual_990081406'),
            pending_ban_reason = 'предложен бан' where u.id = %L$q$);

  -- deleted: человека уже нет, возвращать в очередь нечего. Отдельный случай
  -- нужен потому, что дублирующего заслона у него нет: мягкое удаление сносит
  -- user_documents и упёрлось бы в no_documents, но сюда человек может прийти
  -- и другим путём.
  perform _ual_assert_refused(990081407, '4c (deleted)',
    $q$update users set lifecycle_state = 'deleted', deleted_at = now() where id = %L$q$);

  ---------------------------------------------------------------------------
  -- СЛУЧАЙ 5 - отказ НЕ блокирующий. Откатывать нечего: технический отказ
  -- человек чинит сам через /retry и /fix, а чёрных списков по нему нет.
  --
  -- 5a - РЕАЛЬНЫЙ путь: admin_reject_verification с исходом
  -- 'rejected_technical' не трогает user_documents вообще, поэтому в проде до
  -- гарда доходит reject_category = NULL, а не строка. Это вторая половина
  -- coalesce(reject_category, ''), и без неё «естественное упрощение» гарда до
  -- `reject_category <> 'blocking'` выглядит безобидным: NULL <> 'blocking'
  -- даёт NULL, ветка не берётся, человеку с техническим отказом принудительно
  -- ставится pending_review и заводится призрачный кейс поверх НЕ перезалитых
  -- документов.
  ---------------------------------------------------------------------------
  select o_uid, o_adm, o_case_id into uid, adm, cid
    from _ual_claimed_case(990081404, 'ready', 'active');

  select updated_at into case_upd from verification_cases where id = cid;
  r := admin_reject_verification(cid, adm, 'rejected_technical', 'blurry',
                                 'Фото размыто', case_upd);
  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception '5a: ПОДГОТОВКА СЛОМАНА - технический отказ не прошёл: %', r::text;
  end if;

  -- Ровно то состояние, которое производит продукт: статус rejected, а в
  -- документах категория так и осталась пустой.
  select verification_status::text into vs from users where id = uid;
  select reject_category into st from user_documents where user_id = uid;
  if vs <> 'rejected' or st is not null then
    raise exception '5a: ПОДГОТОВКА СЛОМАНА - status=% reject_category=% (ожидались rejected/NULL)', vs, st;
  end if;

  select updated_at into upd from users where id = uid;
  r := admin_unblock_verification(uid, adm, upd);
  if coalesce((r->>'ok')::boolean, false) is not false then
    raise exception '5a: отменён технический отказ (reject_category IS NULL), хотя откатывать нечего: %', r::text;
  end if;
  if r->>'error' <> 'not_blocking' then
    raise exception '5a: код ошибки % (ожидался not_blocking)', r->>'error';
  end if;
  if r->>'current' is not null then
    raise exception '5a: current = % (у технического отказа категории нет вовсе)', r->>'current';
  end if;

  select verification_status::text into vs from users where id = uid;
  if vs <> 'rejected' then
    raise exception '5a: отказавший вызов всё равно сменил статус на %', vs;
  end if;

  -- 5b - литерал 'technical'. Продукт его сегодня не пишет (он живёт в
  -- CHECK-констрейнте и в payload аутбокса), но значение легально, и первая
  -- половина coalesce обязана его отсекать.
  insert into admin_users (login, role, password_hash)
    values ('t_ual_tech', 'superadmin', 'x') returning id into adm;
  insert into users (telegram_id, verification_status, onboarding_step, lifecycle_state)
    values (990081408, 'rejected', 'ready', 'active') returning id into uid;
  insert into user_documents (user_id, status, reject_category, reject_reason)
    values (uid, 'rejected', 'technical', 'Фото размыто');

  select updated_at into upd from users where id = uid;
  r := admin_unblock_verification(uid, adm, upd);
  if coalesce((r->>'ok')::boolean, false) is not false then
    raise exception '5b: отменён отказ с категорией technical: %', r::text;
  end if;
  if r->>'error' <> 'not_blocking' then
    raise exception '5b: код ошибки % (ожидался not_blocking)', r->>'error';
  end if;

  select verification_status::text into vs from users where id = uid;
  if vs <> 'rejected' then
    raise exception '5b: отказавший вызов всё равно сменил статус на %', vs;
  end if;

  raise notice 'UNBLOCK-ANY: активный откатывается со следом в кейсе (1), онбординг цел (2), пауза откатывается (3), бан/pending_ban/deleted держатся (4), технический отказ не трогаем ни NULL, ни строкой (5) OK';
end $$;

rollback;
