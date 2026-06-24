"""Create Doc Standards & Audit page in Notion."""
import sys
sys.path.insert(0, "/tmp")
from md_to_notion import (
    api, md_to_blocks, append_blocks, create_page,
    callout, divider, parse_inline,
)

ROOT = "3838dc27-4fcc-8096-a6cc-c320d19addc9"

content = """
# Назначение

Этот документ — внутренний стандарт документации Baxtlilar и **аудит текущего состояния** на 2026-06-21. Цель: видеть **где сигнал, где вода**, и не плодить «Чат N».

---

# Таксономия — 2 оси

## Ось 1 — Тип контента

| Код | Тип | Что туда попадает |
|---|---|---|
| **BR** | Business Requirement | Что бизнесу нужно: целевые юзеры, монетизация, рынок |
| **SR** | System Requirement | Что софт должен делать (функц + нефункц) |
| **AD** | Architecture Decision | Технические решения с обоснованием (ADR) |
| **OP** | Operations / Runbook | Deploy, инциденты, DB ops |
| **LE** | Legal / Compliance | Юр-обязательства, ПД, оферты |
| **PS** | Product Strategy | Позиционирование, дифференциатор |
| **VD** | Visual / Design DNA | Бренд, концепции, типографика, motion |
| **UR** | User Research | Персоны, интервью, поведение |
| **DL** | Decision Log | Что решили + почему + когда |
| **RE** | Research Logs | Сырые research-артефакты |
| **HI** | Historical Spec | Старая версия, не активная |
| **GL** | Glossary / Concepts | Терминология, ментальные модели |
| **RM** | Roadmap | Sprint-план, фазы |

## Ось 2 — Lifecycle status

| Статус | Что значит | Действие |
|---|---|---|
| 🟢 Active | Ведёт текущую работу | Регулярно читаем, обновляем |
| 🟡 Reference | Историческое, иногда смотрим | НЕ редактируем, держим как archive |
| 🔴 Aspirational / Filler | Мечты или общие слова без конкретики | Помечаем, валидируем или дропаем |

---

# Аудит — где сигнал, где вода

> ⚠️ **Дисклеймер:** содержимое 13 Чатов спеки не прочитано полностью (миллионы знаков). Классифицирую по названиям, размерам, и контексту русскоязычных стартап-спек. Для точной оценки нужен deep-read workflow — см. ниже Recommendation.

## 🟢 Active — сейчас ведут работу

- **Strategy & Positioning** — PS. Только что зафиксировано в Discovery.
- **Personas (Тамара)** — UR. 1 персона, мало — но честно (не Cinderella).
- **Visual Direction + 3 концепции** — VD + DL. Reference-grounded.
- **IA & Flows** — SR + UR. Новая IA + 9-step onboarding rethink + verification strategy.
- **Decisions Log** — DL. 5 свежих решений.
- **Competitors DB** — UR + VD. Reference после Discovery.
- **ADR Index** (0001-0003) — AD. Реальный signal.
- **Runbooks** (railway-deploy, db-ops) — OP. Работают.
- **Tech Stack** — AD. Snapshot.
- **Security Audit Summary** — AD + SR. После 4 раундов adversarial verify.
- **LEGAL/Consents versions** — LE + SR. Конкретно.
- **LEGAL/РУз ПД-compliance + чек-лист** — LE. Конкретно с блокерами.
- **Архитектура и бизнес-процесс v1.0** — SR + AD + BR. Mixed, но active.

## 🟡 Reference — историческое archive

- **Reference v1 parent + 13 Чатов** — HI. Вся старая спека, держим, но НЕ редактируем.
- **Чат 12 (PRD+Backlog)** — HI + SR + BR. Было реалистично, теперь частично устарело (бот-pivot).
- **Чат 13 (Системные артефакты)** — HI + SR. Status maps + branding decisions старые.
- **Простыми словами TL;DR** — PS + GL. Как onboarding-doc для новичков ОК, но повторяет другие.
- **Discovery Logs** — RE. Снимок процесса, не для повторного чтения.

## 🔴 Aspirational / Filler — высокая вероятность «воды»

- **Чат 6 — Website** (186 MB!) — RM + BR. Сайт на MVP не строим → 80% мечты без действия.
- **Чат 9 — Partnerships** (22 MB) — RM + BR. Без подписанных LOI = wishlist.
- **Чат 4 — Premium** (8 MB) — BR + RM. Монетизация в Phase 2 → пока aspirational.
- **Чат 3 — Matching Алгоритм** (30 MB!) — SR + BR. Огромный размер подозрителен. Скорее всего 20% реальный алгоритм + 80% философия.
- **Чат 1 — Onboarding** (16 MB) — HI + SR. Частично устарело после бот-pivot (был SMS-flow). Требует пометки «obsolete sections».
- **Чат 10 — Analytics** (19 MB) — SR. Если там детальные метрики с порогами — signal. Если «будем измерять CR, retention…» без таргетов — FL.
- **Roadmap** — RM. Не заполнен (placeholder).
- **Design System** — VD. Placeholder до выбора концепта.
- **Mood Board** — VD. Placeholder до выбора концепта.
- **Решение учредителя 07.06.2026** — LE + DL. 30% воды (юр-вступление), 70% сигнала (OD-1..OD-20).
- **Публичная оферта draft v0.1** — LE. Не подписан юристом — пока aspirational.
- **Спецификация интеграции оферты** — LE + SR. Привязана к non-podpisannoy оферте.

---

# Что MISSING (по моей оценке должно бы быть)

- **Success metrics с targets** (CR онбординга, time-to-first-match, % одобрения паспортов) — BR + SR. Сейчас нет конкретики.
- **User interview notes** (реальные разговоры с 5-10 Тамарами) — UR. Только воображаемая персона.
- **Wireframes / mockups новых экранов** — VD. Нет.
- **ER-диаграмма БД (визуальная)** — AD. Нет (только код).
- **Glossary / Концепты** (что значит «verified», «matched», «pending» для новых hires) — GL. Нет.
- **Competitor positioning matrix** (price / feature / audience grid) — UR. Только DB-таблица.
- **Process map модерации паспортов end-to-end** — OP + BR. Нет.
- **Финансовая модель MVP** (unit economics, расходы Railway/eskiz, runway) — BR. Нет.
- **Marketing / Acquisition план** — BR + RM. Нет.
- **Incident playbook** (что делать когда бот лежит, БД легла) — OP. Только runbook деплоя.

---

# Recommendation

## Краткий план

1. **Запустить deep-read workflow** который параллельно прочитает все 13 Чатов и даст:
   - Реальное содержимое каждого (не догадки)
   - Точную классификацию с долей signal vs water
   - Список устаревших секций
   - Конкретные куски «вытащить в Active»: какие части старой спеки сейчас уместны
2. **После — консолидация:**
   - Чаты 1, 12, 13 → выжать в одну **«Source-of-truth Spec v2»** (живая, актуальная)
   - Чаты 3, 4, 6, 9 → пометить **🔴 Aspirational — pending validation**
   - Заполнить **Missing** список реальными артефактами
3. **Принять правило для будущего:**
   - Каждый новый док маркируется типом (BR/SR/AD/…) и lifecycle (🟢/🟡/🔴)
   - **Не пишем «Чат N»**, пишем атомарные документы с явным типом
   - При redesign mini-app — выпустить чистую spec v2 без всего хвоста

## Конвенции для будущих документов

- **Имя файла / страницы:** `[Тип] Название` (например, `[SR] Photo upload — 3 фото, sha-dedup`)
- **Frontmatter / Callout:** lifecycle 🟢/🟡/🔴 + дата создания + owner
- **Размер:** атомарный — 1 документ = 1 тема. Если >1000 блоков → split.
- **Ссылки:** на Decisions Log + ADR (для traceability)

## Правила «не воды»

- Каждое заявление с конкретикой (число/срок/имя) или маркируется явно как **гипотеза**
- Нет общих фраз типа «масштабируемая архитектура» без указания метрики
- Aspirational-разделы помечены 🔴 с пометкой «pending validation by [дата]»
"""

intro_blocks = [
    callout(
        "Внутренний стандарт + аудит текущего состояния документации. Используется для будущих документов: каждый новый док получает тип (BR/SR/AD/…) и lifecycle (🟢/🟡/🔴).",
        "🗂", "blue_background",
    ),
    callout(
        "Аудит на 2026-06-21 — основан на классификации 36 страниц Notion + 5 страниц repo docs/. Полный deep-read 13 Чатов спеки НЕ сделан — нужен отдельный workflow.",
        "⚠️", "yellow_background",
    ),
    divider(),
]

content_blocks = md_to_blocks(content)
all_blocks = intro_blocks + content_blocks
print(f"Total blocks: {len(all_blocks)}")

pid = create_page(ROOT, "🗂", "Doc Standards & Audit", all_blocks[:90])
if len(all_blocks) > 90:
    append_blocks(pid, all_blocks[90:])
print(f"→ {pid}")
