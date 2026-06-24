# Notion workspace IDs

Этот файл — pointer'ы на страницы Notion для быстрого доступа из будущих сессий.
Токен в `.env.access` (gitignored). Page IDs не секретны — без токена бесполезны.

## Корни

| Ключ | ID | Назначение |
|---|---|---|
| `ROOT` | `3838dc27-4fcc-8096-a6cc-c320d19addc9` | Существующая страница «Mini App Baxtlilar 1.0.0» (spec v1) — не трогать |
| `HOME` | `3898dc27-4fcc-81e8-914c-c429fa04f88b` | 🏠 Home — Baxtlilar v2 (overview/TOC) |

## Top-level редизайн-папки

| Ключ | ID | Заголовок |
|---|---|---|
| `PRODUCT` | `3898dc27-4fcc-81d1-876d-f08ef91f9f51` | 📋 Product |
| `DESIGN` | `3898dc27-4fcc-816c-97b2-da5f02caae69` | 🎨 Design |
| `ENGINEERING` | `3898dc27-4fcc-81e8-8b80-d53d885f950a` | ⚙️ Engineering |
| `LEGAL` | `3898dc27-4fcc-8147-87e2-e57e5da69704` | 📜 Legal & Compliance |

## Product/*

| Ключ | ID | Заголовок |
|---|---|---|
| `PRODUCT_STRATEGY` | `3898dc27-4fcc-8100-ae40-f0d9bba77952` | 🎯 Strategy & Positioning |
| `PRODUCT_DISCOVERY` | `3898dc27-4fcc-8148-9144-e8e7649b6cf4` | 🔬 Discovery Logs |
| `PRODUCT_PERSONAS` | `3898dc27-4fcc-8180-9d0d-d890a5494a39` | 👥 Personas |
| `PRODUCT_ROADMAP` | `3898dc27-4fcc-8175-96c4-cb119432471e` | 🗺️ Roadmap |

## Design/*

| Ключ | ID | Заголовок |
|---|---|---|
| `DESIGN_SYSTEM` | `3898dc27-4fcc-811b-8bbf-c1d56446aa9f` | 🧱 Design System |
| `DESIGN_VISUAL` | `3898dc27-4fcc-815e-8a12-f9adeb8122e9` | 🖼️ Visual Direction |
| `DESIGN_IA` | `3898dc27-4fcc-81f1-8110-d20d86a22bdc` | 🧭 IA & Flows |
| `DESIGN_MOOD` | `3898dc27-4fcc-8159-b494-e431884c87a6` | 🎭 Mood Board |

## Engineering/*

| Ключ | ID | Заголовок |
|---|---|---|
| `ENG_ADR` | `3898dc27-4fcc-815e-86f7-cde9808280d3` | 🏛️ ADR Index |
| `ENG_SECURITY` | `3898dc27-4fcc-8147-87d5-d54e9b016001` | 🛡️ Security Audit Summary |
| `ENG_RUNBOOKS` | `3898dc27-4fcc-81c6-9aea-c0454d327296` | 📚 Runbooks |
| `ENG_STACK` | `3898dc27-4fcc-81aa-9f7c-ec272f3f04b4` | 🧰 Tech Stack |

## Legal/*

| Ключ | ID | Заголовок |
|---|---|---|
| `LEGAL_PD` | `3898dc27-4fcc-8145-9e71-cd878b7cbf4e` | 🇺🇿 РУз ПД-compliance status |
| `LEGAL_CONSENTS` | `3898dc27-4fcc-815a-a191-c710015a2090` | 📝 Consents versions |

## Databases

| Ключ | ID | Заголовок | Колонки |
|---|---|---|---|
| `DB_COMPETITORS` | `3898dc27-4fcc-8141-8397-fd2d4db171d7` | 🏛️ Competitors | Name (title), Category, Region, Verified ID required, Visual feel, What to steal, What to avoid, Decode link |
| `DB_DECISIONS` | `3898dc27-4fcc-8160-8a34-eedf0d3b6eff` | 🤝 Decisions Log | Decision (title), Date, Status, Type (Product/Design/ADR/Business/Legal), Owner, Context, Consequences |

## Visual Direction concepts (children of `DESIGN_VISUAL`)

| Ключ | ID | Заголовок |
|---|---|---|
| `CONCEPT_A_EDITORIAL` | `3898dc27-4fcc-81ba-885e-c01ba44ced6e` | 📰 A. Editorial Premium |
| `CONCEPT_B_QUIET` | `3898dc27-4fcc-8146-8b5f-e3616cbf1f15` | 🌙 B. Quiet Confidence |
| `CONCEPT_C_TASHKENT` | `3898dc27-4fcc-81d7-8a68-c2eccf6ed35e` | 🏛️ C. Tashkent Modernist |

## Reference v1 (Original Spec) — children of `PRODUCT`

Полный объём оригинальной спеки MVP. Конвертировано из .docx через pandoc.
Оригинальные файлы лежат на `~/Desktop/Все файлы/02. Baxtlilar/`.

| Ключ | ID | Заголовок |
|---|---|---|
| `REF_V1` | `3898dc27-4fcc-81b4-94a7-d18ec89efb1b` | 📚 Reference v1 (Original Spec) — parent |
| `CHAT_1` | `3898dc27-4fcc-81c6-8cbb-eb308512f0ff` | 🚪 Чат 1 — Onboarding |
| `CHAT_2` | `3898dc27-4fcc-81ef-bdd9-fe90004f6888` | 📋 Чат 2 — Анкета |
| `CHAT_3` | `3898dc27-4fcc-8181-bc7b-ce80380a9be0` | 💞 Чат 3 — Matching - Алгоритм |
| `CHAT_4` | `3898dc27-4fcc-81c9-b06c-cc8b7ed2c5d8` | 💎 Чат 4 — Premium |
| `CHAT_5` | `3898dc27-4fcc-8104-ae64-dd6ff948cf60` | 🛡 Чат 5 — Safety - Trust system |
| `CHAT_6` | `3898dc27-4fcc-8127-b843-c9609800bb48` | 🌐 Чат 6 — Website - Сайт Baxtlilar |
| `CHAT_7` | `3898dc27-4fcc-8138-ae82-edd4fc97582e` | 👮 Чат 7 — Admin Panel |
| `CHAT_8` | `3898dc27-4fcc-81d6-822e-d582b832571f` | ⚖️ Чат 8 — Legal - Юридическая часть |
| `CHAT_9` | `3898dc27-4fcc-8106-8678-d15ea74c8c42` | 🤝 Чат 9 — Partnerships |
| `CHAT_10` | `3898dc27-4fcc-818b-b34d-ccba367390b0` | 📊 Чат 10 — Analytics - Метрики |
| `CHAT_11` | `3898dc27-4fcc-81be-bcb9-dc39f7538a71` | 🔄 Чат 11 — Бизнес-процессы |
| `CHAT_12` | `3898dc27-4fcc-81b9-9fdf-e5ff7618b560` | 📐 Чат 12 — PRD и Backlog MVP |
| `CHAT_13` | `3898dc27-4fcc-8154-a46e-c26e8e81aa40` | 🎨 Чат 13 — Системные артефакты MVP |

## Standalone docs (siblings под parent'ами)

| Ключ | ID | Parent | Заголовок |
|---|---|---|---|
| `PROSTYMI_SLOVAMI` | `3898dc27-4fcc-81ae-9686-d67992f3c627` | PRODUCT | 📖 Простыми словами (TL;DR) |
| `OWNER_DECISION` | `3898dc27-4fcc-81b0-bc32-e01f156273fe` | LEGAL | 📜 Решение учредителя 07.06.2026 (OD-1..OD-20) |
| `ARCH_V1` | `3898dc27-4fcc-8132-a776-dee7a19ea17a` | ENGINEERING | 🏗 Архитектура и бизнес-процесс v1.0 |
| `OFFER_INTEG_SPEC` | `3898dc27-4fcc-819f-a15e-dbb16289d5d0` | LEGAL | ⚖️ Спецификация интеграции оферты |
| `PUBLIC_OFFER_DRAFT` | `3898dc27-4fcc-8133-bc00-dd5c3538662c` | LEGAL | 📝 Публичная оферта — черновик v0.1 |

## Использование из новой сессии

```bash
source <(grep ^NOTION_TOKEN /Users/fayzullohoja/Code/baxtlilar/.env.access)

# GET страницу
curl -sS -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  https://api.notion.com/v1/blocks/<PAGE_ID>/children

# POST блоки в страницу
curl -sS -X PATCH -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{"children":[{"type":"paragraph", ...}]}' \
  https://api.notion.com/v1/blocks/<PAGE_ID>/children
```

## Правила

- Не редактировать страницы под `ROOT` напрямую — это spec v1.
- Не удалять страницы напрямую через API (Notion soft-delete; восстановление муторное).
- Все новые продуктовые решения → `DB_DECISIONS` с типом + контекстом + последствиями.
- Все компетиторы декодированные → `DB_COMPETITORS`.
