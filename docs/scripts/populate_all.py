"""Full populate: 14 chats + standalone docs + Engineering + Legal."""
import os, sys, subprocess, json
sys.path.insert(0, "/tmp")
from md_to_notion import (
    api, md_to_blocks, append_blocks, reset_page, create_page,
    callout, divider, parse_inline, _span,
)

PRODUCT_ID = "3898dc27-4fcc-81d1-876d-f08ef91f9f51"
ENGINEERING_ID = "3898dc27-4fcc-81e8-8b80-d53d885f950a"
LEGAL_ID = "3898dc27-4fcc-8147-87e2-e57e5da69704"
DESIGN_IA_ID = "3898dc27-4fcc-81f1-8110-d20d86a22bdc"

ENG_ADR = "3898dc27-4fcc-815e-86f7-cde9808280d3"
ENG_SECURITY = "3898dc27-4fcc-8147-87d5-d54e9b016001"
ENG_RUNBOOKS = "3898dc27-4fcc-81c6-9aea-c0454d327296"
ENG_STACK = "3898dc27-4fcc-81aa-9f7c-ec272f3f04b4"

LEGAL_PD = "3898dc27-4fcc-8145-9e71-cd878b7cbf4e"
LEGAL_CONSENTS = "3898dc27-4fcc-815a-a191-c710015a2090"

DESKTOP = "/Users/fayzullohoja/Desktop/Все файлы/02. Baxtlilar"
REPO = "/Users/fayzullohoja/Code/baxtlilar"


def pandoc(path, fmt="gfm"):
    """Convert .docx to markdown via pandoc."""
    return subprocess.run(
        ["pandoc", "--wrap=preserve", "--extract-media=/tmp/notion_media", "-t", fmt, path],
        check=True, capture_output=True, text=True,
    ).stdout


def read_file(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


# ─────────────────────────────────────────────────────────────────────
# Phase 1: Create Reference v1 parent under Product
# ─────────────────────────────────────────────────────────────────────
print("=== Creating Reference v1 parent ===")
ref_intro = [
    callout(
        "Это полная исходная спека MVP v1 — 13 чатов + standalone PRD/архитектура. "
        "Перенесена из .docx через pandoc. Оригинальные файлы — на диске владельца, "
        "пути указаны в callout каждой страницы. Используется как Reference для v2 редизайна.",
        "📚", "gray_background",
    ),
]
REF_V1 = create_page(PRODUCT_ID, "📚", "Reference v1 (Original Spec)", ref_intro)
print(f"Reference v1: {REF_V1}")

# ─────────────────────────────────────────────────────────────────────
# Phase 2: Convert 14 chats
# ─────────────────────────────────────────────────────────────────────
print("\n=== Converting 14 chats ===")

chats_dir = f"{DESKTOP}/01. Спека (Чаты)"
chat_files = sorted([f for f in os.listdir(chats_dir) if f.endswith(".docx")])

# Sort by chat number
def chat_num(fname):
    import re
    m = re.match(r"Чат[\s_](\d+)", fname)
    return int(m.group(1)) if m else 999

chat_files.sort(key=chat_num)

CHAT_EMOJI = {
    1: "🚪", 2: "📋", 3: "💞", 4: "💎", 5: "🛡", 6: "🌐", 7: "👮", 8: "⚖️",
    9: "🤝", 10: "📊", 11: "🔄", 12: "📐", 13: "🎨",
}

chat_ids = []
for fname in chat_files:
    n = chat_num(fname)
    path = f"{chats_dir}/{fname}"
    # Strip extension and ugly underscores for title
    title = fname.replace(".docx", "").replace("_", " ")
    emoji = CHAT_EMOJI.get(n, "💬")
    print(f"  Chat {n}: {fname} ({os.path.getsize(path)/1024/1024:.1f} MB)")
    try:
        md = pandoc(path)
        blocks = [
            callout(
                f"Источник: ~/Desktop/Все файлы/02. Baxtlilar/01. Спека (Чаты)/{fname}",
                "📎", "gray_background",
            ),
            divider(),
        ]
        blocks.extend(md_to_blocks(md))
        # Limit huge pages — Notion has practical limits, truncate at 1200 blocks
        if len(blocks) > 1200:
            blocks = blocks[:1200] + [
                callout(
                    f"⚠️ Документ обрезан до 1200 блоков ({len(blocks)} всего). Открой оригинальный .docx для полной версии.",
                    "✂️", "yellow_background",
                ),
            ]
        pid = create_page(REF_V1, emoji, title, blocks)
        chat_ids.append((n, pid, title))
        print(f"    → {pid} ({len(blocks)} blocks)")
    except Exception as e:
        print(f"    ERR: {e}", file=sys.stderr)

# ─────────────────────────────────────────────────────────────────────
# Phase 3: Standalone docs
# ─────────────────────────────────────────────────────────────────────
print("\n=== Standalone docs ===")

# 3.1 Простыми словами → Product/Strategy as sub-page (TL;DR)
print("  Простыми словами (TL;DR)...")
try:
    md = pandoc(f"{DESKTOP}/02. PRD, бэклог и схемы/Baxtlilar — Простыми словами (что мы делаем и куда идём).docx")
    blocks = [
        callout(
            "TL;DR для founder/board/legal. Простым языком — что мы строим, как работает для юзера, зачем нужен каждый артефакт.",
            "📖", "blue_background",
        ),
        callout(
            "Источник: ~/Desktop/Все файлы/02. Baxtlilar/02. PRD, бэклог и схемы/Baxtlilar — Простыми словами (что мы делаем и куда идём).docx",
            "📎", "gray_background",
        ),
        divider(),
    ]
    blocks.extend(md_to_blocks(md))
    PROSTYMI = create_page(PRODUCT_ID, "📖", "Простыми словами (TL;DR)", blocks)
    print(f"    → {PROSTYMI}")
except Exception as e:
    print(f"    ERR: {e}", file=sys.stderr)

# 3.2 Решение учредителя → Legal
print("  Решение учредителя...")
try:
    md = pandoc(f"{DESKTOP}/02. PRD, бэклог и схемы/Baxtlilar_решение_учредителя_к_встрече_07_06_2026.docx")
    blocks = [
        callout(
            "Официальное решение учредителя ООО «Bahtli Bo'laman» от 07.06.2026 — фиксирует OD-1..OD-20 стратегические решения проекта Baxtlilar.",
            "📜", "purple_background",
        ),
        callout(
            "Источник: ~/Desktop/Все файлы/02. Baxtlilar/02. PRD, бэклог и схемы/Baxtlilar_решение_учредителя_к_встрече_07_06_2026.docx",
            "📎", "gray_background",
        ),
        divider(),
    ]
    blocks.extend(md_to_blocks(md))
    OD = create_page(LEGAL_ID, "📜", "Решение учредителя 07.06.2026 (OD-1..OD-20)", blocks)
    print(f"    → {OD}")
except Exception as e:
    print(f"    ERR: {e}", file=sys.stderr)

# 3.3 Архитектура v1.0 (markdown) → Engineering
print("  Архитектура v1.0.md...")
try:
    md = read_file(f"{DESKTOP}/02. PRD, бэклог и схемы/Архитектура и бизнес-процесс — Текущее и Целевое v1.0.md")
    blocks = [
        callout(
            "Главный архитектурный документ. Текущее MVP-состояние + целевое (Vision) бизнес-процесса. Опирается на Чат 13 и решение учредителя 07.06.2026.",
            "🏗", "blue_background",
        ),
        callout(
            "Источник: ~/Desktop/Все файлы/02. Baxtlilar/02. PRD, бэклог и схемы/Архитектура и бизнес-процесс — Текущее и Целевое v1.0.md",
            "📎", "gray_background",
        ),
        divider(),
    ]
    blocks.extend(md_to_blocks(md))
    ARCH = create_page(ENGINEERING_ID, "🏗", "Архитектура и бизнес-процесс v1.0", blocks)
    print(f"    → {ARCH}")
except Exception as e:
    print(f"    ERR: {e}", file=sys.stderr)

# 3.4 Оферта — спек интеграции (md) → Legal
print("  Оферта спек интеграции.md...")
try:
    md = read_file(f"{DESKTOP}/02. PRD, бэклог и схемы/Оферта — спек интеграции в бот и Mini App.md")
    blocks = [
        callout(
            "Технико-юридическая спецификация: где и как показывается публичная оферта в бот-флоу и Mini App. ГК РУз ст. 365, 367, 369, 370 + закон о ПД ст. 17.",
            "⚖️", "purple_background",
        ),
        callout(
            "Источник: ~/Desktop/Все файлы/02. Baxtlilar/02. PRD, бэклог и схемы/Оферта — спек интеграции в бот и Mini App.md",
            "📎", "gray_background",
        ),
        divider(),
    ]
    blocks.extend(md_to_blocks(md))
    OFFER_INTEG = create_page(LEGAL_ID, "⚖️", "Спецификация интеграции оферты (бот + Mini App)", blocks)
    print(f"    → {OFFER_INTEG}")
except Exception as e:
    print(f"    ERR: {e}", file=sys.stderr)

# 3.5 Публичная оферта черновик v0.1 → Legal
print("  Публичная оферта v0.1.md...")
try:
    md = read_file(f"{DESKTOP}/03. Договоры и акты/Публичная оферта Baxtlilar — черновик v0.1.md")
    blocks = [
        callout(
            "Черновик публичной оферты v0.1. ЮРИСТ не подписал — это draft для review. До подписи в прод не публикуется.",
            "📝", "yellow_background",
        ),
        callout(
            "Источник: ~/Desktop/Все файлы/02. Baxtlilar/03. Договоры и акты/Публичная оферта Baxtlilar — черновик v0.1.md",
            "📎", "gray_background",
        ),
        divider(),
    ]
    blocks.extend(md_to_blocks(md))
    OFFER = create_page(LEGAL_ID, "📝", "Публичная оферта — черновик v0.1", blocks)
    print(f"    → {OFFER}")
except Exception as e:
    print(f"    ERR: {e}", file=sys.stderr)

# ─────────────────────────────────────────────────────────────────────
# Phase 4: Engineering pages from repo
# ─────────────────────────────────────────────────────────────────────
print("\n=== Engineering pages from repo ===")

# 4.1 ADR Index
print("  ADR Index...")
try:
    md = read_file(f"{REPO}/docs/adr/README.md")
    blocks = [
        callout(
            "Architecture Decision Records — короткие записи о технических решениях. Живут в repo `docs/adr/` под git. Notion-страница — зеркало для шеринга.",
            "🏛️", "blue_background",
        ),
        callout("Источник: repo docs/adr/", "📎", "gray_background"),
        divider(),
    ]
    blocks.extend(md_to_blocks(md))
    # Append each ADR
    for adr_file in sorted(os.listdir(f"{REPO}/docs/adr")):
        if adr_file.startswith("0") and adr_file.endswith(".md"):
            adr_md = read_file(f"{REPO}/docs/adr/{adr_file}")
            blocks.append(divider())
            blocks.extend(md_to_blocks(adr_md))
    reset_page(ENG_ADR)
    append_blocks(ENG_ADR, blocks)
    print(f"    → ENG_ADR populated ({len(blocks)} blocks)")
except Exception as e:
    print(f"    ERR: {e}", file=sys.stderr)

# 4.2 Security Audit Summary
print("  Security Audit Summary...")
try:
    md = read_file(f"{REPO}/docs/security/README.md")
    blocks = [
        callout(
            "Текущая security-поза. После 4 раундов adversarial verify — все P0 закрыты. Открытые блокеры для прод-биометрии = A1-A4 (см. ниже).",
            "🛡️", "green_background",
        ),
        callout("Источник: repo docs/security/, _audit/2026-06-19-security-audit.md", "📎", "gray_background"),
        divider(),
    ]
    blocks.extend(md_to_blocks(md))
    reset_page(ENG_SECURITY)
    append_blocks(ENG_SECURITY, blocks)
    print(f"    → ENG_SECURITY populated")
except Exception as e:
    print(f"    ERR: {e}", file=sys.stderr)

# 4.3 Runbooks
print("  Runbooks...")
try:
    runbook_files = sorted(os.listdir(f"{REPO}/docs/runbooks"))
    blocks = [
        callout("Оперативные сценарии: deploy, DB ops, инциденты. Шпаргалки для on-call/DevOps.", "📚", "blue_background"),
    ]
    for rb_file in runbook_files:
        if rb_file.endswith(".md"):
            rb_md = read_file(f"{REPO}/docs/runbooks/{rb_file}")
            blocks.append(divider())
            blocks.extend(md_to_blocks(rb_md))
    reset_page(ENG_RUNBOOKS)
    append_blocks(ENG_RUNBOOKS, blocks)
    print(f"    → ENG_RUNBOOKS populated")
except Exception as e:
    print(f"    ERR: {e}", file=sys.stderr)

# 4.4 Tech Stack — concise summary
print("  Tech Stack...")
try:
    blocks = [
        callout("Stack snapshot — что используем, кратко. Глубокие обоснования в ADR.", "🧰", "blue_background"),
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Frontend")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Next.js 16 (App Router, async cookies/headers/params)")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("React 19 + TypeScript strict")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Tailwind v4")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("next-intl 4 (RU/UZ)")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Zod (валидация)")}},
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Backend / Data")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Postgres напрямую (node-pg). Supabase больше НЕ используется. См. ADR-0003.")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Files: Railway Volume + HMAC-signed URLs")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Auth: Telegram initData (HMAC-SHA256) + httpOnly cookie session")}},
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Infra")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Railway (Nixpacks, Node 22, pnpm 10)")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("baxtlilar-mvp + Postgres + Volume /data")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Деплой: railway up или git push origin main")}},
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Test / Quality")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Vitest (197/197 проходят)")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("pnpm typecheck + lint в pre-commit")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Adversarial verify workflow (security)")}},
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Telegram")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Bot API webhook + secret_token (X-Telegram-Bot-Api-Secret-Token)")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("Mini App через web_app кнопку с HMAC-токеном (jti single-use, bound to telegram_id)")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("@baxtlilar_uz_bot — has_main_web_app: true")}},
    ]
    reset_page(ENG_STACK)
    append_blocks(ENG_STACK, blocks)
    print(f"    → ENG_STACK populated")
except Exception as e:
    print(f"    ERR: {e}", file=sys.stderr)

# ─────────────────────────────────────────────────────────────────────
# Phase 5: Legal pages
# ─────────────────────────────────────────────────────────────────────
print("\n=== Legal pages ===")

# 5.1 РУз ПД-compliance status
print("  РУз ПД-compliance status...")
try:
    blocks = [
        callout(
            "Статус compliance с РУз законодательством о персональных данных (ст. 17 закона «О персональных данных», ст. 28 закона о праве на стирание). Биометрия требует особого режима.",
            "🇺🇿", "purple_background",
        ),
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Что закрыто в коде")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("✅ Согласие на ПД — отдельный шаг бот-флоу (terms+privacy+pd+rules), записывается в БД consents с timestamp + IP + язык + SHA текста")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("✅ Согласие на биометрию — ОТДЕЛЬНЫЙ consent_type='biometric' (требование закона)")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("✅ Право на стирание (ст. 28) — atomic erase_user RPC, чистит все таблицы + storage. Документация: ADR-0002.")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("✅ Право на доступ (ст. 25) — /api/account?action=export даёт полный JSON-экспорт за 24h с rate-limit")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("✅ LEGAL_VERSION в коде — при bump старые consents становятся invalid, требуется re-consent (механизм есть, не активирован)")}},
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Открытые блокеры для прод")}},
        callout(
            "Без этих пунктов запускать биометрическую обработку в прод НЕЛЬЗЯ:",
            "🚫", "red_background",
        ),
        {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("F-003 — юр.документы (terms, privacy, pd, rules) подписаны юристом-РУз")}},
        {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("F-005 — БД и storage в РУз-юрисдикции (UZINFOCOM-реестр). Сейчас Railway = EU/US — НЕ соответствует.")}},
        {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("F-121 — envelope-encryption для биометрии (KMS-архитектура). Сейчас disk-level encryption, но не at-app-level.")}},
        {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("A1-A4 (admin блокеры) — 2FA, IP-allowlist, session revoke, structured reject codes — без них доступ к биометрии не аудитен.")}},
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Чек-лист для запуска в прод-биометрию")}},
        {"object": "block", "type": "to_do", "to_do": {"checked": False, "rich_text": parse_inline("Юрист РУз подписал terms/privacy/pd/rules")}},
        {"object": "block", "type": "to_do", "to_do": {"checked": False, "rich_text": parse_inline("Хостинг БД и storage в РУз (UZINFOCOM-реестр)")}},
        {"object": "block", "type": "to_do", "to_do": {"checked": False, "rich_text": parse_inline("KMS для envelope-шифрования биометрии")}},
        {"object": "block", "type": "to_do", "to_do": {"checked": False, "rich_text": parse_inline("2FA TOTP для admin")}},
        {"object": "block", "type": "to_do", "to_do": {"checked": False, "rich_text": parse_inline("IP-allowlist для админ-доступа")}},
        {"object": "block", "type": "to_do", "to_do": {"checked": False, "rich_text": parse_inline("Короткий TTL admin-сессии + force_logout_all")}},
        {"object": "block", "type": "to_do", "to_do": {"checked": False, "rich_text": parse_inline("Structured reject_reason_dictionary UZ/RU")}},
    ]
    reset_page(LEGAL_PD)
    append_blocks(LEGAL_PD, blocks)
    print(f"    → LEGAL_PD populated")
except Exception as e:
    print(f"    ERR: {e}", file=sys.stderr)

# 5.2 Consents versions
print("  Consents versions...")
try:
    # Try to read LEGAL_VERSION from code
    legal_ver = "v0.1.0"
    try:
        legal_content = read_file(f"{REPO}/src/content/legal.ts")
        import re as _re
        m = _re.search(r'LEGAL_VERSION\s*=\s*"([^"]+)"', legal_content)
        if m:
            legal_ver = m.group(1)
    except Exception:
        pass

    blocks = [
        callout(
            f"Текущая активная версия consents: **{legal_ver}** (определена в src/content/legal.ts).\n"
            f"При bump'е консенты с прошлой версией становятся invalid → требуется re-consent.",
            "📝", "blue_background",
        ),
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Какие consent_type'ы записываются")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("terms — условия использования")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("privacy — политика конфиденциальности")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("pd — обработка персональных данных")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("rules — правила сообщества")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("biometric — обработка биометрических данных (паспорт + селфи, отдельный consent — требование закона)")}},
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Что хранится в БД при каждом consent")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("user_id")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("consent_type")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("consent_version (= LEGAL_VERSION на момент согласия)")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("accepted_at (timestamp)")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("ip (источник запроса — 'tg-webhook' для бот-flow)")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("user_agent")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("language (RU/UZ — на каком языке текст был показан)")}},
        {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": parse_inline("consent_text_sha256 (доказательство какой именно текст пользователь видел)")}},
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("Как мутировать LEGAL_VERSION")}},
        {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("Юрист одобрил новый текст")}},
        {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("Обновить src/content/legal.ts → LEGAL_VERSION + сами строки")}},
        {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("Деплой → все юзеры с consent_version < новой увидят повторный запрос согласия на входе")}},
        {"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": parse_inline("UNIQUE constraint на (user_id, consent_type, consent_version) — поэтому re-consent создаёт новую row, старая для аудита")}},
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline("История версий")}},
        {"object": "block", "type": "paragraph", "paragraph": {"rich_text": parse_inline(f"{legal_ver} — текущая активная (точная дата bump'а — git blame src/content/legal.ts)")}},
    ]
    reset_page(LEGAL_CONSENTS)
    append_blocks(LEGAL_CONSENTS, blocks)
    print(f"    → LEGAL_CONSENTS populated")
except Exception as e:
    print(f"    ERR: {e}", file=sys.stderr)

print("\n=== ALL DONE ===")
