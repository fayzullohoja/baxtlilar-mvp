-- FIX (2026-08-12, четвёртая правка дня). Отмена блокирующего отказа стирала
-- ВСЕ следы прошлого решения с поверхностей, доступных модератору - и именно
-- для состояния, которое разрешила предыдущая миграция (20260812140000), другого
-- следа не оставалось вовсе. Повторное решение по тому же паспорту принимается
-- вслепую.
--
-- ЧТО ИМЕННО ПРОИСХОДИЛО. RPC обнуляет user_documents.reject_category /
-- reject_reason / moderated_by / moderated_at, снимает тумбстоуны телефона и
-- хешей документов, а verification_cases не трогает вовсе - _emit_case_event не
-- звался ни по старому кейсу, ни по новому. Триггер users_ensure_verification_case
-- заводит НОВЫЙ кейс в state='new' с пустым case_events. Модератор берёт его и
-- видит чистую заявку: loadCase (src/lib/admin/load-case.ts) читает заметки и
-- события ТОЛЬКО своего кейса, прошлые кейсы не подтягивает. Единственный
-- уцелевший след - закрытый кейс с outcome='rejected_blocking' - лежит на
-- карточке клиента, а карточка модератору закрыта скоуп-гардом. Итог: человеку,
-- которому блокирующий отказ вынесли ПРАВИЛЬНО (подделка паспорта), второй
-- модератор штампует approve, и человек уходит в подбор - is_matchable и
-- get_recommendations гейтятся ровно по verification_status='approved'.
--
-- ПОЧЕМУ это стало важно только сейчас: до 20260812140000 отмена отвечала
-- wrong_lifecycle всем, кроме онбординга, а до-анкетного человека модератор
-- увидеть на карточке мог. Разрешив активного, мы открыли путь, на котором
-- истории не остаётся нигде.
--
-- Цену нажатия тоже стоит держать в голове: диалог отмены не спрашивает ни
-- причину, ни слово-подтверждение (ACTIONS.unblock_verif в DangerZone.tsx), так
-- что кнопка жмётся дёшево. Тем важнее, чтобы дешёвое нажатие не стирало
-- историю.
--
-- ЧИНИМ ПРИЧИНУ, А НЕ ЭКРАН: отмена сама дописывает событие в таймлайн НОВОГО
-- кейса и уносит в payload ровно то, что стирает из user_documents - категорию,
-- текст отказа, кто и когда его вынес, плюс id закрытого кейса. case_events
-- append-only (триггер prevent_case_events_mutation запрещает update и delete),
-- поэтому запись переживёт любые последующие правки строки документов.
--
-- ПОЧЕМУ в НОВЫЙ кейс, а не в закрытый: закрытый модератор не откроет - студия
-- /admin/cases/[id] скоупится по assignee, - а новый и есть тот самый экран, на
-- котором принимается повторное решение. Событие должно лежать там, где его
-- прочтут, иначе это запись для архива, а не предупреждение.
--
-- Тело скопировано из действующей редакции (20260812140000_unblock_any_lifecycle.sql)
-- дословно; добавлены две переменные и один блок перед return. Гарды, порядок
-- проверок, security invoker и search_path не тронуты.
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
  -- Кейс, который заведёт триггер на входе в pending_review: в его таймлайн
  -- уходит след отменённого решения.
  v_open_case_id uuid;
  -- Кейс, закрытый тем самым блокирующим отказом. Нужен в payload как ниточка
  -- к полной истории для того, кто всё-таки доберётся до карточки клиента.
  v_prior_case_id uuid;
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
  -- coalesce обязателен: у технического отказа reject_category = NULL (см.
  -- admin_reject_verification - она user_documents вообще не трогает), а без
  -- coalesce предикат NULL <> 'blocking' даёт NULL, ветка не берётся, и гард
  -- молча пропускает человека, которому откатывать нечего.
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

  -- След в таймлайн нового кейса ставим ДО того, как обнулим строку документов:
  -- всё, что уходит в payload, читается из v_doc_row, снятого ещё до UPDATE, но
  -- порядок держим явным, чтобы правка ниже не стала молча забирать пустоту.
  --
  -- Кейс ищем ПОСЛЕ update users: его заводит триггер users_ensure_verification_case
  -- на входе в pending_review, раньше его просто нет. Проверка на null - на
  -- случай, если открытый кейс не появился (триггер снят/заменён): тогда
  -- отмена всё равно должна отработать, а не упасть.
  select id into v_open_case_id
    from verification_cases
   where user_id = p_user_id and state <> 'closed';

  if v_open_case_id is not null then
    select id into v_prior_case_id
      from verification_cases
     where user_id = p_user_id
       and state = 'closed'
       and outcome = 'rejected_blocking'
     order by decided_at desc nulls last
     limit 1;

    perform _emit_case_event(v_open_case_id, p_admin_id, 'blocking_reject_revoked',
      jsonb_build_object(
        'revoked_reject_category', v_doc_row.reject_category,
        'revoked_reject_reason',   v_doc_row.reject_reason,
        'revoked_moderated_by',    v_doc_row.moderated_by,
        'revoked_moderated_at',    v_doc_row.moderated_at,
        'prior_case_id',           v_prior_case_id
      ));
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

do $$ begin raise notice 'Отмена блокирующего отказа оставляет след в таймлайне нового кейса.'; end $$;
