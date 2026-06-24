# ADR-0002: Bot-based registration (no SMS-OTP)

- **Status:** Accepted
- **Date:** 2026-06-19
- **Owner:** founder + Claude

## Context

Изначальный flow: пользователь вводил телефон → SMS-OTP (через `eskiz.uz`) → подтверждение.
Проблемы:
- Прод оставался в `mock`-режиме (OTP=`123456`) → F-002 в security-аудите.
- F-101..F-105: race на parallel `sendOtp`, OTP не привязан к phone, SMS-bomb через
  ротацию номеров, mock-логирует phone+OTP plaintext.
- 6+ legal/abuse багов вокруг OTP-флоу.
- SMS-cost растёт линейно от пользовательской базы.
- Mini-app в браузере (вне TG) показывала весь онбординг до OTP — risk-surface огромный.

## Decision

Удалить SMS-OTP полностью. Регистрация — **через сам Telegram-бот**:

1. `/start` в боте → выбор языка (RU/UZ).
2. `request_contact` (TG нативная кнопка) — TG САМ присылает контакт с phone + user_id.
3. **Anti-катфиш guard:** `contact.user_id === sender.id` (нельзя зарегаться по чужому).
4. Inline-консент PD + биометрия → переход в mini-app через web_app кнопку с
   HMAC-токеном bound на `telegram_id`.
5. Mini-app в обычном браузере не запускается (welcome-fallback с deep-link на бота).

Архитектурно это:
- Закрывает F-002, F-101..F-105, F-117, F-004 одним движением.
- Phone верифицирован самим TG (нет SMS-цикла).
- Catfish защита baked-in.
- Mini-app становится post-bot только → security surface уменьшается.

## Consequences

- (+) Все SMS-related баги исчезают.
- (+) Phone верификация бесплатна.
- (+) Anti-катфиш атомарен (один TG-чек вместо нашей логики).
- (+) Mini-app в браузере НЕ открывается → меньше attack surface.
- (−) Регистрация ТОЛЬКО в Telegram (нет web fallback).
- (−) Onboarding split между ботом (4 шага) и мини-аппой (5+ шагов) — нужна
  согласованность state-machine между ними.
- (−) Если TG-бот лежит — регистрация лежит. Mitigation: webhook secret + Railway uptime.

## Реализация

- `src/lib/telegram/bot/handlers.ts` — webhook handler.
- `src/lib/telegram/start-token.ts` — HMAC-токен (telegram_id-bound + jti single-use,
  ADR-NNNN в будущем).
- `src/app/api/telegram/webhook/route.ts` — endpoint с `X-Telegram-Bot-Api-Secret-Token`.
- `src/app/api/auth/bootstrap/route.ts` — обмен initData + token на сессионный cookie.
- Миграция: `supabase/migrations/20260619100000_*.sql` (новые `bot_*` шаги в state machine).

## Supersedes

- Старые ADR/решения по SMS (если бы существовали).

## Related

- Security audit: `_audit/2026-06-19-security-audit.md` — закрытые F-***.
