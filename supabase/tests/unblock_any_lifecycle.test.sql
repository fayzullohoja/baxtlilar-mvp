-- Отмена блокирующего отказа должна работать не только в онбординге
-- (фикс 2026-08-12, миграция 20260812140000_unblock_any_lifecycle.sql).
--
-- Тупик, который чиним: по shadow-active человек проходит анкету и публикуется,
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
--      заведён НОВЫЙ открытый кейс (старый закрыт решением модератора).
--   2. onboarding на верификационном шаге → старое поведение цело: шаг
--      возвращается на moderation_pending.
--   3. blocked → отмена ОТКАЗЫВАЕТ: ось бана ведут admin_ban_* и /unban,
--      воскрешать забаненного этой кнопкой нельзя.
--   4. отказ НЕ блокирующий (reject_category <> 'blocking') → по-прежнему отказ:
--      откатывать нечего, для технического отказа есть /retry и /fix.
--
-- Случаи 2-4 - регрессия: миграция трогает ровно один гард, всё остальное тело
-- обязано вести себя как прежде.
--
-- Тест транзакционный (rollback в конце) - ничего не коммитит.
-- Нарушение → RAISE EXCEPTION → psql -v ON_ERROR_STOP=1 падает (RED).

begin;

-- Хелпер: довести человека до блокирующего отказа ровно тем путём, которым это
-- делает модератор - через кейс (admin_blocking_reject_case), а не сырым
-- вызовом admin_blocking_reject. Это важно для случая 1: решение по кейсу
-- ЗАКРЫВАЕТ кейс, поэтому появление открытого кейса после отмены доказуемо
-- является НОВЫМ кейсом, а не пережившим решение старым.
--
-- p_step / p_lifecycle - где человек находится В МОМЕНТ решения модератора: они
-- проставляются ПОСЛЕ создания кейса, ровно как это делает shadow-active.
create or replace function _ual_blocking_reject(
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

  insert into users (telegram_id, verification_status, onboarding_step, lifecycle_state)
    values (p_tg, 'liveness_uploaded', 'selfie_upload', 'onboarding') returning id into o_uid;

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
  insert into user_documents (user_id, status) values (o_uid, 'pending_review');

  r := admin_claim_verification(cid, o_adm);
  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception 'UNBLOCK-ANY: подготовка - claim не прошёл: %', r::text;
  end if;

  -- admin_blocking_reject требует настроенный app.session_secret (phone-tombstone).
  perform set_config('app.session_secret', 'test-secret-for-unblock-any', true);
  r := admin_blocking_reject_case(cid, o_adm, 'подозрение на подделку', 'fake',
                                  now() + interval '1 year');
  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception 'UNBLOCK-ANY: подготовка - blocking_reject_case не отработал: %', r::text;
  end if;
end$$;

do $$
declare
  r jsonb; st text; vs text; ls text; uid uuid; adm uuid; cid uuid; cid2 uuid;
  n int; upd timestamptz;
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

  -- Чёрные списки сняты - иначе человек не сможет перезалить документы.
  if coalesce((r->>'phone_tombstone_cleared')::int, -1) < 0
     or coalesce((r->>'sha_tombstones_cleared')::int, -1) < 0 then
    raise exception '1: RPC не отчитался об очистке чёрных списков: %', r::text;
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
  -- СЛУЧАЙ 3 - забаненного не воскрешаем. Бан ставят два суперадмина, снимать
  -- его отменой отказа по верификации - тихий обход процедуры.
  ---------------------------------------------------------------------------
  select o_uid, o_adm into uid, adm
    from _ual_blocking_reject(990081403, 'ready', 'active');

  -- Бан приходит после отказа - обычный порядок: сначала отказали, потом забанили.
  update users set lifecycle_state = 'blocked', blocked_at = now(),
                   blocked_reason = 'подделка документов'
    where id = uid;

  select updated_at into upd from users where id = uid;
  r := admin_unblock_verification(uid, adm, upd);
  if coalesce((r->>'ok')::boolean, false) is not false then
    raise exception '3: ЗАБАНЕННЫЙ ВОСКРЕШЁН отменой отказа по верификации: %', r::text;
  end if;
  if r->>'error' <> 'banned_lifecycle' then
    raise exception '3: код ошибки % (ожидался banned_lifecycle - отказ должен быть отличим)', r->>'error';
  end if;

  -- И ничего не поменялось: ни статус, ни чёрные списки, ни очередь.
  select lifecycle_state::text, verification_status::text into ls, vs from users where id = uid;
  if ls <> 'blocked' or vs <> 'rejected' then
    raise exception '3: отказавший вызов всё равно что-то изменил - lifecycle=% status=%', ls, vs;
  end if;
  select count(*) into n from verification_cases where user_id = uid and state <> 'closed';
  if n <> 0 then
    raise exception '3: забаненный вернулся в очередь модератора - открытых кейсов %', n;
  end if;

  ---------------------------------------------------------------------------
  -- СЛУЧАЙ 4 - отказ НЕ блокирующий. Откатывать нечего: технический отказ
  -- человек чинит сам через /retry и /fix, а чёрных списков по нему нет.
  ---------------------------------------------------------------------------
  insert into admin_users (login, role, password_hash)
    values ('t_ual_tech', 'superadmin', 'x') returning id into adm;
  insert into users (telegram_id, verification_status, onboarding_step, lifecycle_state)
    values (990081404, 'rejected', 'ready', 'active') returning id into uid;
  insert into user_documents (user_id, status, reject_category, reject_reason)
    values (uid, 'rejected', 'technical', 'Фото размыто');

  select updated_at into upd from users where id = uid;
  r := admin_unblock_verification(uid, adm, upd);
  if coalesce((r->>'ok')::boolean, false) is not false then
    raise exception '4: отменён технический отказ, хотя откатывать нечего: %', r::text;
  end if;
  if r->>'error' <> 'not_blocking' then
    raise exception '4: код ошибки % (ожидался not_blocking)', r->>'error';
  end if;

  select verification_status::text into vs from users where id = uid;
  if vs <> 'rejected' then
    raise exception '4: отказавший вызов всё равно сменил статус на %', vs;
  end if;

  raise notice 'UNBLOCK-ANY: активный откатывается (1), онбординг цел (2), бан держится (3), технический отказ не трогаем (4) OK';
end $$;

rollback;
