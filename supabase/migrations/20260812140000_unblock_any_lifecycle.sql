-- FIX (2026-08-12, третья правка дня). Отмена блокирующего отказа отказывалась
-- работать для человека с lifecycle_state <> 'onboarding' - и это тупик, из
-- которого нет выхода средствами админки, только руками в БД.
--
-- КАК ТУДА ПОПАДАЮТ (воспроизведено на эфемерной БД, не гипотеза):
-- человек по shadow-active проходит анкету и публикуется, пока верификация ещё
-- висит в очереди - у него lifecycle_state='active' и verification_status=
-- 'pending_review' одновременно. Модератор выносит блокирующий отказ: гард
-- admin_blocking_reject требует ровно pending_review, и у такого человека он и
-- есть, так что ветка проходит штатно. Дальше выясняется, что отказ ошибочный,
-- модератор жмёт «Откатить блокировку» - и получает
-- {"ok": false, "error": "wrong_lifecycle", "current": "active"}.
--
-- ПОЧЕМУ ГАРД БОЛЬШЕ НЕ НУЖЕН. Он стоит с 20260620920000, и тогда был осмыслен:
-- отмена БЕЗУСЛОВНО возвращала человека на onboarding_step='moderation_pending',
-- а этот шаг что-то значит только внутри онбординга - для активного он был бы
-- нелегальной записью по графу переходов (ровно тот баг, что чинили сегодня
-- утром в 20260812120000). Но 20260812130000 переписала функцию так, что шаг
-- двигается УСЛОВНО, только при v_on_verification_step. То есть гард с утра
-- охраняет то, чего в теле функции уже нет: он остался единственной причиной,
-- по которой человека нельзя вернуть в очередь.
--
-- ЧТО СТАВИМ ВМЕСТО. Отказ ровно для тех состояний, где действие было бы
-- неверным по существу, а не по неудачному совпадению:
--   blocked / pending_ban - ось БАНА. Она отдельная и ведётся своими RPC
--     (admin_ban_*, /unban). Отмена отказа по верификации не должна воскрешать
--     забаненного: это тихий обход процедуры «два суперадмина», где бан ставят
--     вдвоём, а снимали бы его в одно нажатие чужой кнопкой.
--   deleted - человека уже нет, возвращать в очередь нечего.
-- onboarding / active / paused - пускаем: блокирующий отказ достижим из каждого
-- из них, и из каждого из них он должен быть отменяем.
--
-- Код ошибки НОВЫЙ - 'banned_lifecycle' вместо 'wrong_lifecycle'. Так и в логах,
-- и в интерфейсе видно разницу между «состояние не то, что мы ожидали» (старое,
-- почти всегда ложное срабатывание) и «человек забанен или удалён, и это
-- осознанный отказ». Роут /api/admin/users/[id]/unblock-verification знает оба:
-- старый - на случай, если БД ещё не накатила эту миграцию.
--
-- ЧТО ПРОВЕРЕНО И НЕ СЛОМАНО (см. supabase/tests/unblock_any_lifecycle.test.sql):
--   - возврат в pending_review сам по себе никого не показывает в подборе:
--     get_recommendations гейтится по verification_status='approved';
--   - триггер users_ensure_verification_case (20260702000000) заводит НОВЫЙ
--     открытый кейс и активному человеку - модератор увидит его снова. Кейс,
--     закрытый решением admin_blocking_reject_case, новому не мешает: частичный
--     unique-индекс verification_cases_one_open_per_user считает только
--     незакрытые;
--   - onboarding_step активного человека остаётся нетронутым (правка 130000).
--
-- Тело скопировано из действующей редакции
-- (20260812130000_verification_repair_reachable.sql) дословно; изменён ровно
-- один блок - гард по lifecycle_state.
--
-- Идемпотентно: только create or replace, повторный накат безопасен.

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
  -- Ось бана ведут admin_ban_* и /unban, а не эта кнопка: отмена отказа по
  -- верификации не должна снимать бан, поставленный двумя суперадминами, и не
  -- воскрешает удалённого. Онбординг, активный и на паузе - пускаем: блокирующий
  -- отказ достижим из каждого из этих состояний.
  if v_user.lifecycle_state in ('blocked', 'pending_ban', 'deleted') then
    return jsonb_build_object('ok', false, 'error', 'banned_lifecycle',
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

do $$ begin raise notice 'Отмена блокирующего отказа доступна и активному человеку; бан снимается только своей процедурой.'; end $$;
