-- FIX (2026-08-12): решение модератора выбрасывало из анкеты человека, который
-- уже ушёл вперёд по shadow-active, и он терял заполненное.
--
-- Прод, юзер 39ede142-fb39-4a23-b639-fb3ed193f706:
--   14:18 moderation_pending → profile_basic («shadow active: user advances to
--         anketa while moderator reviews») - так и задумано;
--   14:44 человек заполняет profile_lifestyle;
--   14:47:27 модератор жмёт needs_changes;
--   14:47:34 POST /api/onboarding/profile/lifestyle → 409 wrong_step, и так пять
--         раз подряд. Человеку показывали «попробуйте ещё раз», хотя повтор не
--         мог сработать никогда: шаг у него уже подменили.
--
-- ПОЧЕМУ так вышло. Фикс 2026-07-09 добавил сюда запись onboarding_step и
-- отсекал только shadow-active с lifecycle_state='active'. Но человек в анкете
-- ВСЁ ЕЩЁ lifecycle_state='onboarding' (в active он переходит лишь на шаге
-- 'ready'), поэтому под условие попадал и он. Сырой UPDATE ставил ему
-- onboarding_step='needs_changes' мимо машины состояний: в ALLOWED_TRANSITIONS
-- (src/lib/state-machine/types.ts) перехода profile_* → needs_changes НЕТ,
-- поэтому и в user_state_transitions такой записи не остаётся - историю пишет
-- tryTransition, а RPC его не зовёт. Дальше guard-api.ts честно отвечал 409.
--
-- ЧИНИМ: двигаем onboarding_step ТОЛЬКО когда переход легален по графу, то есть
-- пока человек на до-анкетном шаге (moderation_pending, doc_upload,
-- selfie_upload). Ушёл в анкету - шаг НЕ ТРОГАЕМ, меняем только
-- verification_status. Так человек дозаполняет анкету и не теряет заполненное.
--
-- ВНИМАНИЕ: САМА ПО СЕБЕ ЭТА МИГРАЦИЯ НЕПОЛНА И ПОРОЖДАЕТ ХУДШИЙ ДЕФЕКТ.
-- Первая редакция шапки утверждала, что «миграция ничего не ухудшает» и что
-- человек «узнает о замечаниях из плашки на /main». Оба утверждения неверны, и
-- накатывать эту миграцию без парной 20260812130000 нельзя:
--   1) пока lifecycle_state='onboarding', /main вообще недостижим -
--      requireActiveUser отвергает onboarding и уводит обратно в анкету, так что
--      плашка человеку не показывается; остаётся только сообщение бота;
--   2) сохранив анкетный шаг, мы отобрали у человека ЕДИНСТВЕННУЮ дорогу к
--      повторной подаче документов: и страница /onboarding/needs-changes, и
--      /api/onboarding/fix, и /api/onboarding/retry гейтились ТОЧНЫМ шагом плюс
--      lifecycle_state='onboarding'. Человек дозаполнял анкету, публиковался,
--      уходил в lifecycle='active' - и оба гарда становились невыполнимы
--      НАВСЕГДА. verification_status застревал в needs_changes, в подбор такой
--      аккаунт не попадал никогда, а вернуть его могла только
--      admin_restart_onboarding, стирающая ровно ту анкету, ради которой всё и
--      затевалось. То есть обратимая потеря заменялась необратимой.
-- Дорогу назад чинит парная миграция 20260812130000 вместе с переводом гардов
-- экрана и роута починки с onboarding_step на verification_status (см.
-- src/lib/onboarding/guard-api.ts, src/lib/state-machine/guard.ts) и кнопкой в
-- VerificationPlashka.tsx. Две миграции - одно целое, накатываются вместе.
--
-- ПОЧЕМУ это не дыра в подборе. Видимость в get_recommendations гейтится по
-- verification_status='approved' И profile.status='published' И наличию
-- approved-фото; onboarding_step в гейте не участвует вообще. Человек с
-- verification_status='needs_changes' в подбор не попадёт ни на каком шаге.
--
-- То же правило применено к outcome='rejected_technical': там ровно та же
-- нелегальная запись, только значением 'verification_rejected'. По графу этот
-- шаг достижим лишь из moderation_pending, но doc_upload/selfie_upload
-- оставлены в общем списке до-анкетных намеренно - правило одно на оба исхода,
-- а лишние два шага и так ведут человека туда же, к повторной загрузке.
--
-- Тело функции скопировано из последней действующей редакции
-- (20260808120000_reject_category_in_outbox.sql) без иных изменений: проверки
-- claim/stale/reason, закрытие кейса, _emit_case_event и enqueue_tg_outbox с
-- reject_category='technical' - дословно. Изменён ровно блок onboarding_step.
-- admin_blocking_reject_case из той миграции здесь НЕ переобъявляется: она не
-- менялась, и копия ради копии разъехалась бы с оригиналом.
--
-- Идемпотентно: create or replace, повторный накат безопасен.

create or replace function admin_reject_verification(
  p_case_id uuid,
  p_admin_id uuid,
  p_outcome text,
  p_reason_code text,
  p_reason_text text,
  p_expected_updated_at timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_state verification_case_state;
  v_assignee uuid;
  v_user_id uuid;
  v_updated_at timestamptz;
  v_event_type text;
begin
  if p_outcome not in ('needs_changes','rejected_technical') then
    return jsonb_build_object('ok', false, 'error', 'bad_outcome');
  end if;

  select state, assignee_id, user_id, updated_at
    into v_state, v_assignee, v_user_id, v_updated_at
    from verification_cases where id = p_case_id for update;

  if not found then return jsonb_build_object('ok', false, 'error', 'case_not_found'); end if;
  if v_state = 'closed' then return jsonb_build_object('ok', false, 'error', 'case_closed'); end if;
  if v_assignee is null or v_assignee <> p_admin_id then
    return jsonb_build_object('ok', false, 'error', 'not_claimed_by_you');
  end if;
  if v_updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'stale_case', 'current_updated_at', v_updated_at);
  end if;
  if p_reason_text is null or length(p_reason_text) < 3 then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  update verification_cases
    set state = 'closed', outcome = p_outcome,
        decided_by = p_admin_id, decided_at = now()
    where id = p_case_id;

  -- Update legacy users.verification_status (V1 client UI still reads this)
  -- + onboarding_step восстановления - ТОЛЬКО пока человек на до-анкетном шаге.
  -- Условие onboarding_step in (...) - это и есть фикс 2026-08-12: из анкеты
  -- (profile_*) перехода в needs_changes/verification_rejected в графе нет, и
  -- сырая запись туда роняла человеку сохранение анкеты в 409.
  update users
    set verification_status = case
          when p_outcome = 'needs_changes' then 'needs_changes'::verification_status
          when p_outcome = 'rejected_technical' then 'rejected'::verification_status
          else verification_status
        end,
        onboarding_step = case
          when lifecycle_state = 'onboarding'
               and onboarding_step in ('moderation_pending', 'doc_upload', 'selfie_upload')
               and p_outcome = 'needs_changes'
            then 'needs_changes'
          when lifecycle_state = 'onboarding'
               and onboarding_step in ('moderation_pending', 'doc_upload', 'selfie_upload')
               and p_outcome = 'rejected_technical'
            then 'verification_rejected'
          else onboarding_step
        end
    where id = v_user_id;

  v_event_type := case p_outcome
    when 'needs_changes' then 'verification_needs_changes'
    when 'rejected_technical' then 'verification_rejected'
    else 'verification_rejected'
  end;

  perform _emit_case_event(p_case_id, p_admin_id, 'decided',
    jsonb_build_object('outcome', p_outcome, 'reason_code', p_reason_code, 'reason_text', p_reason_text));

  -- Технический отказ: повтор РАЗРЕШЁН - явно помечаем категорию, чтобы текст
  -- не зависел от отсутствия поля.
  perform enqueue_tg_outbox(v_user_id, v_event_type,
    jsonb_build_object('reason', p_reason_text, 'reject_category', 'technical'));

  return jsonb_build_object('ok', true, 'outcome', p_outcome);
end$$;

do $$ begin raise notice 'admin_reject_verification больше не выбрасывает человека из анкеты.'; end $$;
