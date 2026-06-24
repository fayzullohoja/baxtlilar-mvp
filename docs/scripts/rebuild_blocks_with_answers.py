"""Rebuild 9 block pages with answer template under each question."""
import json, sys, time, urllib.request, urllib.error
sys.path.insert(0, "/tmp")
from md_to_notion import (
    append_blocks, callout, divider, parse_inline, _span,
)

TOKEN = __import__("os").environ.get("NOTION_TOKEN") or open("/Users/fayzullohoja/Code/baxtlilar/.env.access").read().split("NOTION_TOKEN=")[1].split("\n")[0].strip()


def api(path, payload=None, method="POST", timeout=90, retries=3):
    """Local API with bigger timeout + retries."""
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Notion-Version": "2022-06-28",
    }
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode()
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                f"https://api.notion.com/v1{path}", data=body, headers=headers, method=method,
            )
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            last_err = e
            wait = 2 ** attempt
            print(f"    retry {attempt+1}/{retries} after {wait}s: {e}", file=sys.stderr)
            time.sleep(wait)
    raise last_err

DATA = json.load(open("/private/tmp/claude-501/-Users-fayzullohoja-Desktop/16767afb-765f-413e-a40c-e8e93ab99655/tasks/wzg6vksig.output"))
blocks_data = DATA["result"]["organized"]["blocks"]

BLOCK_IDS = [
    "3898dc27-4fcc-81b8-971d-f058ec4195a3",  # Block 1
    "3898dc27-4fcc-81c1-b25f-c4692bb01bd8",  # Block 2
    "3898dc27-4fcc-815c-a7c3-cb566c24abdb",  # Block 3
    "3898dc27-4fcc-8127-8f96-db545897bcf0",  # Block 4
    "3898dc27-4fcc-81e3-9e83-ffe9eba56f33",  # Block 5
    "3898dc27-4fcc-814f-8a2c-d6ce9045992b",  # Block 6
    "3898dc27-4fcc-81a4-b5be-ee9531952d66",  # Block 7
    "3898dc27-4fcc-8140-bbca-f1f7680e3b30",  # Block 8
    "3898dc27-4fcc-8112-94b4-d3125c59e984",  # Block 9
]

BLOCK_EMOJIS = {1: "🏦", 2: "👥", 3: "⚙️", 4: "🎨", 5: "📦", 6: "🚪", 7: "📣", 8: "🖼️", 9: "🎯"}


def get_children(page_id):
    res = api(f"/blocks/{page_id}/children?page_size=100", method="GET")
    return res.get("results", [])


def del_block(block_id):
    try:
        api(f"/blocks/{block_id}", method="DELETE")
    except Exception:
        pass


def reset_page(page_id):
    """Remove all child blocks."""
    while True:
        children = get_children(page_id)
        if not children:
            break
        for ch in children:
            del_block(ch["id"])
        # Pause briefly to let Notion process deletes
        time.sleep(0.3)


def h2(t):
    return {"object": "block", "type": "heading_2", "heading_2": {"rich_text": parse_inline(t)}}


def h3(t):
    return {"object": "block", "type": "heading_3", "heading_3": {"rich_text": parse_inline(t)}}


def para(t):
    return {"object": "block", "type": "paragraph", "paragraph": {"rich_text": parse_inline(t)}}


def quote(t):
    return {"object": "block", "type": "quote", "quote": {"rich_text": parse_inline(t)}}


def bullet(t):
    return {"object": "block", "type": "bulleted_list_item",
            "bulleted_list_item": {"rich_text": parse_inline(t)}}


def num(t):
    return {"object": "block", "type": "numbered_list_item",
            "numbered_list_item": {"rich_text": parse_inline(t)}}


def call(t, emoji="📌", color="gray_background"):
    return callout(t, emoji, color)


for idx, b in enumerate(blocks_data, 1):
    pid = BLOCK_IDS[idx - 1]
    emoji = BLOCK_EMOJIS[idx]
    print(f"=== Rebuilding {b['title']} ===")
    print(f"  Resetting...")
    reset_page(pid)

    page_blocks = [
        call(b["purpose"], emoji, "blue_background"),
        h2("Expected outcomes"),
    ]
    for o in b.get("expected_outcomes", []):
        page_blocks.append(bullet(o))

    page_blocks.append(h2("Duration & Prerequisites"))
    page_blocks.append(bullet(f"Estimated: {b['estimated_duration']}"))
    prereqs = b.get("prerequisites", [])
    if prereqs:
        for p in prereqs:
            page_blocks.append(bullet(f"Prerequisite: {p}"))
    else:
        page_blocks.append(bullet("Prerequisites: нет — корневой блок"))

    page_blocks.append(divider())
    page_blocks.append(h2("Вопросы и ответы"))
    page_blocks.append(call(
        "Под каждым вопросом — поле для ответа (quote-блок) и строка статуса. "
        "Пиши прямо в quote-блок. Статус потом скопируй в Q&A Sessions Log DB.",
        "✍️", "yellow_background",
    ))

    for qi, q in enumerate(b["questions"], 1):
        page_blocks.append(h3(f"Q{qi}. {q['q']}"))
        # Metadata as small paragraph
        page_blocks.append(para(
            f"📌 Dimension: {q['dimension']}  ·  Source: {q['source']}  ·  Cost: {q['cost']}  ·  Unlocks: {q['unlocks']}"
        ))
        # Answer area
        page_blocks.append({"object": "block", "type": "heading_3",
                            "heading_3": {"rich_text": parse_inline("Ответ"),
                                          "is_toggleable": False}})
        page_blocks.append(quote("…впиши свой ответ сюда…"))
        # Status line
        page_blocks.append(para(
            "Статус: ⏳ Pending  ·  (поставь ✅ Answered / ⏳ TBV / ⚠️ CONFLICT / 🚫 BLOCKER / ⏭️ Skipped)"
        ))
        page_blocks.append(divider())

    # Footer
    page_blocks.append(h2("После блока"))
    page_blocks.append(bullet("Перенесите статусы и ответы в Q&A Sessions Log DB (фильтр по Block)"))
    page_blocks.append(bullet("Если есть CONFLICT — назначьте consensus-сессию (см. Truth-Finding Compass)"))
    page_blocks.append(bullet("Если есть TBV — назначьте owner + deadline для acquisition"))
    page_blocks.append(bullet("Готовы к следующему блоку? Проверьте prerequisites следующего"))

    print(f"  Appending {len(page_blocks)} blocks...")
    # Chunk 80 blocks per call (under 100 limit, with retry-safety margin)
    for i in range(0, len(page_blocks), 80):
        chunk = page_blocks[i:i + 80]
        for retry in range(3):
            try:
                api(f"/blocks/{pid}/children", {"children": chunk}, "PATCH")
                break
            except Exception as e:
                wait = 2 ** retry
                print(f"    retry {retry+1}/3 after {wait}s: {e}", file=sys.stderr)
                time.sleep(wait)
        else:
            print(f"    FAIL chunk {i}-{i+len(chunk)}", file=sys.stderr)

    print(f"  ✓ Block {idx} rebuilt")

print("\n=== ALL DONE ===")
