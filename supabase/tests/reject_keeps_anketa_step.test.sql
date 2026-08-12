-- Решение модератора не должно выбрасывать человека из анкеты (фикс 2026-08-12,
-- миграция 20260812120000_reject_keeps_anketa_step.sql).
--
-- Прод-сценарий, юзер 39ede142-fb39-4a23-b639-fb3ed193f706: по shadow-active он
-- ушёл из moderation_pending в анкету, заполнял profile_lifestyle, модератор
-- нажал needs_changes - и сырой UPDATE в RPC подменил ему onboarding_step.
-- Следующий POST /api/onboarding/profile/lifestyle получил 409 wrong_step, и так
-- пять раз подряд: человек потерял заполненное и прошёл все 11 шагов заново.
--
-- Проверяем случаи:
--   A. в анкете (profile_lifestyle) + needs_changes → шаг СОХРАНЁН, меняется
--      только verification_status;
--   B. на moderation_pending + needs_changes → шаг СТАНОВИТСЯ needs_changes
--      (старое поведение до-анкетного человека не сломано);
--   C. в анкете (profile_finance) + rejected_technical → шаг СОХРАНЁН, статус
--      становится rejected (та же нелегальная запись 'verification_rejected').
--   D. ОБРАТНАЯ ДОРОГА после A: человек перезаливает документы, не двигая шаг, →
--      снова открытый кейс у модератора. Без этого случая тест «зелёный», а
--      человек заперт навсегда: сохранить шаг анкеты мало, надо ещё уметь
--      вернуться в очередь (дефект 12.08.2026 - см. 20260812130000).
--   E. admin_blocking_reject из анкеты → шаг СОХРАНЁН и в историю НЕ пишется
--      строка о переходе шага, которого не было (вторая ветка решения модератора).
--   F. ОБРАТНАЯ ДОРОГА после технического отказа: rejected → pending_review
--      разрешён графом C-094 (ребро добавлено в 20260812130000).
--
-- Тест транзакционный (rollback в конце) - ничего не коммитит.
-- Нарушение → RAISE EXCEPTION → psql -v ON_ERROR_STOP=1 падает (RED).

begin;

-- Хелпер: довести человека до открытого кейса, забрать кейс модератором и
-- вынести решение. Возвращает решение RPC.
-- p_step - шаг, на котором человек находится В МОМЕНТ решения модератора: он
-- проставляется ПОСЛЕ создания кейса, ровно как это делает shadow-active.
create or replace function _rk_decide(
  p_tg bigint,
  p_step onboarding_step,
  p_outcome text,
  out o_result jsonb,
  out o_step text,
  out o_status text,
  out o_uid uuid,
  out o_case_id uuid
) language plpgsql as $$
declare
  uid uuid; adm uuid; cid uuid; upd timestamptz; r jsonb;
begin
  insert into admin_users (login, role, password_hash)
    values ('t_rk_' || p_tg::text, 'moderator', 'x') returning id into adm;

  insert into users (telegram_id, verification_status, onboarding_step, lifecycle_state)
    values (p_tg, 'liveness_uploaded', 'selfie_upload', 'onboarding') returning id into uid;

  -- selfie-submit: pending_review → VF-1 триггер заводит открытый кейс
  update users set verification_status = 'pending_review', onboarding_step = 'moderation_pending'
    where id = uid;
  select id into cid from verification_cases where user_id = uid and state <> 'closed';
  if cid is null then
    raise exception 'REJECT-STEP: не создан открытый кейс для tg %', p_tg;
  end if;

  -- Человек уходит вперёд по shadow-active (или остаётся на месте - см. случай B).
  -- lifecycle_state остаётся 'onboarding': в 'active' он попадёт только на шаге
  -- 'ready', и именно поэтому старое условие про lifecycle его не защищало.
  update users set onboarding_step = p_step where id = uid;

  r := admin_claim_verification(cid, adm);
  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception 'REJECT-STEP: claim не прошёл: %', r::text;
  end if;

  -- optimistic-токен читаем ПОСЛЕ claim: claim двигает verification_cases.updated_at
  select updated_at into upd from verification_cases where id = cid;

  o_result := admin_reject_verification(cid, adm, p_outcome, 'blurry_photo', 'Фото размыто', upd);
  select onboarding_step::text, verification_status::text
    into o_step, o_status from users where id = uid;
  o_uid := uid;
  o_case_id := cid;
end$$;

-- Хелпер обратной дороги: повторяет ровно то, что делает /api/onboarding/fix для
-- человека ВНЕ верификационных шагов - патчит один verification_status через
-- transition_user, не трогая onboarding_step.
create or replace function _rk_resubmit(p_uid uuid) returns jsonb
language plpgsql as $$
declare upd timestamptz;
begin
  select updated_at into upd from users where id = p_uid;
  return transition_user(p_uid, jsonb_build_object('verification_status', 'pending_review'),
                         upd, 're-submitted documents for verification', 'user', p_uid::text);
end$$;

do $$
declare r jsonb; st text; vs text; uid uuid; cid uuid; cid2 uuid; n int; adm uuid; upd timestamptz;
begin
  ---------------------------------------------------------------------------
  -- СЛУЧАЙ A - прод-сценарий: человек в анкете, модератор жмёт needs_changes.
  -- Шаг обязан остаться profile_lifestyle, иначе сохранение анкеты уйдёт в 409.
  ---------------------------------------------------------------------------
  select o_result, o_step, o_status, o_uid, o_case_id into r, st, vs, uid, cid
    from _rk_decide(990081201, 'profile_lifestyle', 'needs_changes');

  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception 'A: RPC не отработал: %', r::text;
  end if;
  if st <> 'profile_lifestyle' then
    raise exception 'A: человека выбросило из анкеты - onboarding_step = % (ожидался profile_lifestyle)', st;
  end if;
  if vs <> 'needs_changes' then
    raise exception 'A: verification_status = % (ожидался needs_changes)', vs;
  end if;

  ---------------------------------------------------------------------------
  -- СЛУЧАЙ B - регрессия: до-анкетный человек, старое поведение сохранено.
  -- Он ещё на moderation_pending, переход в needs_changes легален по графу,
  -- и без него экран /onboarding/needs-changes для него недостижим.
  ---------------------------------------------------------------------------
  select o_result, o_step, o_status into r, st, vs
    from _rk_decide(990081202, 'moderation_pending', 'needs_changes');

  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception 'B: RPC не отработал: %', r::text;
  end if;
  if st <> 'needs_changes' then
    raise exception 'B: onboarding_step = % (ожидался needs_changes - до-анкетный путь сломан)', st;
  end if;
  if vs <> 'needs_changes' then
    raise exception 'B: verification_status = % (ожидался needs_changes)', vs;
  end if;

  ---------------------------------------------------------------------------
  -- СЛУЧАЙ C - тот же запрет для технического отказа: из анкеты нельзя писать
  -- 'verification_rejected'. Статус при этом обязан стать rejected.
  ---------------------------------------------------------------------------
  select o_result, o_step, o_status into r, st, vs
    from _rk_decide(990081203, 'profile_finance', 'rejected_technical');

  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception 'C: RPC не отработал: %', r::text;
  end if;
  if st <> 'profile_finance' then
    raise exception 'C: человека выбросило из анкеты - onboarding_step = % (ожидался profile_finance)', st;
  end if;
  if vs <> 'rejected' then
    raise exception 'C: verification_status = % (ожидался rejected)', vs;
  end if;

  ---------------------------------------------------------------------------
  -- СЛУЧАЙ D - ОБРАТНАЯ ДОРОГА (то, чего не проверяла первая редакция теста).
  -- Человек из случая A перезаливает документы: /api/onboarding/fix патчит ему
  -- ОДИН verification_status, шаг анкеты не трогает. Он обязан снова оказаться
  -- в очереди модератора, иначе решение needs_changes необратимо.
  ---------------------------------------------------------------------------
  select count(*) into n from verification_cases where user_id = uid and state <> 'closed';
  if n <> 0 then
    raise exception 'D: перед перезаливкой открытых кейсов % (ожидался 0 - решение закрывает кейс)', n;
  end if;

  r := _rk_resubmit(uid);
  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception 'D: transition_user отклонил needs_changes → pending_review: %', r::text;
  end if;

  select onboarding_step::text, verification_status::text into st, vs from users where id = uid;
  if st <> 'profile_lifestyle' then
    raise exception 'D: перезаливка сдвинула шаг анкеты в % - вернулся исходный баг', st;
  end if;
  if vs <> 'pending_review' then
    raise exception 'D: verification_status = % (ожидался pending_review)', vs;
  end if;

  select count(*) into n from verification_cases where user_id = uid and state <> 'closed';
  select id into cid2 from verification_cases where user_id = uid and state <> 'closed';
  if n <> 1 then
    raise exception 'D: человек не вернулся в очередь - открытых кейсов % (ожидался 1)', n;
  end if;
  if cid2 = cid then
    raise exception 'D: переиспользован закрытый кейс % вместо нового', cid;
  end if;

  ---------------------------------------------------------------------------
  -- СЛУЧАЙ E - вторая ветка решения модератора. admin_blocking_reject тоже
  -- писала onboarding_step сырым UPDATE, поэтому blocking-reject воспроизводил
  -- прод-цикл с 409 один в один. Заодно проверяем, что в user_state_transitions
  -- не осталось записи о переходе шага, которого не было: функция пишет историю
  -- двумя ручными INSERT'ами, и условным должен быть не только UPDATE.
  ---------------------------------------------------------------------------
  insert into admin_users (login, role, password_hash)
    values ('t_rk_block', 'moderator', 'x') returning id into adm;
  insert into users (telegram_id, verification_status, onboarding_step, lifecycle_state)
    values (990081204, 'pending_review', 'profile_finance', 'onboarding') returning id into uid;

  -- admin_blocking_reject требует настроенный app.session_secret (phone-tombstone).
  perform set_config('app.session_secret', 'test-secret-for-blocking-reject', true);
  select updated_at into upd from users where id = uid;
  r := admin_blocking_reject(uid, adm, 'подозрение на подделку', now() + interval '1 year', upd);
  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception 'E: admin_blocking_reject не отработал: %', r::text;
  end if;

  select onboarding_step::text, verification_status::text into st, vs from users where id = uid;
  if st <> 'profile_finance' then
    raise exception 'E: blocking-reject выбросил человека из анкеты - шаг % (ожидался profile_finance)', st;
  end if;
  if vs <> 'rejected' then
    raise exception 'E: verification_status = % (ожидался rejected)', vs;
  end if;

  select count(*) into n from user_state_transitions
    where user_id = uid and field = 'onboarding_step';
  if n <> 0 then
    raise exception 'E: в историю записан несуществующий переход шага (% строк)', n;
  end if;

  ---------------------------------------------------------------------------
  -- СЛУЧАЙ F - обратная дорога после ТЕХНИЧЕСКОГО отказа. Человеку вне
  -- верификационных шагов нельзя вернуть doc_upload (нет такого ребра в графе
  -- шагов), поэтому он идёт из rejected прямо в очередь. Ребро rejected →
  -- pending_review добавлено в вайтлист C-094 миграцией 20260812130000.
  ---------------------------------------------------------------------------
  select o_result, o_step, o_status, o_uid into r, st, vs, uid
    from _rk_decide(990081205, 'profile_health', 'rejected_technical');
  if vs <> 'rejected' then
    raise exception 'F: подготовка сломана - verification_status = %', vs;
  end if;

  r := _rk_resubmit(uid);
  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception 'F: transition_user отклонил rejected → pending_review: %', r::text;
  end if;

  select onboarding_step::text, verification_status::text into st, vs from users where id = uid;
  select count(*) into n from verification_cases where user_id = uid and state <> 'closed';
  if st <> 'profile_health' then
    raise exception 'F: перезаливка сдвинула шаг анкеты в %', st;
  end if;
  if n <> 1 then
    raise exception 'F: человек не вернулся в очередь - открытых кейсов %', n;
  end if;

  ---------------------------------------------------------------------------
  -- СЛУЧАЙ G - ТРЕТЬЯ ДВЕРЬ. Отмена блокирующего отказа
  -- (admin_unblock_verification) тоже ставила onboarding_step сырым UPDATE.
  -- Пока blocking-reject сам двигал шаг, отмена ничего не ломала: человек и так
  -- стоял на экране верификации. После случая E шаг у него анкетный - и теперь
  -- уже ОТМЕНА выбрасывала бы его из анкеты. Проверяем, что не выбрасывает и что
  -- в историю не пишется несуществующий переход.
  ---------------------------------------------------------------------------
  insert into admin_users (login, role, password_hash)
    values ('t_rk_unblock', 'moderator', 'x') returning id into adm;
  insert into users (telegram_id, verification_status, onboarding_step, lifecycle_state)
    values (990081206, 'pending_review', 'profile_values', 'onboarding') returning id into uid;
  insert into user_documents (user_id, status) values (uid, 'pending_review');

  perform set_config('app.session_secret', 'test-secret-for-blocking-reject', true);
  select updated_at into upd from users where id = uid;
  r := admin_blocking_reject(uid, adm, 'подозрение на подделку', now() + interval '1 year', upd);
  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception 'G: подготовка - blocking_reject не отработал: %', r::text;
  end if;

  select updated_at into upd from users where id = uid;
  r := admin_unblock_verification(uid, adm, upd);
  if coalesce((r->>'ok')::boolean, false) is not true then
    raise exception 'G: admin_unblock_verification не отработал: %', r::text;
  end if;

  select onboarding_step::text, verification_status::text into st, vs from users where id = uid;
  if st <> 'profile_values' then
    raise exception 'G: отмена блокировки выбросила человека из анкеты - шаг % (ожидался profile_values)', st;
  end if;
  if vs <> 'pending_review' then
    raise exception 'G: verification_status = % (ожидался pending_review)', vs;
  end if;

  select count(*) into n from user_state_transitions
    where user_id = uid and field = 'onboarding_step';
  if n <> 0 then
    raise exception 'G: в историю записан несуществующий переход шага (% строк)', n;
  end if;

  -- И человек снова в очереди: вход в pending_review заводит открытый кейс.
  select count(*) into n from verification_cases where user_id = uid and state <> 'closed';
  if n <> 1 then
    raise exception 'G: после отмены человек не в очереди - открытых кейсов %', n;
  end if;

  raise notice 'REJECT-STEP: анкета цела (A, C, E, G), до-анкетный путь цел (B), дорога назад работает (D, F) OK';
end $$;

rollback;
