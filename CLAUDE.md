@AGENTS.md

# Baxtlilar — гайдрейлы для Claude Code

## Что это
Telegram Mini App для серьёзных знакомств в Узбекистане.
**Полные спеки:** `~/Desktop/Baxtlilar/` (Чат 1–13 + Excel-бэклог + пояснительная записка).
**План разработки:** `~/.claude/plans/sequential-popping-crayon.md`.

## Стек
- Next.js 16 (App Router, **async** cookies/headers/params; Server Actions возвращают void/Promise<void>)
- React 19 · TypeScript strict · Tailwind v4
- Supabase (Postgres + Storage) — service_role только на сервере, RLS off
- Auth: Telegram **initData (HMAC-SHA256)** + httpOnly cookie session
- next-intl 4 (RU/UZ) · Vitest · Zod
- Vercel (preview на каждый push + prod)

## 9 инвариантов (нельзя нарушать)
1. Контакты защищены: телефон/документы/селфи не в публичном API.
2. Согласие важнее денег (этап 2; архитектура закладывается сразу).
3. **approved ≠ published**: модератор одобряет, публикует пользователь.
4. Чат только по взаимному интересу.
5. Не свайп-дейтинг.
6. Без ярлыков (развод/дети/доход).
7. Действия админов логируются; чувствительные данные скрыты по умолчанию.
8. Смена статуса — **только через `transition()` с записью в `user_state_transitions`**.
9. Бренд: коралл `#E2526B` на белом; запреты — см. Чат 13 Часть 4.

## Чего НЕ делать
- Не запрашивать БД из браузера; только через server actions с `supabaseAdmin()`.
- Не bypass'ить `transition()` прямым UPDATE статусов.
- Не возвращать ошибки из server actions объектами — `redirect(...?error=...)`.
- Не класть секреты в `NEXT_PUBLIC_*` env-vars.

## Команды
```
pnpm dev          # локальный dev (Turbopack)
pnpm test         # vitest unit (watch)
pnpm test:run     # CI-режим (run once)
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm build        # next build
vercel dev        # с TG-webhook через preview tunnel
```

## Dev-флаги
- `DEV_BYPASS_TG=1` — пропустить HMAC initData в браузере (только локально).
- `SMS_PROVIDER=mock` — код `123456` принимается всегда.

## Порядок верификации MVP (важно!)
`телефон+OTP → паспорт → селфи → модерация → одобрено → анкета → опрос → active`
