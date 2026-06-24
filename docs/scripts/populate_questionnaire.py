"""Populate Notion with Foundational Questionnaire — 9 blocks + Q&A DB with 179 rows."""
import json, sys, time
sys.path.insert(0, "/tmp")
from md_to_notion import (
    api, md_to_blocks, append_blocks, create_page,
    callout, divider, parse_inline,
)

ROOT = "3838dc27-4fcc-8096-a6cc-c320d19addc9"

DATA = json.load(open("/private/tmp/claude-501/-Users-fayzullohoja-Desktop/16767afb-765f-413e-a40c-e8e93ab99655/tasks/wzg6vksig.output"))
r = DATA["result"]
blocks_data = r["organized"]["blocks"]
dep_notes = r["organized"]["dependency_notes"]
critic_summary = r["dedup"]["summary"]

# ──────────────────────────────────────────────────────────────────────
# 1) Top-level page
# ──────────────────────────────────────────────────────────────────────
print("=== Creating top-level page ===")
intro_blocks = [
    callout(
        "Вопросник — инструмент перевода Baxtlilar из режима «интуитивно строим» в режим «решения основаны на данных». 9 фокусных сессий, 179 вопросов. Результат — Decisions Log + Q&A Sessions DB = единый источник правды для всех product/design/eng решений.",
        "🔍", "purple_background",
    ),
    callout(
        f"Composer: 12 параллельных аналитиков → 347 raw questions → дедуп → 179 quality. Распределены в 9 блоков по 10-34 вопроса. Критик: {critic_summary[:300]}",
        "📊", "gray_background",
    ),
    divider(),
    {"object": "block", "type": "heading_1", "heading_1": {"rich_text": parse_inline("Правила использования")}},
    {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("Один заход = один блок. Не пытаться пройти всё за вечер — качество ответов упадёт после 90 минут.")}},
    {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("Все ответы → Q&A Sessions DB (см. ниже). Никаких ответов 'в голове'.")}},
    {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("Статусы вопросов: Answered / TBV (нужна проверка) / CONFLICT (разногласие) / BLOCKER (нужно ждать) / Skipped (с обоснованием).")}},
    {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("TBV-вопросы → назначить owner'а и deadline для acquisition (interview/research/data-pull).")}},
    {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("CONFLICT-вопросы → отдельная consensus-сессия (см. Truth-Finding Compass).")}},
    {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("Не пропускать prerequisites. Если блок зависит от предыдущего — закрыть предыдущий хотя бы на 80%.")}},
    divider(),
    {"object": "block", "type": "heading_1", "heading_1": {"rich_text": parse_inline("Блоки (рекомендуемый порядок)")}},
]

# Block index
for i, b in enumerate(blocks_data, 1):
    intro_blocks.append({
        "object": "block", "type": "bulleted_list_item",
        "bulleted_list_item": {"rich_text": parse_inline(
            f"{b['title']} — {len(b['questions'])} вопросов, {b['estimated_duration']}"
        )},
    })

intro_blocks.extend([
    divider(),
    {"object": "block", "type": "heading_1", "heading_1": {"rich_text": parse_inline("Dependency graph")}},
])
# Split dep notes into chunks (it's ~1500 chars)
for chunk_start in range(0, len(dep_notes), 1900):
    chunk = dep_notes[chunk_start:chunk_start + 1900]
    intro_blocks.append({
        "object": "block", "type": "paragraph",
        "paragraph": {"rich_text": parse_inline(chunk)},
    })

QUESTIONNAIRE = create_page(ROOT, "🔍", "Foundational Questionnaire", intro_blocks)
print(f"  → {QUESTIONNAIRE}")

# ──────────────────────────────────────────────────────────────────────
# 2) 9 Block pages
# ──────────────────────────────────────────────────────────────────────
print("\n=== Creating 9 block pages ===")
block_ids = []
BLOCK_EMOJIS = {1: "🏦", 2: "👥", 3: "⚙️", 4: "🎨", 5: "📦", 6: "🚪", 7: "📣", 8: "🖼️", 9: "🎯"}

for i, b in enumerate(blocks_data, 1):
    emoji = BLOCK_EMOJIS.get(i, "📋")
    page_blocks = [
        callout(b["purpose"], emoji, "blue_background"),
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Expected outcomes")}},
    ]
    for o in b.get("expected_outcomes", []):
        page_blocks.append({
            "object": "block", "type": "bulleted_list_item",
            "bulleted_list_item": {"rich_text": parse_inline(o)},
        })

    page_blocks.append({"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Duration & Prerequisites")}})
    page_blocks.append({
        "object": "block", "type": "bulleted_list_item",
        "bulleted_list_item": {"rich_text": parse_inline(f"Estimated: {b['estimated_duration']}")},
    })
    prereqs = b.get("prerequisites", [])
    if prereqs:
        for p in prereqs:
            page_blocks.append({
                "object": "block", "type": "bulleted_list_item",
                "bulleted_list_item": {"rich_text": parse_inline(f"Prerequisite: {p}")},
            })
    else:
        page_blocks.append({
            "object": "block", "type": "bulleted_list_item",
            "bulleted_list_item": {"rich_text": parse_inline("Prerequisites: нет — корневой блок")},
        })

    page_blocks.append(divider())
    page_blocks.append({"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Вопросы")}})

    for qi, q in enumerate(b["questions"], 1):
        # Question heading
        page_blocks.append({
            "object": "block", "type": "heading_3",
            "heading_3": {"rich_text": parse_inline(f"Q{qi}. {q['q']}")},
        })
        # Metadata callout
        meta_text = f"📌 Dimension: {q['dimension']}  ·  Source: {q['source']}  ·  Cost: {q['cost']}  ·  Unlocks: {q['unlocks']}"
        page_blocks.append({
            "object": "block", "type": "paragraph",
            "paragraph": {"rich_text": parse_inline(meta_text)},
        })

    # Cap if too many blocks (Notion ~1000)
    if len(page_blocks) > 1000:
        page_blocks = page_blocks[:1000] + [
            callout(
                f"⚠️ Страница обрезана. Полный список в Q&A Sessions DB → фильтруй по Block = '{b['title']}'.",
                "✂️", "yellow_background",
            ),
        ]

    pid = create_page(QUESTIONNAIRE, emoji, b["title"], page_blocks[:90])
    if len(page_blocks) > 90:
        append_blocks(pid, page_blocks[90:])
    block_ids.append((i, pid, b["title"]))
    print(f"  Block {i}: {pid} ({len(b['questions'])} questions, {len(page_blocks)} blocks)")

# ──────────────────────────────────────────────────────────────────────
# 3) Truth-Finding Compass page
# ──────────────────────────────────────────────────────────────────────
print("\n=== Creating Truth-Finding Compass ===")
tfc_blocks = [
    callout(
        "Что делать когда сессия выявила TBV / CONFLICT / BLOCKER. Эти механики гарантируют что мы НЕ замораживаем неподтверждённое решение как факт.",
        "🧭", "purple_background",
    ),
    {"object": "block", "type": "heading_1", "heading_1": {"rich_text": parse_inline("TBV — To Be Verified")}},
    {"object": "block", "type": "paragraph", "paragraph": {"rich_text": parse_inline(
        "Если ответ — гипотеза без данных, статус ставится TBV. Назначается owner + deadline для acquisition: интервью, market research, load-test, data-pull. До закрытия TBV — решение НЕ принимается как факт."
    )}},
    {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Acquisition типы")}},
    {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Customer interview — 5-10 человек из ICP, 30-60 мин каждое, semi-structured")}},
    {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Market research — отчёты Stat.uz, Yandex Wordstat, эксперты УЗ-рынка")}},
    {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Data pull — текущая БД, GA/Mixpanel, Railway метрики")}},
    {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Technical audit — code review, load test, security audit")}},
    {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Legal consultation — 1-2 встречи с юристом РУз")}},
    divider(),
    {"object": "block", "type": "heading_1", "heading_1": {"rich_text": parse_inline("CONFLICT — Разногласие")}},
    {"object": "block", "type": "paragraph", "paragraph": {"rich_text": parse_inline(
        "Если два участника дают противоречивые ответы (founder vs CTO vs designer) — фиксируется CONFLICT с обоими ответами. Назначается отдельная consensus-сессия."
    )}},
    {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Consensus-сессия формат")}},
    {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("Каждая сторона объясняет позицию + источник информации (5 мин)")}},
    {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("Ищем третий вариант или критерий измерения")}},
    {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("Если нет третьего — founder принимает решение, оба варианта в Decisions Log с пометкой")}},
    {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("Возвращаемся к этому вопросу через 1 месяц для re-evaluation")}},
    divider(),
    {"object": "block", "type": "heading_1", "heading_1": {"rich_text": parse_inline("BLOCKER")}},
    {"object": "block", "type": "paragraph", "paragraph": {"rich_text": parse_inline(
        "Если ответ зависит от внешнего лица/документа/данных, к которым нет доступа — статус BLOCKER. Owner = тот, кто может разблокировать (юрист, бухгалтер, KUCH, потенциальный инвестор)."
    )}},
    {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Best practices")}},
    {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Не блокировать всю сессию из-за 1 BLOCKER — фиксировать, идти дальше")}},
    {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("BLOCKER без owner + deadline — не блокер, а провал")}},
    {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Раз в неделю — review всех BLOCKER, eскалация если >2 недель")}},
    divider(),
    {"object": "block", "type": "heading_1", "heading_1": {"rich_text": parse_inline("Антипаттерны")}},
    {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("«Я знаю» вместо данных — если нет источника, ставим TBV")}},
    {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Двигаться дальше с CONFLICT — оба варианта будут в коде, потом неконсистентность")}},
    {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("BLOCKER без deadline — застрянет навсегда")}},
    {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Бесконечный 'нужно подумать ещё' — назначить decision deadline")}},
]
TRUTH_COMPASS = create_page(QUESTIONNAIRE, "🧭", "Truth-Finding Compass", tfc_blocks)
print(f"  → {TRUTH_COMPASS}")

# ──────────────────────────────────────────────────────────────────────
# 4) Q&A Sessions Database
# ──────────────────────────────────────────────────────────────────────
print("\n=== Creating Q&A Sessions Database ===")
db_payload = {
    "parent": {"page_id": QUESTIONNAIRE},
    "icon": {"emoji": "🗃"},
    "title": [{"text": {"content": "Q&A Sessions Log"}}],
    "properties": {
        "Question": {"title": {}},
        "Block": {"select": {"options": [
            {"name": b["title"], "color": "default"} for b in blocks_data
        ]}},
        "Dimension": {"select": {"options": [
            {"name": d, "color": "default"} for d in set(
                q["dimension"] for b in blocks_data for q in b["questions"]
            )
        ]}},
        "Source": {"select": {"options": [
            {"name": s, "color": "default"} for s in
            ["founder", "customer-discovery", "market-research", "data-lookup", "team-input", "legal", "technical-audit"]
        ]}},
        "Cost": {"select": {"options": [
            {"name": "S", "color": "green"},
            {"name": "M", "color": "yellow"},
            {"name": "L", "color": "orange"},
            {"name": "XL", "color": "red"},
        ]}},
        "Status": {"select": {"options": [
            {"name": "Pending", "color": "gray"},
            {"name": "Answered", "color": "green"},
            {"name": "TBV", "color": "yellow"},
            {"name": "CONFLICT", "color": "red"},
            {"name": "BLOCKER", "color": "orange"},
            {"name": "Skipped", "color": "default"},
        ]}},
        "Owner": {"rich_text": {}},
        "Answer": {"rich_text": {}},
        "Deadline": {"date": {}},
        "Unlocks": {"rich_text": {}},
    },
}
db_resp = api("/databases", db_payload)
DB_QA = db_resp["id"]
print(f"  → {DB_QA}")

# ──────────────────────────────────────────────────────────────────────
# 5) Pre-populate DB with 179 questions
# ──────────────────────────────────────────────────────────────────────
print("\n=== Populating 179 questions ===")
total_q = sum(len(b["questions"]) for b in blocks_data)
done = 0
for b in blocks_data:
    for q in b["questions"]:
        api("/pages", {
            "parent": {"database_id": DB_QA},
            "properties": {
                "Question": {"title": [{"text": {"content": q["q"][:1900]}}]},
                "Block": {"select": {"name": b["title"]}},
                "Dimension": {"select": {"name": q["dimension"]}},
                "Source": {"select": {"name": q["source"]}},
                "Cost": {"select": {"name": q["cost"]}},
                "Status": {"select": {"name": "Pending"}},
                "Unlocks": {"rich_text": [{"text": {"content": q["unlocks"][:1900]}}]},
            },
        })
        done += 1
        if done % 20 == 0:
            print(f"  ... {done}/{total_q}")

print(f"\n=== ALL DONE — {done} questions, 9 blocks, 1 Truth-Compass, 1 DB ===")
print(f"PARENT: {QUESTIONNAIRE}")
print(f"DB: {DB_QA}")
print(f"TFC: {TRUTH_COMPASS}")
print("BLOCKS:")
for i, pid, title in block_ids:
    print(f"  {i}: {pid} — {title}")
