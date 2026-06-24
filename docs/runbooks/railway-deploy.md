# Runbook: Railway deploy

## Стандартный путь

Railway автодеплоит `main` после push. Шаги:

1. Локально:
   ```
   pnpm typecheck && pnpm lint && pnpm test:run
   ```
2. `git push origin main` → Railway получает webhook → билд.
3. Логи билда: `railway logs --json` или dashboard.
4. Health-check после деплоя:
   ```
   curl -sS https://baxtlilar-mvp-production.up.railway.app/api/health
   ```
   Ожидается `200`.

## Сколько ждать

- Билд + start: **2–3 минуты**.
- Если health не отвечает за 5 мин — что-то не так, см. ниже.

## Откат

```bash
git revert <hash>
git push origin main
```
Или через Railway dashboard: Deployments → `Previous` → `Redeploy`.

## Применение миграций БД

Миграции в `supabase/migrations/` (название историческое, это просто SQL).
Применяются **вручную** до push'а кода, чтобы новый код не упал на отсутствующих
схемах:

```bash
psql 'postgresql://postgres:...@thomas.proxy.rlwy.net:26164/railway' \
  -v ON_ERROR_STOP=1 \
  -f supabase/migrations/YYYYMMDD_name.sql
```

⚠️ **DESTRUCTIVE migrations** (DROP, TRUNCATE) — отдельный аудит и снимок БД ДО.

## Env vars (Railway)

Управляются через Railway dashboard → Variables. Обязательные:

| Var | Описание |
|---|---|
| `DATABASE_URL` | Internal Postgres URL |
| `SESSION_SECRET` | ≥32 chars, для cookies + token HMAC |
| `TELEGRAM_BOT_TOKEN` | от @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | ≥16 chars, секрет в `setWebhook(secret_token=...)` |
| `BOT_USERNAME` | `baxtlilar_uz_bot` |
| `APP_URL` | `https://baxtlilar-mvp-production.up.railway.app` |
| `STORAGE_DIR` | путь к Volume mount, дефолт `.storage` |

GUC в БД (один раз, после `SESSION_SECRET` обновлений):
```sql
ALTER DATABASE railway SET app.session_secret = '<SECRET>';
```

## Smoke-чеки после деплоя

```bash
# Health
curl -sS -o /dev/null -w "%{http_code}\n" /api/health  # → 200

# Webhook secret (должен 401 без заголовка)
curl -sS -X POST /api/telegram/webhook  # → 401

# Bootstrap (должен 401 без start_param)
curl -sS -X POST -H "Origin: <APP_URL>" -H "Content-Type: application/json" \
  -d '{"initData":"x"}' /api/auth/bootstrap  # → 401

# Origin check (без Origin → 403)
curl -sS -X POST -H "Content-Type: application/json" -d '{}' /api/account  # → 403
```

Все 4 — non-200 = healthy.
