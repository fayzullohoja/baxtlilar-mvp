"""Populate Notion redesign workspace with Discovery output."""
import json, urllib.request, urllib.error, sys

TOKEN = __import__("os").environ.get("NOTION_TOKEN") or open("/Users/fayzullohoja/Code/baxtlilar/.env.access").read().split("NOTION_TOKEN=")[1].split("\n")[0].strip()
DISCOVERY = "/private/tmp/claude-501/-Users-fayzullohoja-Desktop/16767afb-765f-413e-a40c-e8e93ab99655/tasks/whq2c53r0.output"

# Page IDs from docs/notion-workspace.md
P = {
    "HOME": "3898dc27-4fcc-81e8-914c-c429fa04f88b",
    "PRODUCT": "3898dc27-4fcc-81d1-876d-f08ef91f9f51",
    "DESIGN": "3898dc27-4fcc-816c-97b2-da5f02caae69",
    "PRODUCT_STRATEGY": "3898dc27-4fcc-8100-ae40-f0d9bba77952",
    "PRODUCT_DISCOVERY": "3898dc27-4fcc-8148-9144-e8e7649b6cf4",
    "PRODUCT_PERSONAS": "3898dc27-4fcc-8180-9d0d-d890a5494a39",
    "DESIGN_VISUAL": "3898dc27-4fcc-815e-8a12-f9adeb8122e9",
    "DESIGN_IA": "3898dc27-4fcc-81f1-8110-d20d86a22bdc",
    "DB_COMPETITORS": "3898dc27-4fcc-8141-8397-fd2d4db171d7",
    "DB_DECISIONS": "3898dc27-4fcc-8160-8a34-eedf0d3b6eff",
}

data = json.load(open(DISCOVERY))
result = data["result"]
syn = result["synthesis"]


def api(path, payload, method="POST"):
    req = urllib.request.Request(
        f"https://api.notion.com/v1{path}",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"ERR {e.code} {path}: {body[:500]}", file=sys.stderr)
        raise


# Block builders
def chunks(text, max_len=1900):
    """Split text to fit Notion 2000-char limit on rich_text content."""
    out, buf = [], ""
    for word in text.split(" "):
        if len(buf) + len(word) + 1 > max_len:
            out.append(buf.rstrip())
            buf = word + " "
        else:
            buf += word + " "
    if buf.strip():
        out.append(buf.rstrip())
    return out


def rt(content, bold=False, italic=False, code=False):
    return {
        "type": "text",
        "text": {"content": content},
        "annotations": {
            "bold": bold,
            "italic": italic,
            "code": code,
            "strikethrough": False,
            "underline": False,
            "color": "default",
        },
    }


def p(content):
    return {
        "object": "block",
        "type": "paragraph",
        "paragraph": {"rich_text": [rt(c)] if (c := str(content))[:1] else []},
    }


def para(text):
    """Paragraph that handles long text by chunking."""
    blocks = []
    for ch in chunks(text):
        blocks.append({
            "object": "block",
            "type": "paragraph",
            "paragraph": {"rich_text": [rt(ch)]},
        })
    return blocks


def h1(t): return {"object": "block", "type": "heading_1", "heading_1": {"rich_text": [rt(t)]}}
def h2(t): return {"object": "block", "type": "heading_2", "heading_2": {"rich_text": [rt(t)]}}
def h3(t): return {"object": "block", "type": "heading_3", "heading_3": {"rich_text": [rt(t)]}}
def bullet(t):
    blocks = []
    text_chunks = chunks(t)
    blocks.append({
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {"rich_text": [rt(text_chunks[0])]},
    })
    # If overflow — make subsequent chunks as nested paragraphs (can't, just append more bullets at root)
    for extra in text_chunks[1:]:
        blocks.append({
            "object": "block",
            "type": "bulleted_list_item",
            "bulleted_list_item": {"rich_text": [rt("  " + extra)]},
        })
    return blocks


def callout(t, emoji="💡", color="default_background"):
    return {
        "object": "block",
        "type": "callout",
        "callout": {
            "icon": {"emoji": emoji},
            "color": color,
            "rich_text": [rt(chunks(t)[0])],
        },
    }


def quote(t):
    return {"object": "block", "type": "quote", "quote": {"rich_text": [rt(chunks(t)[0])]}}


def divider():
    return {"object": "block", "type": "divider", "divider": {}}


def append_blocks(page_id, blocks):
    """Append blocks to page in chunks of 100."""
    for i in range(0, len(blocks), 100):
        api(f"/blocks/{page_id}/children", {"children": blocks[i:i + 100]}, "PATCH")


def clear_page(page_id):
    """Get and delete all children of page."""
    res = api(f"/blocks/{page_id}/children?page_size=100", {}, "GET").get("results", [])
    for b in res:
        try:
            api(f"/blocks/{b['id']}", {}, "DELETE")
        except Exception:
            pass


def update_title(page_id, title, emoji=None):
    payload = {"properties": {"title": {"title": [{"text": {"content": title}}]}}}
    if emoji:
        payload["icon"] = {"emoji": emoji}
    api(f"/pages/{page_id}", payload, "PATCH")


# We use GET for blocks
def api_get(path):
    req = urllib.request.Request(
        f"https://api.notion.com/v1{path}",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Notion-Version": "2022-06-28",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def get_children(page_id):
    return api_get(f"/blocks/{page_id}/children?page_size=100").get("results", [])


def del_block(block_id):
    req = urllib.request.Request(
        f"https://api.notion.com/v1/blocks/{block_id}",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Notion-Version": "2022-06-28",
        },
        method="DELETE",
    )
    try:
        urllib.request.urlopen(req, timeout=15)
    except Exception as e:
        print(f"  del fail {block_id}: {e}", file=sys.stderr)


def reset_page(page_id):
    """Clear all child blocks before re-populating."""
    for b in get_children(page_id):
        del_block(b["id"])


def child_page(parent_id, emoji, title, blocks):
    payload = {
        "parent": {"page_id": parent_id},
        "icon": {"emoji": emoji},
        "properties": {"title": {"title": [{"text": {"content": title}}]}},
    }
    if blocks:
        payload["children"] = blocks[:100]
    r = api("/pages", payload)
    pid = r["id"]
    if len(blocks) > 100:
        append_blocks(pid, blocks[100:])
    return pid


# ──────────────────────────────────────────────────────────────────────
# 1) HOME — overview + DNA
# ──────────────────────────────────────────────────────────────────────
print("Populating HOME...")
reset_page(P["HOME"])

home_blocks = [
    callout(
        "Baxtlilar v2 — серьёзный редизайн mini-app. Это рабочее пространство. Существующая spec v1 (1. Онбординг, 2. Анкета, Экраны 1-13) — выше; не трогаем.",
        "🚧", "blue_background"
    ),
    h1("DNA проекта"),
    h2("Кто пользователь"),
    *para("Ташкент 22-32, образованные средний+ класс. Универ (WIUT/INHA), IT/банки/консалтинг, билингва RU/UZ с уклоном в RU. Доход $700-2500. Брезгует Мамбой — «не для меня»."),
    h2("Что должен почувствовать в 30 секунд"),
    *para("«О, здесь взрослые и серьёзные люди» — premium-trust direction. Editorial типографика, высокие фото, верификация на виду, без эмодзи."),
    h2("Главное отличие от Mamba/Badoo/Tinder в УЗ"),
    *para("Обязательная верификация личности + репутация. Никаких фейков, ботов, «kb». Каждый — подтверждённый человек. Badge на профиле. Build всё общение на этом."),
    h2("Скоуп редизайна"),
    *para("UI/UX + переосмыслить онбординг + профиль + матчинг. Бэкенд / админка / бот — не трогаем (там security/F-119/F-120 прокатили и работают)."),
    divider(),
    h1("Куда смотреть"),
    *bullet("📋 Product — стратегия, Discovery, персоны, roadmap"),
    *bullet("🎨 Design — Visual Direction (3 концепции на выбор), IA & Flows, Design System, Mood Board"),
    *bullet("🏛️ Competitors — DB декодированных приложений (5 reference + 3 anti-pattern)"),
    *bullet("🤝 Decisions Log — все продуктовые решения с контекстом и последствиями"),
    *bullet("⚙️ Engineering — зеркало docs/ в repo (ADR, security, runbooks)"),
    *bullet("📜 Legal & Compliance — РУз ПД-compliance, версии consents, оферта"),
    divider(),
    h1("Статус Discovery (2026-06-21)"),
    callout("Discovery-фаза завершена. Reference-декоды Hinge/Inner Circle/Raya/Bumble Premium, культурный декод Ташкента, 3 анти-паттерна, 4 trust-механики, 3 контрастные visual концепции готовы к выбору.", "✅", "green_background"),
    h2("Ближайший Decision-момент"),
    *para("Выбрать ОДИН из трёх концептов на странице Design → Visual Direction:"),
    *bullet("A. Editorial Premium — журнал, который знакомит. Serif-led, тёплый off-white, аметист акцент"),
    *bullet("B. Quiet Confidence — приватный клуб за бархатной верёвкой. Тёмная палитра, бронза, монохром"),
    *bullet("C. Tashkent Modernist — современный Ташкент без свадебного китча. Кремовый, терракот, локальные prompts"),
]
append_blocks(P["HOME"], home_blocks)
print("  done")

# ──────────────────────────────────────────────────────────────────────
# 2) Product → Strategy & Positioning
# ──────────────────────────────────────────────────────────────────────
print("Populating Strategy...")
reset_page(P["PRODUCT_STRATEGY"])

strategy_blocks = [
    h1("Strategy & Positioning"),
    h2("Target user — \"ядро\" первых 1000"),
    callout("Ташкент 22-32, образованные средний+ класс. Не масса, не диаспора (на старте).", "🎯", "blue_background"),
    *bullet("Возраст 22-32"),
    *bullet("Образование: WIUT, INHA, Inhasoft, западные универы"),
    *bullet("Сфера: IT, банки, консалтинг, креативные индустрии"),
    *bullet("Языки: bilingual RU/UZ с уклоном в RU"),
    *bullet("Доход: $700-2500/мес"),
    *bullet("Кругозор: пользуется Notion/Spotify/Airbnb, читает Spot.uz/Hook.report"),
    *bullet("Болевая точка: брезгует Мамбой/Badoo (\"не для меня\"), Tinder не для серьёзного, traditional свахи слишком семейно"),
    h2("Differentiator — главная отстройка"),
    callout("Обязательная верификация личности + репутация. Каждый — подтверждённый человек. Build всё на этом.", "🛡️", "purple_background"),
    *para("Никаких фейков. Никаких ботов. Никаких «kb»-аккаунтов. Verified не как достижение (badge на профиле в Bumble Premium), а как ОБЯЗАТЕЛЬНЫЙ floor — без подтверждённого паспорта вход закрыт. Слой 2 trust строится поверх: employer, university, mahalla (фаза 2)."),
    h2("Что должен почувствовать первые 30 секунд"),
    *para("«О, здесь взрослые и серьёзные люди» — premium-trust direction."),
    h2("Brand positioning statement"),
    quote("Baxtlilar — приложение для серьёзных знакомств в Узбекистане, в котором ты уверен в каждом профиле, потому что каждый прошёл паспорт-верификацию. Editorial-формат вместо свайпов; чтение вместо реакции; намерение вместо игры."),
    h2("Anti-positioning — то, чем мы НЕ являемся"),
    *bullet("Не свайп-аппа (Tinder)"),
    *bullet("Не флирт-каталог (Mamba/Badoo)"),
    *bullet("Не брачное агентство (классическая модель)"),
    *bullet("Не «диаспора-онли»"),
    *bullet("Не закрытый клуб с VIP-tier (Raya-style)"),
    h2("Scope редизайна"),
    *para("UI/UX + переосмыслить onboarding + профиль + матчинг. Backend/админка/бот — не трогаем (security + F-119 + F-120 рабочие)."),
]
append_blocks(P["PRODUCT_STRATEGY"], strategy_blocks)
print("  done")

# ──────────────────────────────────────────────────────────────────────
# 3) Personas — single core persona for now
# ──────────────────────────────────────────────────────────────────────
print("Populating Personas...")
reset_page(P["PRODUCT_PERSONAS"])

personas_blocks = [
    h1("Personas"),
    callout("Один core-персона для MVP — \"Тамара\". Дополнительные арки-типы появятся после первых 100 верифицированных регистраций.", "👤", "gray_background"),
    h2("Core: Тамара, 27"),
    h3("Демография"),
    *bullet("27 лет, Ташкент, м. Минор"),
    *bullet("Senior UX-дизайнер в финтех-компании, доход ~$1500"),
    *bullet("WIUT, бакалавр Media & Communications"),
    *bullet("RU primary, UZ свободно, английский для работы"),
    h3("Жизнь / контекст"),
    *bullet("Снимает квартиру с подругой; родители в районе"),
    *bullet("Семья «лёгкое давление» по поводу замужества (мама регулярно намекает), но не свахи"),
    *bullet("Хочет создать семью, но «не сейчас, через 1-2 года». Прямо сейчас ищет адекватного партнёра"),
    *bullet("На баланс дин/дунё — practicing musulmanka но не ношение хиджаба; никох обязательно"),
    h3("Поведение онлайн"),
    *bullet("Notion для личных планов, Spotify, Instagram (фолловит фотографов и кафе), Telegram (основной мессенджер)"),
    *bullet("Раньше пробовала Мамбу — \"ужас, ушла за неделю\""),
    *bullet("Tinder ставила в путешествии — для знакомства с экспатами, не для серьёзного"),
    *bullet("Reads Hook.report, Spot.uz, иногда Substack-журналы про lifestyle"),
    h3("Боли в текущих dating-аппах"),
    *bullet("«Мясной рынок» feel — много анкет, мало contextual signals"),
    *bullet("Бесконечные сообщения «привет красотка» от не-подходящих"),
    *bullet("Невозможно отличить настоящего от фейка/бота"),
    *bullet("Свайп-механика чувствуется несерьёзной"),
    *bullet("Платная модель в Tinder/Bumble = «купил видимость, а не доверие»"),
    h3("Что даёт Baxtlilar"),
    *bullet("Уверенность что все верифицированы по паспорту — реальные люди, реальные имена"),
    *bullet("Read-before-react: лайк только на конкретный prompt или фото с обязательным сообщением"),
    *bullet("Editorial-формат vs мясной рынок — listating развороты, не tinder-конвейер"),
    *bullet("Local-aware tone — prompt-cards на русском с УЗ-контекстом, без глобал-кальки"),
    *bullet("Pause-режим «общаюсь с кем-то» — не нужно удалять аккаунт чтобы прервать поток лайков"),
    h3("Цитата которая её бы зацепила"),
    quote("«Знакомства, после которых не свайпают дальше.» — Baxtlilar"),
]
append_blocks(P["PRODUCT_PERSONAS"], personas_blocks)
print("  done")

# ──────────────────────────────────────────────────────────────────────
# 4) Design → Visual Direction — 3 concepts as child pages
# ──────────────────────────────────────────────────────────────────────
print("Populating Visual Direction parent...")
reset_page(P["DESIGN_VISUAL"])

vis_intro = [
    h1("Visual Direction — 3 концепции на выбор"),
    callout("Это самое важное Discovery-решение. После выбора — менять язык дорого. Каждая концепция = независимая система: типографика, цвет, motion, signature детали. Не комбинируем — выбираем одну.", "🎯", "purple_background"),
    h2("Design principles (общие для всех 3)"),
]
for pr in syn["principles"]:
    vis_intro.extend(bullet(pr))

vis_intro.extend([
    divider(),
    h2("Концепции — выбери одну"),
    *para("Каждая имеет свою страницу со всеми деталями (типографика, цвет, motion, sig detail, tradeoffs)."),
    *bullet("A. Editorial Premium — \"Журнал, который знакомит\". Refs: Hinge, Inner Circle, Substack, Monocle"),
    *bullet("B. Quiet Confidence — \"Тёмная рамка для портрета\". Refs: Raya, Linear, Are.na, Arc Browser"),
    *bullet("C. Tashkent Modernist — \"Своё, но не свадебно-китчевое\". Refs: Airbnb, Yandex Eda RU, Notion, Cofo Sans foundries"),
])
append_blocks(P["DESIGN_VISUAL"], vis_intro)

# Создаём 3 child pages под Visual Direction — по одной на концепцию
print("Creating 3 concept child pages...")
for idx, c in enumerate(syn["concepts"]):
    letter = chr(65 + idx)  # A, B, C
    emoji_map = {"A": "📰", "B": "🌙", "C": "🏛️"}
    emoji = emoji_map.get(letter, "🎨")
    concept_blocks = [
        callout(c["tagline"], emoji, "purple_background"),
        h2("Feel — что чувствует юзер"),
        *para(c["feel"]),
        h2("Typography"),
        *para(c["typography"]),
        h2("Color palette"),
        *para(c["color_palette"]),
        h2("Layout"),
        *para(c["layout"]),
        h2("Motion"),
        *para(c["motion"]),
        h2("Signature detail"),
        *para(c["signature_detail"]),
        h2("Reference apps"),
    ]
    for ref in c["reference_apps"]:
        concept_blocks.extend(bullet(ref))
    concept_blocks.extend([
        h2("Tradeoffs"),
        *para(c["tradeoffs"]),
    ])
    pid = child_page(P["DESIGN_VISUAL"], emoji, f"{letter}. {c['name']}", concept_blocks)
    print(f"  Concept {letter} ({c['name']}): {pid}")

# ──────────────────────────────────────────────────────────────────────
# 5) Design → IA & Flows — new architecture
# ──────────────────────────────────────────────────────────────────────
print("Populating IA & Flows...")
reset_page(P["DESIGN_IA"])

ia_blocks = [
    h1("IA & Flows — переосмысленная архитектура"),
    callout("Информационная архитектура v2 + новая onboarding-последовательность. Опирается на принципы из Visual Direction. Не зависит от выбранного концепта — IA общая.", "🧭", "blue_background"),
    h2("Top-level навигация"),
]
for s in syn["ia"]["top_level_screens"]:
    ia_blocks.extend(bullet(s))

ia_blocks.extend([
    divider(),
    h2("Структура профиля"),
    *para("Профиль = вертикальная лента блоков (читается как разворот журнала, не как card). Порядок:"),
])
for s in syn["ia"]["profile_structure"]:
    ia_blocks.extend(bullet(s))

ia_blocks.extend([
    divider(),
    h2("Matching flow — как работает feed и like"),
    *para(syn["ia"]["matching_flow"]),
    divider(),
    h1("Onboarding rethink — новая последовательность"),
    callout("Переработка 7 текущих экранов в 9. Welcome-манифест + Intent-gate + Verification-as-hero — три новых hero-момента. Pending переоформлен как письмо от куратора, profile build как редакционный workflow.", "✨", "purple_background"),
])
for s in syn["onboarding"]["sequence"]:
    ia_blocks.extend(bullet(s))

ia_blocks.extend([
    divider(),
    h2("Verification strategy — как surface как hero, не как раздражение"),
    *para(syn["onboarding"]["verification_strategy"]),
    h2("Trust moments — где специально surface trust signals"),
])
for s in syn["onboarding"]["trust_moments"]:
    ia_blocks.extend(bullet(s))

append_blocks(P["DESIGN_IA"], ia_blocks)
print("  done")

# ──────────────────────────────────────────────────────────────────────
# 6) Discovery Logs — index/parent page
# ──────────────────────────────────────────────────────────────────────
print("Populating Discovery Logs...")
reset_page(P["PRODUCT_DISCOVERY"])

disc_blocks = [
    h1("Discovery Logs"),
    callout("Журнал research-фаз. Каждая запись — что искали, что нашли, какие выводы. Сырые декоды для reference; синтез и решения — в Visual Direction / Strategy / Decisions Log.", "🔬", "blue_background"),
    h2("2026-06-21 — Discovery Phase 1"),
    *para("Target user, differentiator, visual direction. 14 параллельных reference-декодов (5 references + 3 anti-patterns + 4 trust mechanics + 1 current-state + 1 synthesis)."),
    h3("Inputs"),
    *bullet("Target: Ташкент 22-32 educated премиум-trust"),
    *bullet("Feel: «здесь взрослые и серьёзные люди»"),
    *bullet("Differentiator: обязательная верификация + репутация"),
    *bullet("Scope: UI/UX + onboarding + profile + matching"),
    h3("Reference decodes (5)"),
]
for ref in result["references"]:
    disc_blocks.extend(bullet(f"{ref['app_name']} — {ref['overall_feel'][:200]}"))
disc_blocks.extend([
    h3("Anti-patterns (3)"),
])
for ap in result["antiPatterns"]:
    disc_blocks.extend(bullet(f"{ap['app_name']} — {ap['why_cheap_feel'][:200]}"))
disc_blocks.extend([
    h3("Trust mechanics (4)"),
])
for t in result["trust"]:
    disc_blocks.extend(bullet(f"{t['mechanic']} — {t['recommendation'][:200]}"))
disc_blocks.extend([
    h3("Outputs"),
    *bullet("7 design principles (см. Visual Direction)"),
    *bullet("3 visual concepts на выбор (Editorial Premium / Quiet Confidence / Tashkent Modernist)"),
    *bullet("New IA + 9-step onboarding sequence"),
    *bullet("Single core persona — Тамара, 27"),
    *bullet("8 competitor rows в DB"),
    h3("Next decisions (см. Decisions Log)"),
])
for ns in syn["next_steps"]:
    disc_blocks.extend(bullet(ns))

append_blocks(P["PRODUCT_DISCOVERY"], disc_blocks)
print("  done")

# ──────────────────────────────────────────────────────────────────────
# 7) Competitors DB — 8 rows
# ──────────────────────────────────────────────────────────────────────
print("Populating Competitors DB...")

competitor_data = []
# References
for r in result["references"]:
    category = "Premium-trust" if r["app_name"] in ("Hinge", "The Inner Circle", "Raya", "Bumble Premium") else "Niche"
    region = "Global"
    if "Tashkent" in r["app_name"]:
        category = "Niche"
        region = "UZ"
    competitor_data.append({
        "Name": r["app_name"],
        "Category": category,
        "Region": region,
        "Verified ID required": r["app_name"] in ("The Inner Circle", "Raya", "Bumble Premium"),
        "Visual feel": r["overall_feel"][:1900],
        "What to steal": (r["what_to_steal"] if isinstance(r["what_to_steal"], str) else " ".join(r["what_to_steal"]))[:1900],
        "What to avoid": (r["what_to_avoid"] if isinstance(r["what_to_avoid"], str) else " ".join(r["what_to_avoid"]))[:1900],
    })
# Anti-patterns
for ap in result["antiPatterns"]:
    competitor_data.append({
        "Name": ap["app_name"],
        "Category": "Anti-pattern",
        "Region": "Global" if ap["app_name"] in ("Tinder", "Badoo") else "RU/CIS",
        "Verified ID required": False,
        "Visual feel": ap["why_cheap_feel"][:1900],
        "What to steal": "—",
        "What to avoid": ap["lesson"][:1900],
    })

for c in competitor_data:
    api("/pages", {
        "parent": {"database_id": P["DB_COMPETITORS"]},
        "properties": {
            "Name": {"title": [{"text": {"content": c["Name"]}}]},
            "Category": {"select": {"name": c["Category"]}},
            "Region": {"select": {"name": c["Region"]}},
            "Verified ID required": {"checkbox": c["Verified ID required"]},
            "Visual feel": {"rich_text": [{"text": {"content": c["Visual feel"]}}]},
            "What to steal": {"rich_text": [{"text": {"content": c["What to steal"]}}]},
            "What to avoid": {"rich_text": [{"text": {"content": c["What to avoid"]}}]},
        },
    })
    print(f"  + {c['Name']} ({c['Category']})")

# ──────────────────────────────────────────────────────────────────────
# 8) Decisions Log — initial entries
# ──────────────────────────────────────────────────────────────────────
print("Populating Decisions Log...")

decisions = [
    {
        "Decision": "Pivot to verification-first redesign DNA",
        "Date": "2026-06-21",
        "Status": "Accepted",
        "Type": "Product",
        "Owner": "founder",
        "Context": "Текущая mini-app — generic Tailwind, без визуального DNA. На фоне сильной security/backend постуры и уникального диффера (обязательная паспорт-верификация) фронт продаёт продукт хуже чем мог бы. Решено сделать полный UI/UX редизайн с фокусом на trust-through-restraint, editorial-формат, verified-as-floor.",
        "Consequences": "Запуск 4-фазной работы: Discovery → Design Direction → Architecture → Phased plan. Backend не трогаем. Срок до production-ready дизайна — 2-3 спринта.",
    },
    {
        "Decision": "Target audience locked: Ташкент 22-32 educated премиум-trust",
        "Date": "2026-06-21",
        "Status": "Accepted",
        "Type": "Product",
        "Owner": "founder",
        "Context": "Из 3 опций (urban educated / traditional family / diaspora) выбран первый. Это narrows визуальный язык, копирайт, prompt-cards.",
        "Consequences": "Сегментирует MVP на ядро: WIUT/INHA-uni-graduates, IT/банки/консалтинг, доход $700-2500, RU primary. Диаспора и регионы — фаза 2.",
    },
    {
        "Decision": "Differentiator: mandatory verification + reputation (no fakes/bots)",
        "Date": "2026-06-21",
        "Status": "Accepted",
        "Type": "Product",
        "Owner": "founder",
        "Context": "Из 3 опций (verified+reputation / curated quality / explicit marriage intent) выбран первый. Это самый сильный moat — копировать копированием паспорт-верификации невозможно без operations.",
        "Consequences": "Verification surface'ится как HERO-фича во всем UX (welcome-manifesto, шапка Today, badges на профиле). Repуtаtion-tier'ы (employer/uni/mahalla) — фаза 2.",
    },
    {
        "Decision": "Scope редизайна: UI/UX + onboarding + profile + matching (без backend)",
        "Date": "2026-06-21",
        "Status": "Accepted",
        "Type": "Product",
        "Owner": "founder",
        "Context": "Из 3 опций (только UI / UX+core / полный rethink) выбран средний. Backend / админка / бот в стабильном состоянии после 4 раундов security adversarial verify.",
        "Consequences": "Команда сосредоточена на front. Backend support — только небольшие правки под новые UI-требования (например, like-on-specific вместо like-on-profile может требовать DB-изменения).",
    },
    {
        "Decision": "Доcументация: продукт в Notion, code в repo docs/",
        "Date": "2026-06-21",
        "Status": "Accepted",
        "Type": "Product",
        "Owner": "founder + Claude",
        "Context": "Раньше всё в repo + _audit/. Не шерится с не-техническими (юрист, дизайнер). Notion умеет богатый контент, базы данных, легко расшаривается.",
        "Consequences": "Создан Notion workspace с Home/Product/Design/Engineering/Legal + Competitors DB + Decisions Log DB. Repo сохраняет docs/adr (technical), docs/runbooks, docs/security (audit summary).",
    },
]

for d in decisions:
    api("/pages", {
        "parent": {"database_id": P["DB_DECISIONS"]},
        "properties": {
            "Decision": {"title": [{"text": {"content": d["Decision"]}}]},
            "Date": {"date": {"start": d["Date"]}},
            "Status": {"select": {"name": d["Status"]}},
            "Type": {"select": {"name": d["Type"]}},
            "Owner": {"rich_text": [{"text": {"content": d["Owner"]}}]},
            "Context": {"rich_text": [{"text": {"content": d["Context"][:1900]}}]},
            "Consequences": {"rich_text": [{"text": {"content": d["Consequences"][:1900]}}]},
        },
    })
    print(f"  + {d['Decision'][:60]}")

print("\nDONE")
