"""Markdown → Notion blocks converter + Notion API client."""
import re, json, urllib.request, urllib.error, sys

TOKEN = __import__("os").environ.get("NOTION_TOKEN") or open("/Users/fayzullohoja/Code/baxtlilar/.env.access").read().split("NOTION_TOKEN=")[1].split("\n")[0].strip()


def api(path, payload=None, method="POST"):
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Notion-Version": "2022-06-28",
    }
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode()
    req = urllib.request.Request(f"https://api.notion.com/v1{path}", data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"ERR {e.code} {method} {path}: {body[:500]}", file=sys.stderr)
        raise


# ─────────────────────────────────────────────────────────────────────
# Inline parsing — bold/italic/code/link → rich_text spans
# ─────────────────────────────────────────────────────────────────────

INLINE_PATTERN = re.compile(
    r"(\*\*[^\n*]+?\*\*|__[^\n_]+?__|"  # bold
    r"\*[^\n*]+?\*|_[^\n_]+?_|"  # italic
    r"`[^\n`]+?`|"  # code
    r"\[[^\]\n]+?\]\([^)\n]+?\))"  # link
)


def parse_inline(text):
    """Return list of rich_text dicts."""
    out = []
    pos = 0
    for m in INLINE_PATTERN.finditer(text):
        if m.start() > pos:
            out.append(_span(text[pos:m.start()]))
        tok = m.group()
        if tok.startswith("**") and tok.endswith("**"):
            out.append(_span(tok[2:-2], bold=True))
        elif tok.startswith("__") and tok.endswith("__"):
            out.append(_span(tok[2:-2], bold=True))
        elif tok.startswith("`") and tok.endswith("`"):
            out.append(_span(tok[1:-1], code=True))
        elif tok.startswith("[") and "](" in tok:
            label_end = tok.index("](")
            label = tok[1:label_end]
            url = tok[label_end + 2:-1]
            # Notion требует http(s):// — пропускаем relative/file/local ссылки
            if url.startswith(("http://", "https://", "mailto:")):
                out.append(_span(label, link=url))
            else:
                out.append(_span(label))
        elif (tok.startswith("*") and tok.endswith("*")) or (tok.startswith("_") and tok.endswith("_")):
            out.append(_span(tok[1:-1], italic=True))
        else:
            out.append(_span(tok))
        pos = m.end()
    if pos < len(text):
        out.append(_span(text[pos:]))
    out = [s for s in out if s["text"]["content"]]
    # Chunk spans that exceed 2000 chars
    final = []
    for s in out:
        content = s["text"]["content"]
        if len(content) <= 2000:
            final.append(s)
            continue
        for i in range(0, len(content), 1900):
            piece = dict(s)
            piece["text"] = dict(s["text"])
            piece["text"]["content"] = content[i:i + 1900]
            final.append(piece)
    # Notion limit: max 100 spans per rich_text array. Coalesce overflow.
    if len(final) > 100:
        # Keep first 99 + collapse rest to plain text (lose formatting in tail)
        head = final[:99]
        tail_text = "".join(s["text"]["content"] for s in final[99:])
        if len(tail_text) > 1900:
            tail_text = tail_text[:1900] + "…"
        head.append(_span(tail_text))
        final = head
    return final or [_span("")]


def _span(content, bold=False, italic=False, code=False, link=None):
    span = {
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
    if link:
        span["text"]["link"] = {"url": link}
    return span


# ─────────────────────────────────────────────────────────────────────
# Markdown → Notion blocks
# ─────────────────────────────────────────────────────────────────────

HEADER_RE = re.compile(r"^(#{1,6})\s+(.*)$")
BULLET_RE = re.compile(r"^[-*+]\s+(.*)$")
NUMBERED_RE = re.compile(r"^\d+[.)]\s+(.*)$")
QUOTE_RE = re.compile(r"^>\s?(.*)$")
HR_RE = re.compile(r"^[-*_]{3,}\s*$")
INDENTED_BULLET_RE = re.compile(r"^(\s+)([-*+])\s+(.*)$")
INDENTED_NUMBERED_RE = re.compile(r"^(\s+)(\d+[.)]\s+)(.*)$")
IMG_HTML_RE = re.compile(r"<img[^>]*>", re.IGNORECASE)
IMG_MD_RE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
TABLE_RE = re.compile(r"^\|.*\|$")


def md_to_blocks(md):
    """Convert markdown text → list of Notion blocks."""
    lines = md.split("\n")
    blocks = []
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        # Skip empty lines
        if not line:
            i += 1
            continue
        # Code block
        if line.strip().startswith("```"):
            lang = line.strip()[3:].strip() or "plain text"
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1  # skip closing
            code_content = "\n".join(code_lines)[:1900]
            valid_langs = {
                "abap", "arduino", "bash", "basic", "c", "clojure", "coffeescript", "c++", "c#",
                "css", "dart", "diff", "docker", "elixir", "elm", "erlang", "flow", "fortran",
                "f#", "gherkin", "glsl", "go", "graphql", "groovy", "haskell", "html", "java",
                "javascript", "json", "julia", "kotlin", "latex", "less", "lisp", "livescript",
                "lua", "makefile", "markdown", "markup", "matlab", "mermaid", "nix", "objective-c",
                "ocaml", "pascal", "perl", "php", "plain text", "powershell", "prolog", "protobuf",
                "python", "r", "reason", "ruby", "rust", "sass", "scala", "scheme", "scss", "shell",
                "sql", "swift", "typescript", "vb.net", "verilog", "vhdl", "visual basic",
                "webassembly", "xml", "yaml",
            }
            language = lang.lower() if lang.lower() in valid_langs else "plain text"
            blocks.append({
                "object": "block",
                "type": "code",
                "code": {
                    "rich_text": [_span(code_content)],
                    "language": language,
                },
            })
            continue
        # Heading
        m = HEADER_RE.match(line)
        if m:
            level = min(len(m.group(1)), 3)
            text = m.group(2).strip()
            blocks.append({
                "object": "block",
                "type": f"heading_{level}",
                f"heading_{level}": {"rich_text": parse_inline(text)},
            })
            i += 1
            continue
        # Horizontal rule
        if HR_RE.match(line):
            blocks.append({"object": "block", "type": "divider", "divider": {}})
            i += 1
            continue
        # Image
        if IMG_HTML_RE.search(line) or IMG_MD_RE.search(line):
            blocks.append({
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": [_span("[изображение из docx — см. оригинал]", italic=True)]},
            })
            i += 1
            continue
        # Table — collect rows, convert to plain text
        if TABLE_RE.match(line):
            table_lines = []
            while i < len(lines) and TABLE_RE.match(lines[i].strip()):
                table_lines.append(lines[i].strip())
                i += 1
            # Skip separator line if present
            cells_rows = []
            for tl in table_lines:
                # Skip pure separator like |---|---|
                if re.match(r"^\|[-:|\s]+\|$", tl):
                    continue
                # Split cells
                cells = [c.strip() for c in tl.strip("|").split("|")]
                cells_rows.append(cells)
            # Render as plain bulleted paragraph
            for row in cells_rows:
                if any(c for c in row):
                    blocks.append({
                        "object": "block",
                        "type": "paragraph",
                        "paragraph": {"rich_text": parse_inline(" · ".join(row))},
                    })
            continue
        # Quote
        m = QUOTE_RE.match(line)
        if m:
            text = m.group(1)
            blocks.append({
                "object": "block",
                "type": "quote",
                "quote": {"rich_text": parse_inline(text)},
            })
            i += 1
            continue
        # Bullet list
        m = BULLET_RE.match(line)
        if m:
            blocks.append({
                "object": "block",
                "type": "bulleted_list_item",
                "bulleted_list_item": {"rich_text": parse_inline(m.group(1))},
            })
            i += 1
            continue
        # Numbered list
        m = NUMBERED_RE.match(line)
        if m:
            blocks.append({
                "object": "block",
                "type": "numbered_list_item",
                "numbered_list_item": {"rich_text": parse_inline(m.group(1))},
            })
            i += 1
            continue
        # Indented bullet (nested) — flatten to root level bullet with prefix
        m = INDENTED_BULLET_RE.match(line)
        if m:
            blocks.append({
                "object": "block",
                "type": "bulleted_list_item",
                "bulleted_list_item": {"rich_text": parse_inline("  " + m.group(3))},
            })
            i += 1
            continue
        # Plain paragraph (join consecutive non-empty lines)
        para_lines = [line]
        i += 1
        while i < len(lines):
            nxt = lines[i].rstrip()
            if not nxt:
                break
            # Stop if next line is a special block starter
            if (HEADER_RE.match(nxt) or BULLET_RE.match(nxt) or NUMBERED_RE.match(nxt)
                or QUOTE_RE.match(nxt) or HR_RE.match(nxt) or TABLE_RE.match(nxt)
                or nxt.strip().startswith("```")):
                break
            para_lines.append(nxt)
            i += 1
        text = " ".join(para_lines).strip()
        if text:
            # Notion paragraph can hold up to ~2000 chars in rich_text; chunk if needed
            if len(text) <= 1900:
                blocks.append({
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {"rich_text": parse_inline(text)},
                })
            else:
                # Split big paragraph into smaller blocks
                for start in range(0, len(text), 1900):
                    chunk = text[start:start + 1900]
                    blocks.append({
                        "object": "block",
                        "type": "paragraph",
                        "paragraph": {"rich_text": parse_inline(chunk)},
                    })
    return blocks


# ─────────────────────────────────────────────────────────────────────
# Page utilities
# ─────────────────────────────────────────────────────────────────────

def append_blocks(page_id, blocks, chunk=90):
    """Append blocks, chunking under 100-block API limit."""
    for i in range(0, len(blocks), chunk):
        api(f"/blocks/{page_id}/children", {"children": blocks[i:i + chunk]}, "PATCH")


def get_children(page_id):
    res = api(f"/blocks/{page_id}/children?page_size=100", method="GET")
    return res.get("results", [])


def del_block(block_id):
    try:
        api(f"/blocks/{block_id}", method="DELETE")
    except Exception:
        pass


def reset_page(page_id):
    for b in get_children(page_id):
        del_block(b["id"])


def create_page(parent_id, emoji, title, initial_blocks=None):
    payload = {
        "parent": {"page_id": parent_id},
        "icon": {"emoji": emoji},
        "properties": {"title": {"title": [{"text": {"content": title}}]}},
    }
    if initial_blocks:
        payload["children"] = initial_blocks[:90]
    r = api("/pages", payload)
    pid = r["id"]
    if initial_blocks and len(initial_blocks) > 90:
        append_blocks(pid, initial_blocks[90:])
    return pid


def callout(text, emoji="📌", color="gray_background"):
    return {
        "object": "block",
        "type": "callout",
        "callout": {
            "icon": {"emoji": emoji},
            "color": color,
            "rich_text": parse_inline(text[:1900]),
        },
    }


def divider():
    return {"object": "block", "type": "divider", "divider": {}}
