-- DB-1 — серверные страховки (F-115) переезжают с connection-options на РОЛЬ
-- приложения. Причина: PgBouncer transaction-mode (план масштабирования DBS-01)
-- не пропускает pg startup options (`-c statement_timeout=...`) — при переходе
-- на пулер пул остался бы вообще без страховок. Role-GUC применяются сервером
-- на старте backend-сессии и работают одинаково с пулером и без него.
--
-- current_user — роль из DATABASE_URL (ей же применяются миграции).
--
-- ВАЖНО для будущих тяжёлых миграций: statement_timeout=10s теперь наследуют
-- и сессии миграций. Тяжёлая миграция (CREATE INDEX на большой таблице и т.п.)
-- должна начинаться с `set statement_timeout = 0;`.

do $$
begin
  execute format('alter role %I set statement_timeout = %L', current_user, '10000');
  execute format('alter role %I set idle_in_transaction_session_timeout = %L', current_user, '60000');
  execute format('alter role %I set application_name = %L', current_user, 'baxtlilar-web');
end $$;
