# PgBouncer на Railway (DB-1) — инфра-шаг

Код приложения уже pooler-ready (2026-07-03): GUC'и на роли (миграция
`20260703020000_db1_role_gucs.sql`), `PG_POOL_MAX`, `DATABASE_DIRECT_URL` в env.
Остался деплой самого пулера — шаг в Railway-дашборде (≈15 минут).

## Зачем

Один Node-инстанс держит до `PG_POOL_MAX` (15) коннектов — этого хватает, пока
SSE-чат поллит БД (DBS-01). После DB-3 (LISTEN/NOTIFY) и/или при росте числа
инстансов пулер станет обязательным: Railway Postgres по умолчанию
`max_connections=100`, и без transaction-mode пулера коннекты кончаются первыми.

## Шаги (Railway dashboard)

1. **New Service → Docker Image** → `bitnami/pgbouncer:latest` в том же проекте.
2. Env сервиса pgbouncer:
   - `POSTGRESQL_HOST` = internal-хост Postgres (`*.railway.internal`)
   - `POSTGRESQL_PORT` = 5432
   - `POSTGRESQL_USERNAME` / `POSTGRESQL_PASSWORD` / `POSTGRESQL_DATABASE` — из DATABASE_URL
   - `PGBOUNCER_PORT` = 6543
   - `PGBOUNCER_POOL_MODE` = `transaction`
   - `PGBOUNCER_DEFAULT_POOL_SIZE` = 20 (≥ PG_POOL_MAX)
   - `PGBOUNCER_MAX_CLIENT_CONN` = 200
   - `PGBOUNCER_IGNORE_STARTUP_PARAMETERS` = `extra_float_digits,options`
3. Env веб-сервиса:
   - `DATABASE_DIRECT_URL` = текущий DATABASE_URL (прямой :5432)
   - `DATABASE_URL` = `postgresql://<user>:<pass>@<pgbouncer>.railway.internal:6543/<db>`
4. Redeploy web.

## Проверка приёмки (DB-1)

```sql
-- через pooled-коннект приложения:
show statement_timeout;      -- 10s (role-GUC доехал через пулер)
select count(*) from pg_stat_activity where application_name = 'baxtlilar-web';
-- под нагрузкой не превышает PG_POOL_MAX+DEFAULT_POOL_SIZE-запас
```

Медленный запрос (`select pg_sleep(15)`) должен быть убит на 10-й секунде.

## Ограничения transaction-mode (уже учтены в коде)

- Нет session-GUC через connection options → перенесены на роль (миграция db1).
- Нет `LISTEN/NOTIFY` через пулер → будущий чат-листенер (DB-3) обязан ходить
  по `DATABASE_DIRECT_URL`.
- Нет server-side prepared statements между транзакциями — node-pg по
  умолчанию их не использует (unnamed statements), PostgREST-слоя нет.
- Миграции гонять по `DATABASE_DIRECT_URL`; тяжёлые начинать с
  `set statement_timeout = 0;` (role-GUC 10s наследуется и psql-сессией).
