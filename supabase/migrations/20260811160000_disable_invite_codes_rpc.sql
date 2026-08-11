-- Раунд исправлений 1 по Task 10 (независимое ревью).
--
-- Найдено: disableCodesOfUser (src/lib/invite/store.ts) делала ДВА
-- последовательных UPDATE без транзакции - сначала гасила строку кода, потом
-- ставила персональный запрет (users.invite_revoked_at). Если первый прошёл,
-- а второй упал (сеть, таймаут, состязание за users - самую горячую таблицу
-- проекта), получалось: строка кода мертва, а право приглашать - нет. Роут
-- ловил исключение и отдавал ошибку, но это была ЛОЖНАЯ картина - первый
-- UPDATE уже закоммичен. Человек оставался с правом приглашать, заметить это
-- было нельзя - дословно та дыра, ради которой вся задача.
--
-- Решение - обе записи внутри ОДНОЙ функции БД (по образцу admin_ban_confirm,
-- 20260619500000_admin_oversight.sql: несколько UPDATE/INSERT в одном plpgsql-
-- теле выполняются в ОДНОЙ транзакции автоматически - если тело падает на
-- любом шаге, Postgres откатывает ВСЁ целиком, включая уже выполненные внутри
-- этого же вызова операторы). TS-слой (disableCodesOfUser) теперь делает ровно
-- один RPC-вызов вместо двух прямых UPDATE.
--
-- Порядок операций внутри функции НЕ поменял местами относительно старого
-- TS-кода (сначала гасим строку кода, потом - если reason ≠ 'ban' - ставим
-- персональный запрет): это осознанно, реверс порядка ничего не улучшил бы, а
-- транзакция и так гарантирует "либо оба шага, либо ни одного" независимо от
-- порядка записи внутри тела.
create or replace function disable_invite_codes_of_user(
  p_user_id uuid,
  p_reason  text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_now            timestamptz := now();
  v_disabled_count int;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'user_id_required');
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  update invite_codes
    set disabled_at = v_now, disabled_reason = p_reason
    where owner_id = p_user_id and disabled_at is null;
  get diagnostics v_disabled_count = row_count;

  -- reason='ban' НЕ ставит персональный запрет - см. развёрнутый комментарий в
  -- disableCodesOfUser (src/lib/invite/store.ts): забаненный физически не
  -- доходит до экрана «Пригласить» (гейт по lifecycle_state='blocked' раньше
  -- ensureCodeForUser), а на unban уже есть симметричная пара
  -- reviveBanDisabledCodes (Task 8) - вести ещё и эту колонку для бана значило
  -- бы держать ДВЕ независимые колонки в ручной синхронизации без выигрыша.
  if p_reason <> 'ban' then
    update users set invite_revoked_at = v_now where id = p_user_id;
  end if;

  return jsonb_build_object('ok', true, 'disabled_count', v_disabled_count, 'at', v_now);
end;
$$;

comment on function disable_invite_codes_of_user(uuid, text) is
  'Гасит активные коды пользователя и (кроме reason=ban) ставит персональный запрет invite_revoked_at - атомарно, одной транзакцией. Заменяет пару прямых UPDATE в disableCodesOfUser (Task 10, раунд исправлений 1).';
