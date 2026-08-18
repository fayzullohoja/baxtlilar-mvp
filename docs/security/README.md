# Security

Текущая поза + последние аудит-результаты.

Подробный отчёт ведётся в [`_audit/`](../../_audit/) (исторически в корне; не двигаем,
чтобы не ломать external links).

## Текущая поза (2026-06-20, статусы блокеров ниже сверены 2026-08-18)

**После 4 раундов adversarial verify (R1 → R2 → R3 → final):**

- Все P0 закрыты в коде (F-002, F-006..F-012, F-101..F-105, F-114, F-115, F-117..F-120).
- 12 verdict-CONFIRMED от R2/R3 закрыты атомарными RPC.
- C1+H8 split-window (atomic erase_user), H3 (start_token bind + jti single-use),
  H9/H10 (phone_hash derives внутри RPC), H11 (atomic export rate-limit), H12 (consents UNIQUE)
  — закрыты в `20260620800000_*`, `20260620900000_*`, `20260620920000_*`.
- Webhook secret теперь required в env.
- Bootstrap отвергает `lifecycle='blocked'|'deleted'`.

## Открытые блокеры для прод-биометрии (РУз)

Список составлен 2026-06-20. **Сверен с кодом 2026-08-18** - половина закрыта,
статусы ниже проставлены по факту, а не по бумаге.

| | Блокер | Статус на 18.08.2026 | Чем подтверждено |
|---|---|---|---|
| A1 | 2FA / TOTP для admin login | **частично** - механизм есть, но необязателен | `supabase/migrations/20260704030000_admin_totp.sql`, `/api/admin/totp/enroll`, `/api/admin/login/totp`. В `api/admin/login/route.ts:52` второй фактор требуется ТОЛЬКО если у админа заполнен `totp_secret`. Не завёл TOTP - входит по одному паролю. Осталось: сделать обязательным (хотя бы для роли super). |
| A2 | IP-allowlist | **открыт в коде приложения**, на уровне сервера не проверяли | Ограничения по IP на `/admin` в `src/proxy.ts` нет; слово «allowlist» в коде относится к Origin-проверке CSRF (F-010), это другое. Но на своём VPS такое обычно живёт в nginx/Caddy или в firewall - туда доступа не было, так что «нет вообще» утверждать нельзя. Проверить на сервере до того, как делать в коде. |
| A3 | Короткий TTL admin session + `force_logout_all` | **наполовину** | TTL сделан: `src/lib/admin/session.ts:9` - 8 часов (у пользователя 30 дней, это разные сессии), окно недо-логина 5 минут. Массового разлогина (`force_logout_all` / session epoch) нет - отозвать все сессии разом нечем. |
| A4 | Structured `reject_reason_dictionary` UZ/RU | **закрыт** | `supabase/migrations/20260627100300_admin_reason_templates.sql` + `src/lib/admin/load-reason-templates.ts`: таблица `admin_reason_templates`, коды и тексты RU/UZ, правит super-админ без релиза. Имя другое, чем в блокере, суть та. |

Итого к работе остаётся: обязательность TOTP (A1), IP-allowlist (A2) и массовый
разлогин админов (A3). A4 закрывать не нужно.

См. [`_audit/2026-06-19-security-audit.md`](../../_audit/2026-06-19-security-audit.md)
для полного punch-листа.

## Что в облаке (Notion)

Высокоуровневое: статус compliance, открытые юр-вопросы, контакты юриста,
non-technical audit summary для founder/legal/board.

## Что в repo (здесь)

Технические артефакты: миграции, RPC, конкретные коммиты, smoke-script'ы.
