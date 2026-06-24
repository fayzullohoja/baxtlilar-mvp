"""Retry Q&A DB creation with comma-free option names."""
import json, sys, time
sys.path.insert(0, "/tmp")
from md_to_notion import api

QUESTIONNAIRE = "3898dc27-4fcc-81fd-bf68-dc78c0b78060"
DATA = json.load(open("/private/tmp/claude-501/-Users-fayzullohoja-Desktop/16767afb-765f-413e-a40c-e8e93ab99655/tasks/wzg6vksig.output"))
blocks_data = DATA["result"]["organized"]["blocks"]


def safe_name(s):
    """Notion select options не допускают commas. Заменяем."""
    return s.replace(",", " ·")


# Build sets of names
block_names = [safe_name(b["title"]) for b in blocks_data]
dimension_names = sorted(set(safe_name(q["dimension"]) for b in blocks_data for q in b["questions"]))

print(f"Block options: {len(block_names)}")
for n in block_names:
    print(f"  - {n}")
print(f"\nDimension options: {len(dimension_names)}")
for n in dimension_names:
    print(f"  - {n}")

# 1) Create DB
db_payload = {
    "parent": {"page_id": QUESTIONNAIRE},
    "icon": {"emoji": "🗃"},
    "title": [{"text": {"content": "Q&A Sessions Log"}}],
    "properties": {
        "Question": {"title": {}},
        "Block": {"select": {"options": [{"name": n, "color": "default"} for n in block_names]}},
        "Dimension": {"select": {"options": [{"name": n, "color": "default"} for n in dimension_names]}},
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
print(f"\nDB: {DB_QA}")

# 2) Pre-populate 179 rows
print("\nPopulating 179 rows...")
total = sum(len(b["questions"]) for b in blocks_data)
done = 0
for b in blocks_data:
    block_name = safe_name(b["title"])
    for q in b["questions"]:
        try:
            api("/pages", {
                "parent": {"database_id": DB_QA},
                "properties": {
                    "Question": {"title": [{"text": {"content": q["q"][:1900]}}]},
                    "Block": {"select": {"name": block_name}},
                    "Dimension": {"select": {"name": safe_name(q["dimension"])}},
                    "Source": {"select": {"name": q["source"]}},
                    "Cost": {"select": {"name": q["cost"]}},
                    "Status": {"select": {"name": "Pending"}},
                    "Unlocks": {"rich_text": [{"text": {"content": q["unlocks"][:1900]}}]},
                },
            })
            done += 1
            if done % 25 == 0:
                print(f"  ... {done}/{total}")
        except Exception as e:
            print(f"  ERR on Q{done+1}: {e}", file=sys.stderr)

print(f"\nDONE — {done}/{total} rows")
print(f"DB ID: {DB_QA}")
