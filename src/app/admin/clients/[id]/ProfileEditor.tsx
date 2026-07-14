"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";
import { PROFILE_EDIT_SECTIONS, type EditField } from "@/lib/admin/profile-edit-schema";

type Values = Record<string, unknown>;

const ERR_RU: Record<string, string> = {
  forbidden: "Нет прав на редактирование.",
  unauthorized: "Сессия истекла.",
  not_found: "Анкета не найдена.",
  no_changes: "Нет изменений.",
  unknown_field: "Недопустимое поле.",
  validation: "Проверьте значения.",
  save_failed: "Не удалось сохранить.",
  db: "Ошибка БД.",
};

export function ProfileEditor({
  userId,
  initial,
  onDone,
}: {
  userId: string;
  initial: Values;
  onDone: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Values>(() => ({ ...initial }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, v: unknown) => setDraft((d) => ({ ...d, [key]: v }));

  function changedPayload(): Values {
    const out: Values = {};
    for (const s of PROFILE_EDIT_SECTIONS)
      for (const f of s.fields) {
        const a = draft[f.key] ?? (f.kind === "multiselect" ? [] : null);
        const b = initial[f.key] ?? (f.kind === "multiselect" ? [] : null);
        if (JSON.stringify(a) !== JSON.stringify(b)) out[f.key] = a;
      }
    return out;
  }

  async function save() {
    const changes = changedPayload();
    if (!Object.keys(changes).length) {
      onDone();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/users/${userId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; detail?: string };
      if (d.ok) {
        router.refresh();
        onDone();
        return;
      }
      setError(d.detail ? `${ERR_RU[d.error ?? ""] ?? d.error}: ${d.detail}` : (ERR_RU[d.error ?? ""] ?? d.error ?? "Ошибка"));
    } catch {
      setError("Сеть недоступна.");
    } finally {
      setBusy(false);
    }
  }

  const actions = (
    <div style={{ display: "flex", gap: 8 }}>
      <Button variant="ghost" onClick={onDone} disabled={busy}>
        Отмена
      </Button>
      <Button variant="primary" onClick={save} disabled={busy}>
        {busy ? "Сохраняю…" : "Сохранить"}
      </Button>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Редактирование анкеты</div>
        {actions}
      </div>
      <div style={{ fontSize: 12, color: ADMIN.ink500 }}>
        Пол и дата рождения правятся только через ре-верификацию паспорта. Все изменения логируются.
      </div>
      {error ? <div style={{ fontSize: 13, color: ADMIN.danger }}>{error}</div> : null}

      {PROFILE_EDIT_SECTIONS.map((s) => (
        <div key={s.title} style={card}>
          <div style={cardLabel}>
            {s.title}
            {s.sensitive ? <span style={{ color: ADMIN.ink300 }}> · приватно</span> : null}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {s.fields.map((f) => (
              <FieldEditor key={f.key} f={f} value={draft[f.key]} onChange={(v) => set(f.key, v)} />
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>{actions}</div>
    </div>
  );
}

function FieldEditor({
  f,
  value,
  onChange,
}: {
  f: EditField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <label style={{ fontSize: 11, color: ADMIN.ink500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {f.label}
    </label>
  );

  if (f.kind === "toggle") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {label}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {value === true ? "да" : "нет"}
        </label>
      </div>
    );
  }

  if (f.kind === "select") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {label}
        <select value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || null)} style={input}>
          <option value="">— не указано —</option>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.ru}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (f.kind === "multiselect") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (v: string) => {
      const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
      if (f.maxItems != null && next.length > f.maxItems && !arr.includes(v)) return; // не превышаем лимит
      onChange(next);
    };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: "1 / -1" }}>
        {label}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {f.options?.map((o) => {
            const on = arr.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                style={{
                  padding: "5px 11px",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  border: `1px solid ${on ? ADMIN.accent : ADMIN.border}`,
                  background: on ? ADMIN.accentSoft : ADMIN.surface,
                  color: on ? ADMIN.accent : ADMIN.ink700,
                  fontWeight: on ? 600 : 400,
                }}
              >
                {o.ru}
              </button>
            );
          })}
        </div>
        {f.maxItems != null ? (
          <span style={{ fontSize: 11, color: ADMIN.ink300 }}>Максимум {f.maxItems}</span>
        ) : null}
      </div>
    );
  }

  if (f.kind === "textarea") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: "1 / -1" }}>
        {label}
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          maxLength={f.maxLen}
          rows={3}
          style={{ ...input, height: "auto", padding: "8px 10px", resize: "vertical" }}
        />
      </div>
    );
  }

  // text | number
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label}
      <input
        type={f.kind === "number" ? "number" : "text"}
        value={value == null ? "" : String(value)}
        min={f.min}
        max={f.max}
        maxLength={f.kind === "text" ? f.maxLen : undefined}
        onChange={(e) => {
          if (f.kind === "number") {
            const raw = e.target.value;
            onChange(raw === "" ? null : Number(raw));
          } else onChange(e.target.value);
        }}
        style={input}
      />
    </div>
  );
}

const card: React.CSSProperties = {
  padding: 16,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 8,
  background: ADMIN.surface,
};
const cardLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: ADMIN.ink500,
  marginBottom: 12,
};
const input: React.CSSProperties = {
  height: 32,
  padding: "0 10px",
  fontSize: 13,
  fontFamily: ADMIN.fontSans,
  background: ADMIN.surface,
  color: ADMIN.ink900,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 4,
  outline: "none",
  width: "100%",
};
