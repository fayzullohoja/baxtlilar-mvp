-- FIX (2026-08-12, вторая половина). Миграция 20260812120000 перестала выбрасывать
-- человека из анкеты - и этим отобрала у него дорогу назад, к повторной подаче
-- документов. Здесь чиним вторую половину и добиваем ту же болезнь во второй
-- ветке решения модератора.
--
-- КОРЕНЬ, общий для всех трёх правок ниже: колонка users.onboarding_step тянет
-- ДВЕ независимые оси сразу - «где человек в анкете» и «какой экран верификации
-- ему показать». Пока поток был линейным, это совпадало. Shadow-active
-- (20260625000000) расщепил оси: человек идёт по анкете, а верификация живёт
-- параллельно. С этого момента любая попытка выразить состояние верификации
-- через onboarding_step либо ломает анкету (сырой UPDATE → 409 wrong_step, что и
-- случилось на проде 12.08), либо, если шаг не трогать, делает экран починки
-- недостижимым - потому что и страница, и API гейтятся точным шагом.
--
-- ПРАВИЛО, которое вводим: ось верификации ведёт verification_status, и только
-- он. onboarding_step двигаем ТОЛЬКО тому, кто ещё стоит на до-анкетном шаге -
-- там это легальная навигация по графу, и без неё человеку некуда идти с
-- /onboarding/pending. Гарды экрана и роута починки переезжают на
-- verification_status (см. src/lib/onboarding/guard-api.ts и
-- src/lib/state-machine/guard.ts в этом же коммите).
--
-- Что здесь, в SQL:
--
-- 1) admin_blocking_reject - та же нелегальная запись, что чинили в 120000, но
--    во второй ветке решения модератора. Гард функции требует
--    verification_status='pending_review' - ровно то, что у shadow-active
--    человека в анкете и есть, так что ветка достижима: blocking-reject ставил
--    ему onboarding_step='verification_rejected', перехода profile_* →
--    verification_rejected в ALLOWED_TRANSITIONS нет, и прод-цикл с 409
--    воспроизводился один в один. Отдельно: функция пишет user_state_transitions
--    двумя INSERT'ами вручную, поэтому строку про onboarding_step тоже делаем
--    условной - иначе в истории осталась бы запись о переходе, которого не было.
--
-- 2) transition_user - в вайтлист переходов verification_status (C-094,
--    20260724160000) добавляем ребро rejected → pending_review. Зачем: человеку
--    с техническим отказом, который УЖЕ ушёл из до-анкетных шагов, нельзя
--    вернуть шаг doc_upload (это ровно тот запрещённый прыжок), поэтому он
--    перезаливает документы через /api/onboarding/fix и обязан попасть прямо в
--    очередь. Старое ребро rejected → phone_verified оставлено: им ходит
--    /api/onboarding/retry для тех, кто застрял на самом шаге
--    verification_rejected, и ломать рабочий путь незачем.
--    БЕЗОПАСНОСТЬ: это не обход модерации - pending_review означает «встал в
--    очередь», а не «одобрен»; approved по-прежнему ставится только
--    admin_approve_*. Блокирующий отказ (reject_category='blocking') отсекается
--    раньше, в самом роуте /fix, как это уже делает /retry.
--
-- ПОЧЕМУ это возвращает человека в очередь без единой записи в onboarding_step
-- (проверено на эфемерной БД): триггер users_ensure_verification_case
-- (20260702000000) висит на `after insert or update of verification_status ...
-- when (new.verification_status = 'pending_review')` и заводит новый открытый
-- кейс, а частичный unique-индекс verification_cases_one_open_per_user считает
-- только незакрытые кейсы, поэтому закрытый решением модератора кейс новому не
-- мешает. Шаг анкеты при этом остаётся нетронутым.
--
-- Идемпотентно: только create or replace, повторный накат безопасен.

-- ---------------------------------------------------------------------------
-- 1) admin_blocking_reject: шаг двигаем только до-анкетному человеку.
--    Тело скопировано из последней действующей редакции
--    (20260630020000_admin_blocking_reject_constraint_fix.sql) дословно;
--    изменены ровно два места - UPDATE users и вторая строка истории.
-- ---------------------------------------------------------------------------
create or replace function admin_blocking_reject(
  p_user_id              uuid,
  p_admin_id             uuid,
  p_reason               text,
  p_phone_until_at       timestamptz,
  p_expected_updated_at  timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user users%rowtype;
  v_doc user_documents%rowtype;
  v_new_updated timestamptz := now();
  v_phone_hash text;
  v_session_secret text;
  -- До-анкетный человек: только ему перевод шага в verification_rejected
  -- легален по графу ALLOWED_TRANSITIONS. Ушедшему в анкету шаг не трогаем.
  v_pre_anketa boolean;
begin
  if p_admin_id is null then
    return jsonb_build_object('ok', false, 'error', 'admin_id_required');
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  select * into v_user from users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_user.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;
  if v_user.verification_status <> 'pending_review' then
    return jsonb_build_object('ok', false, 'error', 'not_pending',
                              'current', v_user.verification_status);
  end if;

  v_pre_anketa := v_user.lifecycle_state = 'onboarding'
    and v_user.onboarding_step in ('moderation_pending', 'doc_upload', 'selfie_upload');

  select * into v_doc from user_documents where user_id = p_user_id for update;

  v_session_secret := current_setting('app.session_secret', true);
  if v_session_secret is null or length(v_session_secret) = 0 then
    return jsonb_build_object('ok', false, 'error', 'session_secret_not_configured');
  end if;

  if v_user.phone_number is not null then
    v_phone_hash := encode(
      hmac('phone:v1:' || v_user.phone_number, v_session_secret, 'sha256'),
      'hex'
    );
  end if;

  update users set
    verification_status = 'rejected',
    onboarding_step     = case when v_pre_anketa
                               then 'verification_rejected'::onboarding_step
                               else onboarding_step end,
    updated_at          = v_new_updated
  where id = p_user_id;

  insert into user_state_transitions
    (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
  values
    (p_user_id, 'verification_status',
     v_user.verification_status::text, 'rejected',
     'blocking_reject: ' || p_reason, 'admin', p_admin_id::text);

  -- Историю про шаг пишем только если шаг реально сменился: иначе в
  -- user_state_transitions осталась бы запись о переходе, которого не было.
  if v_pre_anketa then
    insert into user_state_transitions
      (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
    values
      (p_user_id, 'onboarding_step',
       v_user.onboarding_step::text, 'verification_rejected',
       'blocking_reject: ' || p_reason, 'admin', p_admin_id::text);
  end if;

  update user_documents set
    status            = 'rejected',
    reject_category   = 'blocking',
    reject_reason     = p_reason,
    reject_target     = null,
    moderated_by      = p_admin_id::text,
    moderated_at      = v_new_updated
  where user_id = p_user_id;

  if v_phone_hash is not null then
    insert into phone_blacklist(phone_hash, until_at, reason, linked_user_id)
    values (v_phone_hash, p_phone_until_at, 'verification_blocking_reject', p_user_id);
  end if;

  -- Bug #17: используем актуальный constraint после миграции 920000.
  if v_doc.passport_sha256 is not null then
    insert into document_sha_blacklist(sha256, kind, source_user_id, reason)
    values (v_doc.passport_sha256, 'passport', p_user_id, 'verification_blocking_reject')
    on conflict (sha256, kind, source_user_id, reason) do nothing;
  end if;
  if v_doc.selfie_sha256 is not null then
    insert into document_sha_blacklist(sha256, kind, source_user_id, reason)
    values (v_doc.selfie_sha256, 'selfie', p_user_id, 'verification_blocking_reject')
    on conflict (sha256, kind, source_user_id, reason) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'phone_tombstone_written', v_phone_hash is not null,
    'updated_at', v_new_updated
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) transition_user: разрешаем rejected → pending_review.
--    Тело скопировано из 20260724160000_transition_graph_guard.sql дословно;
--    изменена ровно одна строка вайтлиста verification_status.
-- ---------------------------------------------------------------------------
create or replace function transition_user(
  p_user_id uuid,
  p_patch jsonb,
  p_expected_updated_at timestamptz,
  p_reason text,
  p_by_kind triggered_by_kind,
  p_by_id text
) returns jsonb
language plpgsql
as $$
declare
  v_old users%rowtype;
  v_key text;
  v_old_val text;
  v_new_val text;
  v_target_lifecycle text;
  v_from text;
  v_to text;
begin
  select * into v_old from users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_old.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;

  -- R1-#1: ban-переходы ТОЛЬКО через admin_ban_* RPC.
  v_target_lifecycle := p_patch->>'lifecycle_state';
  if v_target_lifecycle in ('blocked','pending_ban') then
    return jsonb_build_object('ok', false, 'error', 'ban_via_dedicated_rpc',
                              'target', v_target_lifecycle);
  end if;

  -- C-094: граф допустимых переходов. Проверяем ТОЛЬКО когда ключ присутствует в
  -- патче И значение реально меняется - почти все вызовы несут лишь
  -- onboarding_step, иначе каждый анкетный шаг ложно отклонялся бы.
  if p_patch ? 'lifecycle_state' then
    v_from := v_old.lifecycle_state::text;
    v_to := p_patch->>'lifecycle_state';
    -- →blocked/pending_ban уже отклонён выше (ban_via_dedicated_rpc).
    -- blocked→{active,onboarding,paused} - легитимный РАЗБАН (unban-роут идёт
    -- через transition_user), поэтому разрешён.
    if v_to is not null and v_from is distinct from v_to
       and (v_from || '>' || v_to) not in (
         'onboarding>active',
         'active>paused',
         'paused>active',
         'blocked>active', 'blocked>onboarding', 'blocked>paused'
       ) then
      return jsonb_build_object('ok', false, 'error', 'illegal_lifecycle_transition',
                                'from', v_from, 'to', v_to);
    end if;
  end if;

  if p_patch ? 'verification_status' then
    v_from := v_old.verification_status::text;
    v_to := p_patch->>'verification_status';
    -- approved/rejected/needs_changes/not_started - только через выделенные
    -- admin_*-RPC (прямой UPDATE, минуя transition_user), поэтому их здесь нет.
    -- 2026-08-12: добавлено rejected>pending_review. Человек с ТЕХНИЧЕСКИМ
    -- отказом, ушедший из до-анкетных шагов по shadow-active, не может вернуться
    -- на doc_upload (запрещённый прыжок по графу шагов), поэтому перезаливает
    -- документы через /api/onboarding/fix и встаёт в очередь напрямую.
    -- Блокирующий отказ сюда не доходит: /fix отсекает reject_category='blocking'
    -- до любой мутации, ровно как /retry.
    if v_to is not null and v_from is distinct from v_to
       and (v_from || '>' || v_to) not in (
         'not_started>phone_verified',
         'phone_verified>documents_uploaded',
         'documents_uploaded>pending_review',
         'needs_changes>pending_review',
         'rejected>pending_review',
         'rejected>phone_verified'
       ) then
      return jsonb_build_object('ok', false, 'error', 'illegal_verification_transition',
                                'from', v_from, 'to', v_to);
    end if;
  end if;

  update users set
    lifecycle_state     = coalesce((p_patch->>'lifecycle_state')::lifecycle_state, lifecycle_state),
    onboarding_step     = coalesce((p_patch->>'onboarding_step')::onboarding_step, onboarding_step),
    verification_status = coalesce((p_patch->>'verification_status')::verification_status, verification_status),
    profile_completion  = coalesce((p_patch->>'profile_completion')::profile_completion, profile_completion),
    quiz_completion     = coalesce((p_patch->>'quiz_completion')::quiz_completion, quiz_completion),
    phone_verified      = coalesce((p_patch->>'phone_verified')::boolean, phone_verified),
    phone_number        = coalesce(p_patch->>'phone_number', phone_number),
    language            = coalesce(p_patch->>'language', language),
    blocked_at          = case when p_patch ? 'blocked_at' then (p_patch->>'blocked_at')::timestamptz else blocked_at end,
    blocked_reason      = case when p_patch ? 'blocked_reason' then p_patch->>'blocked_reason' else blocked_reason end
  where id = p_user_id;

  for v_key in select jsonb_object_keys(p_patch) loop
    v_old_val := to_jsonb(v_old) ->> v_key;
    v_new_val := p_patch ->> v_key;
    if v_old_val is distinct from v_new_val then
      insert into user_state_transitions(
        user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id
      ) values (p_user_id, v_key, v_old_val, v_new_val, p_reason, p_by_kind, p_by_id);
    end if;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) admin_unblock_verification: третья дверь в тот же баг.
--
--    Пока admin_blocking_reject всегда ставила onboarding_step='verification_rejected',
--    отмена блокирующего отказа честно возвращала человека на moderation_pending -
--    он и так стоял на экране верификации, ломать было нечего. После правки (1)
--    blocking-отказ больше не трогает шаг анкеты, и теперь ИМЕННО ОТМЕНА стала
--    выбрасывать человека из анкеты: сырой UPDATE ставил ему moderation_pending
--    поверх profile_*, перехода такого в графе нет, и открытая форма анкеты снова
--    получала бы 409 wrong_step. То есть правка (1) без этой правки просто
--    переносит баг на соседнюю кнопку модератора.
--
--    Чиним тем же правилом: шаг двигаем только тому, кто стоит на
--    верификационном шаге. Заодно перестаём врать в истории - from_value брался
--    литералом 'verification_rejected' независимо от реального значения.
--
--    Тело скопировано из 20260620920000_split_window_and_jti_fixes.sql дословно;
--    изменены ровно UPDATE users и блок user_state_transitions.
-- ---------------------------------------------------------------------------
create or replace function admin_unblock_verification(
  p_user_id              uuid,
  p_admin_id             uuid,
  p_expected_updated_at  timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user users%rowtype;
  v_doc_row user_documents%rowtype;
  v_new_updated timestamptz := now();
  v_phone_deleted integer := 0;
  v_sha_deleted integer := 0;
  -- Человек на экране верификации: только ему возврат на moderation_pending
  -- что-то значит. Ушедшему в анкету шаг не трогаем.
  v_on_verification_step boolean;
begin
  if p_admin_id is null then
    return jsonb_build_object('ok', false, 'error', 'admin_id_required');
  end if;

  select * into v_user from users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_user.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;
  if v_user.verification_status <> 'rejected' then
    return jsonb_build_object('ok', false, 'error', 'not_rejected',
                              'current', v_user.verification_status);
  end if;
  if v_user.lifecycle_state <> 'onboarding' then
    return jsonb_build_object('ok', false, 'error', 'wrong_lifecycle',
                              'current', v_user.lifecycle_state);
  end if;

  select * into v_doc_row from user_documents where user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_documents');
  end if;
  if coalesce(v_doc_row.reject_category, '') <> 'blocking' then
    return jsonb_build_object('ok', false, 'error', 'not_blocking',
                              'current', v_doc_row.reject_category);
  end if;

  v_on_verification_step := v_user.onboarding_step in
    ('doc_upload', 'selfie_upload', 'moderation_pending', 'needs_changes', 'verification_rejected');

  update users set
    verification_status = 'pending_review',
    onboarding_step     = case when v_on_verification_step
                               then 'moderation_pending'::onboarding_step
                               else onboarding_step end,
    updated_at          = v_new_updated
  where id = p_user_id;

  insert into user_state_transitions
    (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
  values
    (p_user_id, 'verification_status', 'rejected', 'pending_review',
     'admin: blocking-reject revoked', 'admin', p_admin_id::text);

  -- Историю про шаг пишем только если он реально сменился, и с настоящим
  -- from_value: раньше здесь стоял литерал 'verification_rejected'.
  if v_on_verification_step then
    insert into user_state_transitions
      (user_id, field, from_value, to_value, reason, triggered_by_kind, triggered_by_id)
    values
      (p_user_id, 'onboarding_step', v_user.onboarding_step::text, 'moderation_pending',
       'admin: blocking-reject revoked', 'admin', p_admin_id::text);
  end if;

  update user_documents set
    status            = 'pending_review',
    reject_category   = null,
    reject_reason     = null,
    reject_target     = null,
    moderated_by      = null,
    moderated_at      = null
  where user_id = p_user_id;

  with deleted as (
    delete from phone_blacklist
     where linked_user_id = p_user_id
       and reason = 'verification_blocking_reject'
     returning 1
  )
  select count(*) into v_phone_deleted from deleted;

  with deleted as (
    delete from document_sha_blacklist
     where source_user_id = p_user_id
       and reason = 'verification_blocking_reject'
     returning 1
  )
  select count(*) into v_sha_deleted from deleted;

  return jsonb_build_object(
    'ok', true,
    'phone_tombstone_cleared', v_phone_deleted,
    'sha_tombstones_cleared', v_sha_deleted,
    'updated_at', v_new_updated
  );
end;
$$;

do $$ begin raise notice 'Повторная верификация достижима с любого шага; решения модератора не трогают анкету.'; end $$;
