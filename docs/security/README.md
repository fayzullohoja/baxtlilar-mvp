# Security

Текущая поза + последние аудит-результаты.

Подробный отчёт ведётся в [`_audit/`](../../_audit/) (исторически в корне; не двигаем,
чтобы не ломать external links).

## Текущая поза (2026-06-20)

**После 4 раундов adversarial verify (R1 → R2 → R3 → final):**

- Все P0 закрыты в коде (F-002, F-006..F-012, F-101..F-105, F-114, F-115, F-117..F-120).
- 12 verdict-CONFIRMED от R2/R3 закрыты атомарными RPC.
- C1+H8 split-window (atomic erase_user), H3 (start_token bind + jti single-use),
  H9/H10 (phone_hash derives внутри RPC), H11 (atomic export rate-limit), H12 (consents UNIQUE)
  — закрыты в `20260620800000_*`, `20260620900000_*`, `20260620920000_*`.
- Webhook secret теперь required в env.
- Bootstrap отвергает `lifecycle='blocked'|'deleted'`.

## Открытые блокеры для прод-биометрии (РУз)

- A1: Нет 2FA / TOTP для admin login
- A2: Нет IP-allowlist
- A3: Нет короткого TTL admin session + force_logout_all
- A4: Нет structured `reject_reason_dictionary` UZ/RU

См. [`_audit/2026-06-19-security-audit.md`](../../_audit/2026-06-19-security-audit.md)
для полного punch-листа.

## Что в облаке (Notion)

Высокоуровневое: статус compliance, открытые юр-вопросы, контакты юриста,
non-technical audit summary для founder/legal/board.

## Что в repo (здесь)

Технические артефакты: миграции, RPC, конкретные коммиты, smoke-script'ы.
