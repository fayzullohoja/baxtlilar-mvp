# Architecture Decision Records

ADR — короткая запись о технической решении: контекст, варианты, выбор, последствия.
Живут в коде потому что меняются ВМЕСТЕ с кодом и должны быть под версионным контролем.
Продуктовые решения — в Notion → Decisions Log.

## Формат

`NNNN-kebab-case-title.md`, статус: `Proposed | Accepted | Deprecated | Superseded by NNNN`.

Шаблон: [0001-record-architecture-decisions.md](0001-record-architecture-decisions.md).

## Индекс

| # | Title | Status | Date |
|---|---|---|---|
| 0001 | Record architecture decisions | Accepted | 2026-06-20 |
| 0002 | Bot-based registration (no SMS-OTP) | Accepted | 2026-06-19 |
| 0003 | Native pg adapter instead of Supabase | Accepted | 2026-05-15 |

## Правила

- Новая значимая техническая развилка → новая ADR.
- Старая ADR не редактируется по содержанию — только статус (`Superseded by 00NN`).
- Решение **продуктовое** (UX, business logic, фичи) → Notion → Product → Decisions Log.
