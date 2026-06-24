# Notion population scripts

Скрипты для разовых ETL-операций: репо/файлы Desktop → Notion workspace.

⚠️ Содержат **page IDs**, привязанные к workspace «Fayzullohoja Rikhsikhujaev's Space».
Если workspace меняется — переписать IDs из [../notion-workspace.md](../notion-workspace.md).

⚠️ Токен берётся из `.env.access` (gitignored). В коде токен hardcoded для скорости — НЕ публиковать в открытый репозиторий.

## Файлы

| Файл | Назначение |
|---|---|
| [md_to_notion.py](md_to_notion.py) | Конвертер markdown → Notion blocks + Notion API client (используется как библиотека) |
| [populate_notion.py](populate_notion.py) | Первичный заход: Home + Strategy + Personas + Visual Direction (3 concepts) + IA + Discovery Logs + Competitors DB + Decisions Log из Discovery-workflow output |
| [populate_all.py](populate_all.py) | Полный объём: 14 Чатов (.docx → markdown), standalone docs, Engineering pages, Legal pages |

## Запуск

```bash
# первичный заход — только если структура Notion пустая
python3 docs/scripts/populate_notion.py

# полная миграция документов
python3 docs/scripts/populate_all.py
```

## Когда использовать

- Свежий workspace → весь объём за один прогон
- Обновление **только** strategy/personas → правка `populate_notion.py` + запуск
- Добавить новый чат → правка `populate_all.py` или ad-hoc Python с импортом `md_to_notion`

## Зависимости

- Python 3.8+
- `pandoc` (для .docx → markdown) — `brew install pandoc`
- Сетевой доступ к api.notion.com

## Не делает

- Не загружает оригинальные .docx как attachments (Notion file upload API ограничен 5MB; наши файлы до 195MB). Источник указан как callout с путём к локальному файлу.
- Не загружает картинки из .docx (вместо них — placeholder "[изображение из docx — см. оригинал]").
- Не делает diff/idempotent-update — каждый запуск пересоздаёт страницы. Для idempotent нужно сравнение хешей.
