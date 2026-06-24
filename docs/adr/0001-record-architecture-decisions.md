# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-06-20
- **Owner:** founder

## Context

Проект перешёл точку где технические развилки регулярны: pivot SMS→бот,
переход Supabase→pg, F-119/F-120 для модерации, security-аудит и т.д.
Без журнала каждая новая итерация переоткрывает уже сделанный выбор.

## Decision

Записываем все значимые технические решения как ADR в `docs/adr/`.
Формат: см. этот же шаблон.
Шаблон ADR — данный документ.

## Consequences

- (+) Новый разработчик / consultant быстро ловит контекст.
- (+) При peer-review можно ссылаться на принятое решение.
- (+) При re-evaluate можно проверить актуальны ли принципы.
- (−) Дополнительный шаг в флоу.

## Template для следующих ADR

```markdown
# ADR-NNNN: <Title>

- **Status:** Proposed | Accepted | Deprecated | Superseded by NNNN
- **Date:** YYYY-MM-DD
- **Owner:** ...

## Context
Что за проблема. Что было до. Почему сейчас.

## Decision
Что решили. Если рассматривалось несколько — кратко, почему отвергли.

## Consequences
+ положительные
+ положительные
− отрицательные (явно)
```
