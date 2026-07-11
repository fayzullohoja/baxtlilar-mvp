-- Фикс live-бага (найден runtime-тестом песочницы 2026-07-11):
-- admin_restart_onboarding (миграция 20260704060000) закрывает verification_cases
-- с outcome='restarted', но verification_cases_outcome_check этого значения НЕ
-- разрешал → RPC падал (constraint violation) для ЛЮБОГО юзера с не-закрытым
-- verification_case, а это обычный случай. Вся операция откатывалась →
-- restart-onboarding не работал для верифицирующихся юзеров.
--
-- Фикс: добавляем 'restarted' в разрешённый набор outcome (additive, идемпотентно).
-- Это отдельная семантика «административное закрытие при рестарте», а не модерация.

alter table verification_cases
  drop constraint if exists verification_cases_outcome_check;
alter table verification_cases
  add constraint verification_cases_outcome_check
  check (
    outcome is null
    or outcome in (
      'approved',
      'needs_changes',
      'rejected_technical',
      'rejected_blocking',
      'restarted'
    )
  );
