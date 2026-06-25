"""Upload V2 Architecture Blueprint to Notion."""
import json, sys
sys.path.insert(0, "/tmp")
from md_to_notion import (
    api, md_to_blocks, append_blocks, create_page,
    callout, divider, parse_inline,
)

ROOT = "3838dc27-4fcc-8096-a6cc-c320d19addc9"

data = json.load(open("/tmp/v2_blueprint.json"))
synth_md = data["synth"]["final_markdown"]
decision_points = data["synth"].get("decision_points", [])

print(f"Markdown size: {len(synth_md)} chars")

intro = [
    callout(
        "Полная переработка UI-слоя (мини-аппа + админка) поверх существующего бэкенда. "
        "Ключевое: Shadow Active модель — юзер не блокируется на moderation_pending, "
        "а живёт в приложении с фоновой верификацией.",
        "📐", "purple_background",
    ),
    callout(
        f"Собрано параллельно 5 доменными агентами + synthesizer. "
        f"Всего: 5 секций · {len(synth_md):,} chars · 12 open decisions для финального confirm.",
        "🤖", "gray_background",
    ),
    divider(),
]

print("Converting markdown to blocks...")
content_blocks = md_to_blocks(synth_md)
print(f"  {len(content_blocks)} blocks generated")

# Add decision points section at the end
deci_blocks = [
    divider(),
    {"object": "block", "type": "heading_1", "heading_1": {"rich_text": parse_inline("🔓 Open Decisions — требуют OK перед стартом кода")}},
    callout(
        "Эти 12 пунктов не разрешены автоматически в blueprint — требуется финальное решение от founder. "
        "После confirm — переходим к Stage 2 (код мини-аппы).",
        "⚠️", "yellow_background",
    ),
]
for i, dp in enumerate(decision_points, 1):
    deci_blocks.append({
        "object": "block", "type": "numbered_list_item",
        "numbered_list_item": {"rich_text": parse_inline(dp[:1900])},
    })

all_blocks = intro + content_blocks + deci_blocks
print(f"Total blocks: {len(all_blocks)}")

# Create page
print("Creating page...")
BLUEPRINT_PID = create_page(ROOT, "📐", "V2 Architecture Blueprint", all_blocks[:90])
print(f"  Page: {BLUEPRINT_PID}")

# Append rest
if len(all_blocks) > 90:
    print(f"Appending {len(all_blocks) - 90} more blocks in chunks of 80...")
    rest = all_blocks[90:]
    for i in range(0, len(rest), 80):
        chunk = rest[i:i + 80]
        for retry in range(3):
            try:
                api(f"/blocks/{BLUEPRINT_PID}/children", {"children": chunk}, "PATCH")
                break
            except Exception as e:
                import time
                wait = 2 ** retry
                print(f"  retry {retry+1}/3 after {wait}s: {e}", file=sys.stderr)
                time.sleep(wait)
        else:
            print(f"  FAIL chunk {i}-{i+len(chunk)}", file=sys.stderr)
        if (i // 80) % 5 == 0:
            print(f"  ... {i + len(chunk)}/{len(rest)}")

print(f"\nDONE — {BLUEPRINT_PID}")
print(f"Notion URL: https://notion.so/{BLUEPRINT_PID.replace('-', '')}")
