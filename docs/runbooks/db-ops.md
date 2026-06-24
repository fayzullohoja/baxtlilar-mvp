# Runbook: DB операции

## Подключение

```bash
unset PGUSER PGDATABASE PGHOST PGPORT PGPASSWORD
psql 'postgresql://postgres:<PASSWORD>@thomas.proxy.rlwy.net:26164/railway'
```

`unset` обязателен — без него psql может пытаться использовать твоего системного юзера.

Reference URL — в `.env.access` (gitignored).

## Wipe test users в проде

⚠️ Только когда подтверждено что прод-юзеров реальных нет (founder, по словам, тестировал
только своими аккаунтами).

```sql
begin;
delete from chat_messages;
delete from chats;
delete from blocks;
delete from match_views;
delete from match_requests;
delete from reports;
delete from profile_photos;
delete from quiz_answers;
delete from quiz_results;
delete from consents;
delete from user_documents;
delete from user_profiles;
delete from daily_request_quotas;
delete from otp_codes;
delete from user_state_transitions;
delete from start_token_uses;
delete from phone_blacklist;
delete from document_sha_blacklist;
delete from users;
commit;
```

Сохраняется: `admin_users`, `admin_audit_log`, `admin_login_attempts`, `admin_scope_*`.

## Удаление одного юзера (мягко)

```sql
select erase_user('<uuid>'::uuid);
```

`erase_user` — атомарный RPC, сохраняет sha-blacklist tombstone (anti-catfish после
self-delete).

## Применение миграций

См. [railway-deploy.md](./railway-deploy.md).

## GUC `app.session_secret`

Используется в `admin_blocking_reject` для HMAC phone-hash.
Должен совпадать с `process.env.SESSION_SECRET`.

```sql
ALTER DATABASE railway SET app.session_secret = '<SECRET>';
-- проверка:
SELECT current_setting('app.session_secret', true);
```

После `ALTER DATABASE` существующие connections не получат значение — нужно reconnect.

## Backups

Railway Postgres даёт автоснимки. Через dashboard → Database → Backups → Restore.
PITR недоступен; granularity = дневной snapshot.

Для критичных операций (миграция, wipe) — делать manual snapshot ДО.
