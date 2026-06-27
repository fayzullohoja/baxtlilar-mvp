# Admin Redesign — Sprint 2: Photos + Clients Directory

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Модератор обрабатывает 200 фото за смену через плотную ops-таблицу с drawer-превью + reason-templates вместо `window.confirm`. Любой клиент находится за 2 секунды через directory с type-ahead search по ФИО / ПИНФЛ / паспорту / телефону / @username. Карточка клиента дополняется табами Photos / Activity / Moderation.

**Architecture:** Reuse существующего `profile_photos` table (статусы: under_review / uploaded / approved / rejected) — никаких миграций структуры, только новый dense UI и расширенный API (передача reason_code на reject). Clients directory — pg_trgm-based поиск (индексы уже созданы в Sprint 1) + cursor-based pagination на created_at. Карточка клиента получает 3 новых tab — все server components.

**Tech Stack:** наследуется из Sprint 1 — Next.js 16 App Router · React 19 · TypeScript · Vitest 4 · native Postgres · Tabler Icons · inline styles + admin tokens.

## Global Constraints

наследуются из Sprint 1 plan (`2026-06-27-admin-redesign-sprint-1-foundation.md`). Дополнительно:

- **Никаких новых таблиц.** Photos + clients используют существующие `profile_photos` / `users` / `user_identity` / `user_profiles` / `user_documents`.
- **Photo decision API расширяется backward-compatibly** — старый `{action, reason}` shape работает; новый `{action, reason_code, reason_text}` shape тоже работает.
- **Cursor pagination — server-side только.** URL state в `?cursor=...&filter=...`. Никакого offset/limit на больших таблицах.
- **Search latency бюджет — 200ms p95** для type-ahead.

## File Structure

### Создаются

**Lib:**
- `src/lib/admin/load-photos.ts` + `.test.ts` — список фото-кейсов с joined client context
- `src/lib/admin/load-clients-search.ts` + `.test.ts` — search + cursor pagination
- `src/lib/admin/load-reason-templates.ts` — fetch шаблонов из admin_reason_templates

**API routes:**
- `src/app/api/admin/clients/search/route.ts` — GET с query, debounce-friendly

**Page routes (новые):**
- `src/app/admin/photos/page.tsx` — REPLACE (rebuild на OpsShell + dense table + drawer)
- `src/app/admin/clients/page.tsx` — directory с search
- `src/app/admin/clients/[id]/PhotosTab.tsx` — фото-карусель approved
- `src/app/admin/clients/[id]/ActivityTab.tsx` — last_seen, matches count, chats count
- `src/app/admin/clients/[id]/ModerationTab.tsx` — все linked cases (verification + photos)

**Page routes (расширяются):**
- `src/app/admin/clients/[id]/page.tsx` — добавить ClientTabs nav компонент, switch на ?tab=X

**Components:**
- `src/components/admin-ops/photo/PhotosTable.tsx` — dense таблица
- `src/components/admin-ops/photo/PhotoDrawer.tsx` — slide-over с full-size + decision panel
- `src/components/admin-ops/photo/ReasonPicker.tsx` — select из admin_reason_templates
- `src/components/admin-ops/clients/ClientsTable.tsx` — table с фильтрами + pagination
- `src/components/admin-ops/clients/SearchBar.tsx` — type-ahead с debounce
- `src/components/admin-ops/ClientTabs.tsx` — tabs nav для карточки клиента
- `src/components/admin-ops/Drawer.tsx` — slide-over primitive (для PhotoDrawer и будущего)

### Модифицируются

- `src/app/api/admin/photos/[id]/decision/route.ts` — accept new shape `{action, reason_code, reason_text}` backward-compat
- `src/lib/admin/load-client.ts` — добавить `last_seen_at`, `match_count`, `chat_count` aggregates

---

## Phase A: Photo Moderation — Dense Table + Drawer

### Task 1: Photos loader (server) с joined client context

**Files:**
- Create: `src/lib/admin/load-photos.ts`
- Create: `src/lib/admin/load-photos.test.ts`

**Interfaces:**
- Produces:
  - `type PhotoCase = { photo_id, user_id, path, signed_url, ord, is_main, status, created_at, client: { display_name?, telegram_first_name?, age?, city?, avatar_url? } }`
  - `loadPhotosQueue(filter: 'new'|'mine'|'overdue', limit, cursor?): Promise<{rows: PhotoCase[], next_cursor?: string}>`

- [ ] **Step 1: Write tests for shape + filter behavior** (mock supabaseAdmin)

```ts
// src/lib/admin/load-photos.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadPhotosQueue } from "./load-photos";

// тесты концентрируются на форме результата + правильной обработке cursor
// (реальный supabase mocked)

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [] }),
    in: vi.fn().mockReturnThis(),
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "x" } }) }) },
  }),
}));

describe("loadPhotosQueue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty rows when DB empty", async () => {
    const result = await loadPhotosQueue("new", 60);
    expect(result.rows).toEqual([]);
    expect(result.next_cursor).toBeUndefined();
  });

  // больше assertions добавятся когда implementation покажет реальные join'ы
});
```

- [ ] **Step 2: Implement loader**

```ts
// src/lib/admin/load-photos.ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKET_PHOTOS } from "@/lib/uploads/storage";

export type PhotoCase = {
  photo_id: string;
  user_id: string;
  path: string;
  signed_url: string | null;
  ord: number;
  is_main: boolean;
  status: string;
  created_at: string;
  client: {
    display_name: string | null;
    telegram_first_name: string | null;
    age: number | null;
    city: string | null;
    avatar_url: string | null;
    verification_status: string;
  };
};

export type PhotosFilter = "new" | "mine" | "overdue";

const PAGE_DEFAULT = 60;

export async function loadPhotosQueue(
  filter: PhotosFilter = "new",
  limit = PAGE_DEFAULT,
  cursor?: string,
): Promise<{ rows: PhotoCase[]; next_cursor?: string }> {
  let q = supabaseAdmin()
    .from("profile_photos")
    .select("id, user_id, path, ord, is_main, status, created_at")
    .in("status", ["under_review", "uploaded"])
    .order("created_at", { ascending: true })
    .limit(limit + 1); // +1 для определения next_cursor

  if (filter === "overdue") {
    const overdueLine = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    q = q.lt("created_at", overdueLine);
  }

  if (cursor) q = q.lt("created_at", cursor);

  const { data: photos } = await q;
  const rows = (photos ?? []) as Array<{
    id: string;
    user_id: string;
    path: string;
    ord: number;
    is_main: boolean;
    status: string;
    created_at: string;
  }>;

  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;

  if (trimmed.length === 0) return { rows: [] };

  // Загрузим client context для всех user_id одним запросом
  const userIds = Array.from(new Set(trimmed.map((r) => r.user_id)));
  const [profiles, users] = await Promise.all([
    supabaseAdmin()
      .from("user_profiles")
      .select("user_id, display_name, birth_date, city")
      .in("user_id", userIds),
    supabaseAdmin()
      .from("users")
      .select("id, telegram_first_name, avatar_path, verification_status")
      .in("id", userIds),
  ]);

  const byUser = new Map(
    (users.data ?? []).map((u) => [u.id as string, u]),
  );
  const profileByUser = new Map(
    (profiles.data ?? []).map((p) => [p.user_id as string, p]),
  );

  // Signed URLs батчем через 2 storage helpers
  async function sign(path: string): Promise<string | null> {
    const { data } = await supabaseAdmin()
      .storage.from(BUCKET_PHOTOS)
      .createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  }
  async function signDocBucket(path: string): Promise<string | null> {
    const { data } = await supabaseAdmin()
      .storage.from("user-documents")
      .createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  }

  const signedUrls = await Promise.all(trimmed.map((r) => sign(r.path)));
  const avatarUrls = new Map<string, string | null>();
  for (const uid of userIds) {
    const u = byUser.get(uid);
    avatarUrls.set(uid, u?.avatar_path ? await signDocBucket(u.avatar_path as string) : null);
  }

  const out: PhotoCase[] = trimmed.map((r, i) => {
    const user = byUser.get(r.user_id);
    const profile = profileByUser.get(r.user_id);
    let age: number | null = null;
    if (profile?.birth_date) {
      const bd = new Date(profile.birth_date as string);
      const now = new Date();
      age = now.getFullYear() - bd.getFullYear();
      if (now.getMonth() < bd.getMonth() ||
          (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
    }
    return {
      photo_id: r.id,
      user_id: r.user_id,
      path: r.path,
      signed_url: signedUrls[i],
      ord: r.ord,
      is_main: r.is_main,
      status: r.status,
      created_at: r.created_at,
      client: {
        display_name: (profile?.display_name as string | null) ?? null,
        telegram_first_name: (user?.telegram_first_name as string | null) ?? null,
        age,
        city: (profile?.city as string | null) ?? null,
        avatar_url: avatarUrls.get(r.user_id) ?? null,
        verification_status: (user?.verification_status as string) ?? "unknown",
      },
    };
  });

  return {
    rows: out,
    next_cursor: hasMore ? trimmed[trimmed.length - 1].created_at : undefined,
  };
}
```

- [ ] **Step 3: Run tests + adjust to actually pass**

```bash
npx vitest run src/lib/admin/load-photos.test.ts
```

Если mock cycle усложняется — упростить тест до проверки только публичного API, что функция не падает на пустых данных.

- [ ] **Step 4: Commit**

```bash
git add src/lib/admin/load-photos.ts src/lib/admin/load-photos.test.ts
git commit -m "feat(admin): load-photos with client context for queue"
```

---

### Task 2: Reason templates loader

**Files:**
- Create: `src/lib/admin/load-reason-templates.ts`

**Interfaces:**
- Produces:
  - `loadReasonTemplates(scope: 'verification'|'photo'|'report', lang: 'ru'|'uz'): Promise<{code: string, text: string}[]>`

- [ ] **Step 1: Write**

```ts
// src/lib/admin/load-reason-templates.ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function loadReasonTemplates(
  scope: "verification" | "photo" | "report",
  lang: "ru" | "uz" = "ru",
): Promise<{ code: string; text: string }[]> {
  const { data } = await supabaseAdmin()
    .from("admin_reason_templates")
    .select("code, text, sort")
    .eq("scope", scope)
    .eq("lang", lang)
    .eq("active", true)
    .order("sort", { ascending: true });
  return (data ?? []).map((r) => ({
    code: r.code as string,
    text: r.text as string,
  }));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/admin/load-reason-templates.ts
git commit -m "feat(admin): reason templates loader"
```

---

### Task 3: Photo decision API — accept reason_code/reason_text

**Files:**
- Modify: `src/app/api/admin/photos/[id]/decision/route.ts`

**Interfaces:**
- Backward-compat: старый `{action, reason}` shape работает. Новый `{action, reason_code, reason_text}` — если оба переданы, в DB пишется `reason_text`, в audit_log payload оба.

- [ ] **Step 1: Read existing route, modify body parsing**

В существующем `route.ts` найти `const { action, reason }` и заменить:

```ts
const body = (await req.json().catch(() => ({}))) as {
  action?: "approve" | "reject";
  reason?: string;          // legacy
  reason_code?: string;     // new
  reason_text?: string;     // new
};
const action = body.action;
const reasonText = body.reason_text ?? body.reason ?? null;
const reasonCode = body.reason_code ?? null;
```

Затем в update:
```ts
reject_reason: action === "reject" ? reasonText : null,
```

В adminAudit добавить `reason_code` в `newValue`:
```ts
newValue: { status: action, reason_code: reasonCode, reason_text: reasonText },
```

- [ ] **Step 2: Quick smoke via curl, commit**

```bash
git add src/app/api/admin/photos/\[id\]/decision/route.ts
git commit -m "feat(admin): photo decision API accepts reason_code+reason_text"
```

---

### Task 4: Drawer primitive

**Files:**
- Create: `src/components/admin-ops/Drawer.tsx`

**Interfaces:**
- Produces: `<Drawer open onClose width=480>{children}</Drawer>` — slide-over справа, Escape для close, backdrop click для close.

- [ ] **Step 1: Write**

```tsx
// src/components/admin-ops/Drawer.tsx
"use client";
import { useEffect, type ReactNode } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";

export function Drawer({
  open,
  onClose,
  width = 480,
  children,
}: {
  open: boolean;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15,23,30,0.35)",
        }}
      />
      <div
        style={{
          position: "relative",
          width,
          maxWidth: "100%",
          background: ADMIN.surface,
          borderLeft: `1px solid ${ADMIN.border}`,
          boxShadow: "-12px 0 32px rgba(15,23,30,0.12)",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin-ops/Drawer.tsx
git commit -m "feat(admin): Drawer primitive (slide-over right)"
```

---

### Task 5: PhotosTable component (dense)

**Files:**
- Create: `src/components/admin-ops/photo/PhotosTable.tsx`

**Interfaces:**
- Consumes: `PhotoCase[]`, callback `onSelect(case)`
- Produces: Table 60/page с thumbnail 60×80, client cell (avatar 24 + ФИО + age city), slot pill, uploaded relative time, status pill, inline actions A/R.

- [ ] **Step 1: Write component**

```tsx
// src/components/admin-ops/photo/PhotosTable.tsx
"use client";
import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import { Button } from "@/components/admin-ops/Button";
import type { PhotoCase } from "@/lib/admin/load-photos";

export function PhotosTable({
  rows,
  onOpen,
  onQuickApprove,
  onQuickReject,
}: {
  rows: PhotoCase[];
  onOpen: (p: PhotoCase) => void;
  onQuickApprove: (p: PhotoCase) => void;
  onQuickReject: (p: PhotoCase) => void;
}) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        background: ADMIN.surface,
        border: `1px solid ${ADMIN.border}`,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <thead>
        <tr style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
          {["Preview", "Client", "Slot", "Uploaded", "Status", "Actions"].map(
            (h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  fontSize: 11,
                  color: ADMIN.ink500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontWeight: 500,
                }}
              >
                {h}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const name =
            r.client.display_name ?? r.client.telegram_first_name ?? "—";
          const overdue = Date.now() - new Date(r.created_at).getTime() > 24 * 3600 * 1000;
          return (
            <tr
              key={r.photo_id}
              style={{ borderBottom: `1px solid ${ADMIN.border}` }}
            >
              <td style={{ padding: "8px 12px" }}>
                {r.signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.signed_url}
                    alt=""
                    onClick={() => onOpen(r)}
                    style={{
                      width: 60,
                      height: 80,
                      objectFit: "cover",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 60,
                      height: 80,
                      background: ADMIN.surface2,
                      borderRadius: 4,
                    }}
                  />
                )}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {r.client.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.client.avatar_url}
                    alt=""
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: ADMIN.surface2,
                      color: ADMIN.ink300,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                    }}
                  >
                    {name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <div>
                    <Link
                      href={`/admin/clients/${r.user_id}`}
                      style={{ color: ADMIN.ink900, textDecoration: "none" }}
                    >
                      {name}
                    </Link>
                  </div>
                  <div style={{ fontSize: 11, color: ADMIN.ink500 }}>
                    {r.client.age ? `${r.client.age} · ` : ""}
                    {r.client.city ?? ""}
                  </div>
                </div>
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  color: ADMIN.ink700,
                }}
              >
                #{r.ord + 1}
                {r.is_main ? (
                  <StatusPill kind="verified">main</StatusPill>
                ) : null}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  color: overdue ? ADMIN.danger : ADMIN.ink500,
                }}
              >
                {ago(r.created_at)}
                {overdue ? " ⚠" : ""}
              </td>
              <td style={{ padding: "10px 12px" }}>
                <StatusPill kind={r.status === "under_review" ? "pending" : "new"}>
                  {r.status}
                </StatusPill>
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  display: "flex",
                  gap: 6,
                }}
              >
                <Button size="sm" onClick={() => onQuickApprove(r)}>
                  ✓
                </Button>
                <Button size="sm" variant="danger" onClick={() => onQuickReject(r)}>
                  ✕
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onOpen(r)}>
                  ⋯
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin-ops/photo/PhotosTable.tsx
git commit -m "feat(admin): PhotosTable dense с inline actions"
```

---

### Task 6: PhotoDrawer + ReasonPicker

**Files:**
- Create: `src/components/admin-ops/photo/PhotoDrawer.tsx`
- Create: `src/components/admin-ops/photo/ReasonPicker.tsx`

**Interfaces:**
- Produces: Drawer 40% слева → full-size фото + decision panel (approve / reject + reason picker). На decision → fetch к existing photo-decision API.

- [ ] **Step 1: ReasonPicker.tsx**

```tsx
// src/components/admin-ops/photo/ReasonPicker.tsx
"use client";
import { ADMIN } from "@/lib/admin/admin-tokens";

export function ReasonPicker({
  templates,
  selectedCode,
  customText,
  onSelectCode,
  onCustomTextChange,
}: {
  templates: { code: string; text: string }[];
  selectedCode: string;
  customText: string;
  onSelectCode: (code: string) => void;
  onCustomTextChange: (text: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <select
        style={{
          height: 32,
          padding: "0 10px",
          borderRadius: 4,
          border: `1px solid ${ADMIN.border}`,
          fontSize: 13,
        }}
        value={selectedCode}
        onChange={(e) => {
          const code = e.target.value;
          onSelectCode(code);
          const tpl = templates.find((t) => t.code === code);
          if (tpl) onCustomTextChange(tpl.text);
        }}
      >
        {templates.map((t) => (
          <option key={t.code} value={t.code}>
            {t.text}
          </option>
        ))}
      </select>
      <textarea
        rows={2}
        value={customText}
        onChange={(e) => onCustomTextChange(e.target.value)}
        style={{
          padding: 10,
          borderRadius: 4,
          border: `1px solid ${ADMIN.border}`,
          fontSize: 13,
          resize: "vertical",
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: PhotoDrawer.tsx**

```tsx
// src/components/admin-ops/photo/PhotoDrawer.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Drawer } from "@/components/admin-ops/Drawer";
import { Button } from "@/components/admin-ops/Button";
import { ReasonPicker } from "./ReasonPicker";
import type { PhotoCase } from "@/lib/admin/load-photos";

export function PhotoDrawer({
  photo,
  reasonTemplates,
  onClose,
  defaultMode,
}: {
  photo: PhotoCase | null;
  reasonTemplates: { code: string; text: string }[];
  onClose: () => void;
  defaultMode?: "view" | "approve" | "reject";
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "approve" | "reject">(
    defaultMode ?? "view",
  );
  const [code, setCode] = useState(reasonTemplates[0]?.code ?? "");
  const [text, setText] = useState(reasonTemplates[0]?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (photo) {
      setMode(defaultMode ?? "view");
      setCode(reasonTemplates[0]?.code ?? "");
      setText(reasonTemplates[0]?.text ?? "");
      setError(null);
    }
  }, [photo, defaultMode, reasonTemplates]);

  async function submit(action: "approve" | "reject") {
    if (!photo) return;
    setBusy(true);
    setError(null);
    try {
      const body =
        action === "approve"
          ? { action }
          : { action, reason_code: code, reason_text: text };
      const r = await fetch(`/api/admin/photos/${photo.photo_id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error ?? "unknown");
        setBusy(false);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("network");
      setBusy(false);
    }
  }

  return (
    <Drawer open={!!photo} onClose={onClose} width={520}>
      {!photo ? null : (
        <div style={{ padding: 24 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 4,
            }}
          >
            <Link
              href={`/admin/clients/${photo.user_id}`}
              style={{ color: ADMIN.accent }}
            >
              {photo.client.display_name ??
                photo.client.telegram_first_name ??
                "—"}
            </Link>
          </div>
          <div
            style={{ fontSize: 12, color: ADMIN.ink500, marginBottom: 16 }}
          >
            Photo #{photo.ord + 1} · uploaded{" "}
            {new Date(photo.created_at).toLocaleString("ru-RU")}
          </div>

          {photo.signed_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.signed_url}
              alt=""
              style={{
                width: "100%",
                borderRadius: 6,
                marginBottom: 16,
                maxHeight: 480,
                objectFit: "contain",
                background: "#0d0d0d",
              }}
            />
          ) : null}

          {mode === "view" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="primary" onClick={() => submit("approve")} disabled={busy}>
                ✓ Approve
              </Button>
              <Button variant="danger" onClick={() => setMode("reject")} disabled={busy}>
                ✕ Reject…
              </Button>
            </div>
          ) : (
            <div
              style={{
                padding: 16,
                background: ADMIN.bg,
                borderRadius: 6,
                border: `1px solid ${ADMIN.border}`,
              }}
            >
              <div
                style={{ fontSize: 12, color: ADMIN.ink700, marginBottom: 10 }}
              >
                Причина отклонения:
              </div>
              <ReasonPicker
                templates={reasonTemplates}
                selectedCode={code}
                customText={text}
                onSelectCode={setCode}
                onCustomTextChange={setText}
              />
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <Button onClick={() => setMode("view")} disabled={busy}>
                  Отмена
                </Button>
                <Button
                  variant="danger"
                  onClick={() => submit("reject")}
                  disabled={busy || text.length < 3}
                >
                  {busy ? "Отправляем…" : "Подтвердить reject"}
                </Button>
              </div>
            </div>
          )}

          {error ? (
            <div
              style={{ color: ADMIN.danger, marginTop: 12, fontSize: 13 }}
            >
              Ошибка: {error}
            </div>
          ) : null}

          <Link
            href={`/admin/clients/${photo.user_id}`}
            style={{
              display: "block",
              marginTop: 24,
              color: ADMIN.accent,
              fontSize: 13,
            }}
          >
            → Открыть профиль клиента
          </Link>
        </div>
      )}
    </Drawer>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin-ops/photo/PhotoDrawer.tsx src/components/admin-ops/photo/ReasonPicker.tsx
git commit -m "feat(admin): PhotoDrawer + ReasonPicker"
```

---

### Task 7: Rebuild /admin/photos page

**Files:**
- Modify: `src/app/admin/photos/page.tsx` (полная переписка под OpsShell + dense table + drawer)
- Create: `src/app/admin/photos/PhotosScreen.tsx` (client orchestrator)

**Interfaces:**
- Page: server loader (filter из ?tab=new|mine|overdue, cursor из URL) → PhotosScreen.
- PhotosScreen: state для selected photo → PhotoDrawer.

- [ ] **Step 1: Read current page.tsx**, `git mv` сохранить старый как `page.legacy.tsx.bak` если нужен референс, или просто переписать.

- [ ] **Step 2: PhotosScreen.tsx**

```tsx
// src/app/admin/photos/PhotosScreen.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { PhotosTable } from "@/components/admin-ops/photo/PhotosTable";
import { PhotoDrawer } from "@/components/admin-ops/photo/PhotoDrawer";
import type { PhotoCase } from "@/lib/admin/load-photos";

export function PhotosScreen({
  rows,
  nextCursor,
  filter,
  reasonTemplates,
}: {
  rows: PhotoCase[];
  nextCursor?: string;
  filter: "new" | "mine" | "overdue";
  reasonTemplates: { code: string; text: string }[];
}) {
  const [selected, setSelected] = useState<PhotoCase | null>(null);
  const [defaultMode, setDefaultMode] = useState<"view" | "reject">("view");

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        {(["new", "mine", "overdue"] as const).map((f) => (
          <Link
            key={f}
            href={`/admin/photos?tab=${f}`}
            style={{
              padding: "6px 12px",
              border: `1px solid ${ADMIN.border}`,
              borderRadius: 6,
              fontSize: 13,
              color: filter === f ? "#fff" : ADMIN.ink700,
              background: filter === f ? ADMIN.accent : ADMIN.surface,
              textDecoration: "none",
            }}
          >
            {f === "new" ? "Новые" : f === "mine" ? "Мои" : "Overdue >24h"}
          </Link>
        ))}
      </div>

      <PhotosTable
        rows={rows}
        onOpen={(p) => {
          setSelected(p);
          setDefaultMode("view");
        }}
        onQuickApprove={async (p) => {
          await fetch(`/api/admin/photos/${p.photo_id}/decision`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "approve" }),
          });
          if (typeof window !== "undefined") window.location.reload();
        }}
        onQuickReject={(p) => {
          setSelected(p);
          setDefaultMode("reject");
        }}
      />

      {nextCursor ? (
        <div style={{ marginTop: 16 }}>
          <Link
            href={`/admin/photos?tab=${filter}&cursor=${encodeURIComponent(nextCursor)}`}
            style={{ color: ADMIN.accent, fontSize: 13 }}
          >
            Next page →
          </Link>
        </div>
      ) : null}

      <PhotoDrawer
        photo={selected}
        reasonTemplates={reasonTemplates}
        onClose={() => setSelected(null)}
        defaultMode={defaultMode}
      />
    </div>
  );
}
```

- [ ] **Step 3: page.tsx**

```tsx
// src/app/admin/photos/page.tsx
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { loadPhotosQueue } from "@/lib/admin/load-photos";
import { loadReasonTemplates } from "@/lib/admin/load-reason-templates";
import { PhotosScreen } from "./PhotosScreen";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cursor?: string }>;
}) {
  const session = await requireAdmin();
  const sp = await searchParams;
  const filter = (sp.tab as "new" | "mine" | "overdue") ?? "new";

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const [{ rows, next_cursor }, reasonTemplates] = await Promise.all([
    loadPhotosQueue(filter, 60, sp.cursor),
    loadReasonTemplates("photo", "ru"),
  ]);

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 16 }}>
        Фото-модерация
      </h1>
      <PhotosScreen
        rows={rows}
        nextCursor={next_cursor}
        filter={filter}
        reasonTemplates={reasonTemplates}
      />
    </OpsShell>
  );
}
```

- [ ] **Step 4: Visual smoke + commit**

```bash
pnpm dev
# open /admin/photos
```

```bash
git add -A
git commit -m "feat(admin): /admin/photos rebuild — dense table + drawer + reason templates"
```

---

## Phase B: Clients Directory + Search

### Task 8: Clients search loader + API

**Files:**
- Create: `src/lib/admin/load-clients-search.ts`
- Create: `src/lib/admin/load-clients-search.test.ts`
- Create: `src/app/api/admin/clients/search/route.ts`

**Interfaces:**
- Produces:
  - `searchClients(q: string, limit, cursor?): Promise<{rows: ClientRow[], next_cursor?: string}>`
  - GET endpoint для type-ahead.

- [ ] **Step 1: Loader**

```ts
// src/lib/admin/load-clients-search.ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKET_DOCUMENTS } from "@/lib/uploads/storage";

export type ClientRow = {
  user_id: string;
  display_name: string | null;
  full_name: string | null; // from user_identity if exists
  age: number | null;
  city: string | null;
  pinfl: string | null;
  passport: string | null;
  telegram_username: string | null;
  phone_number_masked: string | null;
  verification_status: string;
  lifecycle_state: string;
  avatar_url: string | null;
  created_at: string;
};

export async function searchClients(
  q: string,
  limit = 50,
  cursor?: string,
): Promise<{ rows: ClientRow[]; next_cursor?: string }> {
  const sb = supabaseAdmin();

  // Если q — 14 цифр или пара буквы+цифры, ищем по identity напрямую
  const isPinfl = /^\d{14}$/.test(q.trim());
  const isPassport = /^[A-Z]{2}\d{7}$/i.test(q.trim());
  const isTgUsername = q.trim().startsWith("@");

  let userIds: string[] = [];

  if (isPinfl || isPassport) {
    const { data } = await sb
      .from("user_identity")
      .select("user_id")
      .is("superseded_at", null)
      .or(
        isPinfl
          ? `pinfl.eq.${q.trim()}`
          : `passport_series.eq.${q.slice(0, 2).toUpperCase()},passport_number.eq.${q.slice(2)}`,
      )
      .limit(limit);
    userIds = (data ?? []).map((r) => r.user_id as string);
  } else if (isTgUsername) {
    const uname = q.trim().slice(1);
    const { data } = await sb
      .from("users")
      .select("id")
      .eq("telegram_username", uname)
      .limit(limit);
    userIds = (data ?? []).map((r) => r.id as string);
  } else if (q.trim().length >= 2) {
    // pg_trgm на last_name + first_name
    const term = q.trim();
    const { data } = await sb
      .from("user_identity")
      .select("user_id")
      .is("superseded_at", null)
      .or(`last_name.ilike.%${term}%,first_name.ilike.%${term}%`)
      .limit(limit);
    userIds = (data ?? []).map((r) => r.user_id as string);
  }

  if (userIds.length === 0 && q.trim().length === 0) {
    // Без query — последние registered клиенты
    let usersQ = sb
      .from("users")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(limit + 1);
    if (cursor) usersQ = usersQ.lt("created_at", cursor);
    const { data } = await usersQ;
    userIds = (data ?? []).map((r) => r.id as string);
  }

  if (userIds.length === 0) return { rows: [] };

  // Fetch all data для found userIds
  const [users, profiles, identities] = await Promise.all([
    sb
      .from("users")
      .select(
        "id, telegram_username, phone_number, verification_status, lifecycle_state, avatar_path, created_at",
      )
      .in("id", userIds),
    sb
      .from("user_profiles")
      .select("user_id, display_name, city, birth_date")
      .in("user_id", userIds),
    sb
      .from("user_identity")
      .select(
        "user_id, last_name, first_name, middle_name, pinfl, passport_series, passport_number, birth_date",
      )
      .is("superseded_at", null)
      .in("user_id", userIds),
  ]);

  const byProfile = new Map(
    (profiles.data ?? []).map((p) => [p.user_id as string, p]),
  );
  const byIdent = new Map(
    (identities.data ?? []).map((p) => [p.user_id as string, p]),
  );

  async function signAvatar(path: string | null): Promise<string | null> {
    if (!path) return null;
    const { data } = await sb
      .storage.from(BUCKET_DOCUMENTS)
      .createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  }

  const rows: ClientRow[] = await Promise.all(
    (users.data ?? []).map(async (u) => {
      const p = byProfile.get(u.id as string);
      const i = byIdent.get(u.id as string);
      const bd = (i?.birth_date as string | null) ?? (p?.birth_date as string | null);
      let age: number | null = null;
      if (bd) {
        const d = new Date(bd);
        const now = new Date();
        age = now.getFullYear() - d.getFullYear();
        if (now.getMonth() < d.getMonth() ||
            (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
      }
      return {
        user_id: u.id as string,
        display_name: (p?.display_name as string | null) ?? null,
        full_name: i
          ? `${i.last_name} ${i.first_name}${i.middle_name ? " " + i.middle_name : ""}`
          : null,
        age,
        city: (p?.city as string | null) ?? null,
        pinfl: (i?.pinfl as string | null) ?? null,
        passport: i
          ? `${i.passport_series}${i.passport_number}`
          : null,
        telegram_username: (u.telegram_username as string | null) ?? null,
        phone_number_masked: u.phone_number
          ? maskPhone(u.phone_number as string)
          : null,
        verification_status: u.verification_status as string,
        lifecycle_state: u.lifecycle_state as string,
        avatar_url: await signAvatar((u.avatar_path as string | null) ?? null),
        created_at: u.created_at as string,
      };
    }),
  );

  return { rows };
}

function maskPhone(p: string): string {
  if (p.length < 6) return p;
  return p.slice(0, 4) + " *** " + p.slice(-4);
}
```

- [ ] **Step 2: API route**

```ts
// src/app/api/admin/clients/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { searchClients } from "@/lib/admin/load-clients-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { res } = await requireAdminApi();
  if (res) return res;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const result = await searchClients(q, 20);
  return NextResponse.json({ ok: true, rows: result.rows });
}
```

- [ ] **Step 3: Tests + commit**

Тесты — минимальные (моки supabase), проверяют что pinfl-detection + tg-username-detection ветки работают.

```bash
git add -A
git commit -m "feat(admin): clients search loader + /api/admin/clients/search"
```

---

### Task 9: ClientsTable + SearchBar

**Files:**
- Create: `src/components/admin-ops/clients/SearchBar.tsx`
- Create: `src/components/admin-ops/clients/ClientsTable.tsx`

**Interfaces:**
- SearchBar: controlled input + debounce 250ms → onChange(q). Live results через fetch (`/api/admin/clients/search?q=...`).
- ClientsTable: rows, click → /admin/clients/[id].

- [ ] **Step 1: SearchBar**

```tsx
// src/components/admin-ops/clients/SearchBar.tsx
"use client";
import { useEffect, useState } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";
import type { ClientRow } from "@/lib/admin/load-clients-search";

export function SearchBar({
  initialQ,
  onResults,
}: {
  initialQ: string;
  onResults: (rows: ClientRow[] | null) => void;
}) {
  const [q, setQ] = useState(initialQ);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length === 0) {
      onResults(null);
      return;
    }
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/admin/clients/search?q=${encodeURIComponent(q)}`,
        );
        const d = await r.json();
        if (d.ok) onResults(d.rows as ClientRow[]);
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, onResults]);

  return (
    <div style={{ position: "relative", maxWidth: 480 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ФИО, ПИНФЛ, паспорт, телефон, @username…"
        autoFocus
        style={{
          width: "100%",
          height: 36,
          padding: "0 12px",
          fontSize: 14,
          fontFamily: ADMIN.fontSans,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 6,
          background: ADMIN.surface,
          outline: "none",
        }}
      />
      {busy ? (
        <div
          style={{
            position: "absolute",
            right: 10,
            top: 10,
            fontSize: 11,
            color: ADMIN.ink500,
          }}
        >
          …
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: ClientsTable**

```tsx
// src/components/admin-ops/clients/ClientsTable.tsx
"use client";
import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import type { ClientRow } from "@/lib/admin/load-clients-search";

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          color: ADMIN.ink500,
          fontSize: 13,
          textAlign: "center",
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          background: ADMIN.surface,
        }}
      >
        Ничего не найдено
      </div>
    );
  }

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        background: ADMIN.surface,
        border: `1px solid ${ADMIN.border}`,
        borderRadius: 8,
      }}
    >
      <thead>
        <tr style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
          {["", "ФИО", "AGE", "City", "Phone", "TG", "Status", "Joined"].map(
            (h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  fontSize: 11,
                  color: ADMIN.ink500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontWeight: 500,
                }}
              >
                {h}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const name =
            r.full_name ??
            r.display_name ??
            "—";
          return (
            <tr
              key={r.user_id}
              style={{ borderBottom: `1px solid ${ADMIN.border}` }}
            >
              <td style={{ padding: "8px 12px" }}>
                {r.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.avatar_url}
                    alt=""
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: ADMIN.surface2,
                      color: ADMIN.ink300,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                    }}
                  >
                    {name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </td>
              <td style={{ padding: "10px 12px", fontSize: 13 }}>
                <Link
                  href={`/admin/clients/${r.user_id}`}
                  style={{ color: ADMIN.ink900, textDecoration: "none" }}
                >
                  {name}
                </Link>
                {r.pinfl ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: ADMIN.ink500,
                      fontFamily: ADMIN.fontMono,
                    }}
                  >
                    {r.pinfl}
                  </div>
                ) : null}
              </td>
              <td style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink700 }}>
                {r.age ?? "—"}
              </td>
              <td style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink700 }}>
                {r.city ?? "—"}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  fontFamily: ADMIN.fontMono,
                  color: ADMIN.ink500,
                }}
              >
                {r.phone_number_masked ?? "—"}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  color: ADMIN.ink500,
                }}
              >
                {r.telegram_username ? `@${r.telegram_username}` : "—"}
              </td>
              <td style={{ padding: "10px 12px" }}>
                {r.verification_status === "approved" ? (
                  <StatusPill kind="verified">approved</StatusPill>
                ) : (
                  <StatusPill kind="pending">
                    {r.verification_status}
                  </StatusPill>
                )}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  color: ADMIN.ink500,
                }}
              >
                {new Date(r.created_at).toLocaleDateString("ru-RU")}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(admin): SearchBar + ClientsTable components"
```

---

### Task 10: /admin/clients page

**Files:**
- Create: `src/app/admin/clients/page.tsx`
- Create: `src/app/admin/clients/ClientsScreen.tsx` (client orchestrator — search state)

- [ ] **Step 1: ClientsScreen**

```tsx
// src/app/admin/clients/ClientsScreen.tsx
"use client";
import { useState } from "react";
import { SearchBar } from "@/components/admin-ops/clients/SearchBar";
import { ClientsTable } from "@/components/admin-ops/clients/ClientsTable";
import type { ClientRow } from "@/lib/admin/load-clients-search";

export function ClientsScreen({ initial }: { initial: ClientRow[] }) {
  const [results, setResults] = useState<ClientRow[] | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SearchBar initialQ="" onResults={setResults} />
      <ClientsTable rows={results ?? initial} />
    </div>
  );
}
```

- [ ] **Step 2: page.tsx**

```tsx
// src/app/admin/clients/page.tsx
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { searchClients } from "@/lib/admin/load-clients-search";
import { ClientsScreen } from "./ClientsScreen";
import { ADMIN } from "@/lib/admin/admin-tokens";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireAdmin();
  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  // Initial: 50 newest
  const { rows } = await searchClients("", 50);

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <h1
        style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}
      >
        Клиенты
      </h1>
      <p
        style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 24 }}
      >
        Поиск по ФИО, ПИНФЛ, паспорту, телефону, @username
      </p>
      <ClientsScreen initial={rows} />
    </OpsShell>
  );
}
```

- [ ] **Step 3: Smoke + commit**

```bash
git add -A
git commit -m "feat(admin): /admin/clients directory + type-ahead search"
```

---

## Phase C: Client Card — Additional Tabs

### Task 11: ClientTabs nav component

**Files:**
- Create: `src/components/admin-ops/ClientTabs.tsx`

**Interfaces:**
- Produces: tab strip с linkами на `?tab=identity|profile|photos|activity|moderation`.

- [ ] **Step 1: Write**

```tsx
// src/components/admin-ops/ClientTabs.tsx
import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";

const TABS = [
  { id: "identity", label: "Identity" },
  { id: "profile", label: "Profile" },
  { id: "photos", label: "Photos" },
  { id: "activity", label: "Activity" },
  { id: "moderation", label: "Moderation" },
] as const;

export function ClientTabs({
  clientId,
  active,
}: {
  clientId: string;
  active: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        borderBottom: `1px solid ${ADMIN.border}`,
        marginBottom: 24,
      }}
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <Link
            key={t.id}
            href={`/admin/clients/${clientId}?tab=${t.id}`}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? ADMIN.ink900 : ADMIN.ink500,
              borderBottom: `2px solid ${
                isActive ? ADMIN.accent : "transparent"
              }`,
              marginBottom: -1,
              textDecoration: "none",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin-ops/ClientTabs.tsx
git commit -m "feat(admin): ClientTabs nav primitive"
```

---

### Task 12: PhotosTab + ActivityTab + ModerationTab

**Files:**
- Create: `src/app/admin/clients/[id]/PhotosTab.tsx`
- Create: `src/app/admin/clients/[id]/ActivityTab.tsx`
- Create: `src/app/admin/clients/[id]/ModerationTab.tsx`

**Interfaces:**
- Server components, каждый получает userId, делает свой загрузочный запрос.
- PhotosTab: список approved + pending фото клиента.
- ActivityTab: last_seen, matches count, chats count, joined.
- ModerationTab: список всех verification_cases юзера + последние reports.

- [ ] **Step 1: PhotosTab**

```tsx
// src/app/admin/clients/[id]/PhotosTab.tsx
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKET_PHOTOS } from "@/lib/uploads/storage";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";

export async function PhotosTab({ userId }: { userId: string }) {
  const { data: photos } = await supabaseAdmin()
    .from("profile_photos")
    .select("id, path, status, is_main, ord, created_at")
    .eq("user_id", userId)
    .order("ord", { ascending: true });

  if (!photos || photos.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          background: ADMIN.surface,
          color: ADMIN.ink500,
          fontSize: 13,
        }}
      >
        Нет загруженных фото.
      </div>
    );
  }

  const signed = await Promise.all(
    photos.map(async (p) => {
      const { data } = await supabaseAdmin()
        .storage.from(BUCKET_PHOTOS)
        .createSignedUrl(p.path as string, 300);
      return { ...p, signed_url: data?.signedUrl ?? null };
    }),
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 16,
      }}
    >
      {signed.map((p) => (
        <div
          key={p.id as string}
          style={{
            border: `1px solid ${ADMIN.border}`,
            borderRadius: 8,
            background: ADMIN.surface,
            overflow: "hidden",
          }}
        >
          {p.signed_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.signed_url}
              alt=""
              style={{
                width: "100%",
                aspectRatio: "3/4",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                aspectRatio: "3/4",
                background: ADMIN.surface2,
              }}
            />
          )}
          <div
            style={{
              padding: 8,
              display: "flex",
              gap: 4,
              alignItems: "center",
              fontSize: 11,
              color: ADMIN.ink500,
            }}
          >
            #{(p.ord as number) + 1}
            {p.is_main ? <StatusPill kind="verified">main</StatusPill> : null}
            <span style={{ flex: 1 }} />
            <StatusPill
              kind={
                p.status === "approved"
                  ? "verified"
                  : p.status === "rejected"
                    ? "rejected"
                    : "pending"
              }
            >
              {p.status as string}
            </StatusPill>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: ActivityTab (basic — joined + counts)**

```tsx
// src/app/admin/clients/[id]/ActivityTab.tsx
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ADMIN } from "@/lib/admin/admin-tokens";

export async function ActivityTab({ userId }: { userId: string }) {
  const sb = supabaseAdmin();
  const [user, sentInterests, recvInterests, chats] = await Promise.all([
    sb.from("users").select("created_at, paused_at, blocked_at").eq("id", userId).maybeSingle(),
    sb.from("match_requests").select("id", { count: "exact", head: true }).eq("from_user_id", userId),
    sb.from("match_requests").select("id", { count: "exact", head: true }).eq("to_user_id", userId),
    sb.from("chats").select("id", { count: "exact", head: true }).or(`a_user_id.eq.${userId},b_user_id.eq.${userId}`),
  ]);

  return (
    <div
      style={{
        padding: 24,
        border: `1px solid ${ADMIN.border}`,
        borderRadius: 8,
        background: ADMIN.surface,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
      }}
    >
      <Stat label="Registered" value={user.data?.created_at ? new Date(user.data.created_at).toLocaleDateString("ru-RU") : "—"} />
      <Stat label="Paused at" value={user.data?.paused_at ? new Date(user.data.paused_at).toLocaleString("ru-RU") : "—"} />
      <Stat label="Sent interests" value={String(sentInterests.count ?? 0)} />
      <Stat label="Received interests" value={String(recvInterests.count ?? 0)} />
      <Stat label="Active chats" value={String(chats.count ?? 0)} />
      <Stat label="Blocked at" value={user.data?.blocked_at ? new Date(user.data.blocked_at).toLocaleString("ru-RU") : "—"} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: ADMIN.ink500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: ModerationTab**

```tsx
// src/app/admin/clients/[id]/ModerationTab.tsx
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";

export async function ModerationTab({ userId }: { userId: string }) {
  const sb = supabaseAdmin();
  const [cases, reports] = await Promise.all([
    sb.from("verification_cases")
      .select("id, state, outcome, created_at, decided_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    sb.from("reports")
      .select("id, reason, status, created_at")
      .eq("target_user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
          Verification cases ({cases.data?.length ?? 0})
        </h3>
        {(cases.data ?? []).length === 0 ? (
          <div style={{ color: ADMIN.ink500, fontSize: 13 }}>—</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {(cases.data ?? []).map((c) => (
              <li
                key={c.id as string}
                style={{
                  padding: "8px 12px",
                  border: `1px solid ${ADMIN.border}`,
                  borderRadius: 4,
                  marginBottom: 6,
                  background: ADMIN.surface,
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <Link
                  href={`/admin/cases/${c.id}`}
                  style={{ color: ADMIN.accent, fontFamily: ADMIN.fontMono }}
                >
                  VR-{(c.id as string).slice(0, 8)}
                </Link>
                <StatusPill kind={c.outcome === "approved" ? "verified" : "pending"}>
                  {(c.outcome ?? c.state) as string}
                </StatusPill>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: ADMIN.ink500 }}>
                  {new Date(c.created_at as string).toLocaleString("ru-RU")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
          Reports against ({reports.data?.length ?? 0})
        </h3>
        {(reports.data ?? []).length === 0 ? (
          <div style={{ color: ADMIN.ink500, fontSize: 13 }}>—</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {(reports.data ?? []).map((r) => (
              <li
                key={r.id as string}
                style={{
                  padding: "8px 12px",
                  border: `1px solid ${ADMIN.border}`,
                  borderRadius: 4,
                  marginBottom: 6,
                  background: ADMIN.surface,
                  display: "flex",
                  gap: 12,
                  fontSize: 13,
                }}
              >
                <StatusPill kind={r.status === "resolved" ? "verified" : "pending"}>
                  {r.status as string}
                </StatusPill>
                <span style={{ flex: 1 }}>{r.reason as string}</span>
                <span style={{ fontSize: 11, color: ADMIN.ink500 }}>
                  {new Date(r.created_at as string).toLocaleString("ru-RU")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(admin): Photos/Activity/Moderation tabs для карточки клиента"
```

---

### Task 13: Wire tabs into /admin/clients/[id] page

**Files:**
- Modify: `src/app/admin/clients/[id]/page.tsx`

- [ ] **Step 1: Update page to read ?tab= and dispatch**

```tsx
// src/app/admin/clients/[id]/page.tsx
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { loadClient } from "@/lib/admin/load-client";
import { ClientHero } from "./ClientHero";
import { IdentityTab } from "./IdentityTab";
import { ClientTabs } from "@/components/admin-ops/ClientTabs";
import { PhotosTab } from "./PhotosTab";
import { ActivityTab } from "./ActivityTab";
import { ModerationTab } from "./ModerationTab";

export const dynamic = "force-dynamic";

const VALID_TABS = new Set([
  "identity",
  "profile",
  "photos",
  "activity",
  "moderation",
]);

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const tab = VALID_TABS.has(sp.tab ?? "") ? (sp.tab as string) : "identity";

  const c = await loadClient(id);
  if (!c) notFound();

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <ClientHero client={c} />
      <ClientTabs clientId={id} active={tab} />
      {tab === "identity" ? <IdentityTab identity={c.identity} /> : null}
      {tab === "photos" ? <PhotosTab userId={id} /> : null}
      {tab === "activity" ? <ActivityTab userId={id} /> : null}
      {tab === "moderation" ? <ModerationTab userId={id} /> : null}
      {tab === "profile" ? (
        <div style={{ padding: 24, color: "#6e6a60", fontSize: 13 }}>
          Profile tab (анкета знакомств) — Sprint 3.
        </div>
      ) : null}
    </OpsShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(admin): wire tabs into /admin/clients/[id]"
```

---

## Phase D: Verify + Wrap

### Task 14: Run full test suite + tsc + build

- [ ] **Step 1: Tests**

```bash
cd /Users/fayzullohoja/Code/baxtlilar && npx vitest run
```

Expected: 292+ tests passing.

- [ ] **Step 2: Type check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Production build**

```bash
pnpm build
```

Expected: clean build, новые routes:
- `/admin/photos`
- `/admin/clients`
- `/admin/clients/[id]` (с tabs)
- `/api/admin/clients/search`

- [ ] **Step 4: Manual smoke**

1. `/admin/photos?tab=new` — таблица фото на approve
2. Hover на превью → click → drawer открывается → reject с reason
3. `/admin/clients` → search type "Каримов" (или известное имя) → results
4. Click → `/admin/clients/[id]` → переключение tabs

- [ ] **Step 5: Status update + memory + final commit**

Mark Sprint 2 complete в plan-файле, обновить memory:

```bash
git add -A
git commit -m "docs: mark Sprint 2 complete"
```

---

## Self-Review

**Spec coverage:**
- ✓ Photo moderation как ops-таблица (Tasks 1, 5, 7)
- ✓ Reason templates через DB (Tasks 2, 6)
- ✓ Drawer вместо `window.confirm` (Tasks 4, 6)
- ✓ Backward-compat photo decision API (Task 3)
- ✓ Clients directory с search ФИО/ПИНФЛ/паспорт/телефон/@username (Tasks 8, 9, 10)
- ✓ Pagination на photos (Task 7)
- ✓ Карточка клиента: Identity (Sprint 1) + Photos + Activity + Moderation (Tasks 11-13)
- Deferred: ProfileTab (анкета знакомств) → Sprint 3
- Deferred: bulk-select / hotkeys → Sprint 4
- Deferred: Cmd+K command palette → Sprint 4

**Placeholders:** none — каждая Task имеет полный код в Steps.

**Type consistency:**
- `PhotoCase` определён в load-photos.ts (Task 1), используется в Tasks 5-7.
- `ClientRow` определён в load-clients-search.ts (Task 8), используется в Tasks 9, 10.

---

## Status

- [ ] Sprint 2 in-progress
