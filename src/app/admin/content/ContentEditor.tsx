"use client";
import { useMemo, useState } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";

type Locale = "ru" | "uz" | "en" | "tr";
type FlatMessages = Record<string, string>;
export type LocaleBundle = { base: FlatMessages; override: FlatMessages };
export type EditorData = Record<Locale, LocaleBundle>;

const LOCALE_LABEL: Record<Locale, string> = { ru: "RU", uz: "UZ", en: "EN", tr: "TR" };

// Группировка ключей в левом списке. Обычный ключ → первый сегмент (namespace).
// Лейблы вариантов ответа (Tier 2) все лежат в namespace `Options` — 350+ ключей
// одной кучей нечитаемы, поэтому режем по ВТОРОМУ сегменту (имя набора):
// «Options.RELIGION», «Options.MARITAL_STATUS», …
const nsOf = (key: string) => {
  const p = key.split(".");
  return p[0] === "Options" && p.length > 2 ? `Options.${p[1]}` : p[0];
};

export function ContentEditor({
  data,
  locales,
}: {
  data: EditorData;
  locales: readonly Locale[];
}) {
  const [locale, setLocale] = useState<Locale>(locales[0] ?? "ru");
  // Локальные копии оверрайдов на локаль — мутируем при save/reset (бейджи, статус).
  const [overrides, setOverrides] = useState<Record<Locale, FlatMessages>>(() => {
    const init = {} as Record<Locale, FlatMessages>;
    for (const l of locales) init[l] = { ...data[l].override };
    return init;
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({});
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const base = data[locale].base;
  const over = overrides[locale];

  // Пространства имён (первый сегмент ключа) + счётчик правок.
  const namespaces = useMemo(() => {
    const set = new Set<string>();
    for (const k of Object.keys(base)) set.add(nsOf(k));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [base]);

  const [ns, setNs] = useState<string>(namespaces[0] ?? "");
  const activeNs = namespaces.includes(ns) ? ns : namespaces[0] ?? "";

  const overCountByNs = useMemo(() => {
    const m: Record<string, number> = {};
    for (const k of Object.keys(over)) {
      // считаем только оверрайды, чей ключ есть в базе этой локали
      if (base[k] !== undefined) m[nsOf(k)] = (m[nsOf(k)] ?? 0) + 1;
    }
    return m;
  }, [over, base]);

  const totalOver = useMemo(
    () => Object.keys(over).filter((k) => base[k] !== undefined).length,
    [over, base],
  );

  const q = search.trim().toLowerCase();
  const rows = useMemo(() => {
    const keys = Object.keys(base)
      .filter((k) => nsOf(k) === activeNs)
      .filter((k) => {
        if (!q) return true;
        const cur = over[k] ?? base[k];
        return (
          k.toLowerCase().includes(q) ||
          base[k].toLowerCase().includes(q) ||
          cur.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.localeCompare(b));
    return keys;
  }, [base, over, activeNs, q]);

  const idOf = (key: string) => `${locale}:${key}`;

  async function save(key: string) {
    const id = idOf(key);
    const value = drafts[id] ?? over[key] ?? base[key];
    setBusyKey(id);
    setErrorByKey((e) => ({ ...e, [id]: "" }));
    try {
      const r = await fetch("/api/admin/i18n", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, key, value }),
      });
      const d = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        reverted?: boolean;
        error?: string;
        detail?: string;
      };
      if (!d.ok) {
        setErrorByKey((e) => ({ ...e, [id]: d.detail || d.error || "Ошибка" }));
        return;
      }
      setOverrides((o) => {
        const next = { ...o[locale] };
        if (d.reverted) delete next[key];
        else next[key] = value.trim();
        return { ...o, [locale]: next };
      });
      setDrafts((dd) => {
        const n = { ...dd };
        delete n[id];
        return n;
      });
      setFlashKey(id);
      setTimeout(() => setFlashKey((f) => (f === id ? null : f)), 1500);
    } catch {
      setErrorByKey((e) => ({ ...e, [id]: "Сеть недоступна" }));
    } finally {
      setBusyKey(null);
    }
  }

  async function reset(key: string) {
    const id = idOf(key);
    setBusyKey(id);
    setErrorByKey((e) => ({ ...e, [id]: "" }));
    try {
      const r = await fetch(
        `/api/admin/i18n?locale=${encodeURIComponent(locale)}&key=${encodeURIComponent(key)}`,
        { method: "DELETE" },
      );
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!d.ok) {
        setErrorByKey((e) => ({ ...e, [id]: d.error || "Ошибка" }));
        return;
      }
      setOverrides((o) => {
        const next = { ...o[locale] };
        delete next[key];
        return { ...o, [locale]: next };
      });
      setDrafts((dd) => {
        const n = { ...dd };
        delete n[id];
        return n;
      });
    } catch {
      setErrorByKey((e) => ({ ...e, [id]: "Сеть недоступна" }));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div>
      {/* Панель: язык + поиск */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {locales.map((l) => {
            const active = l === locale;
            const cnt = Object.keys(overrides[l]).filter(
              (k) => data[l].base[k] !== undefined,
            ).length;
            return (
              <button
                key={l}
                onClick={() => setLocale(l)}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  fontWeight: 500,
                  border: `1px solid ${active ? ADMIN.accent : ADMIN.border}`,
                  borderRadius: 6,
                  background: active ? ADMIN.accentSoft : ADMIN.surface,
                  color: active ? ADMIN.ink900 : ADMIN.ink700,
                  cursor: "pointer",
                }}
              >
                {LOCALE_LABEL[l]}
                {cnt > 0 ? (
                  <span style={{ marginLeft: 6, fontSize: 11, color: ADMIN.accent }}>
                    {cnt}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по ключу или тексту…"
          style={{
            flex: 1,
            minWidth: 220,
            padding: "8px 12px",
            fontSize: 13,
            border: `1px solid ${ADMIN.border}`,
            borderRadius: 6,
            background: ADMIN.surface,
            color: ADMIN.ink900,
          }}
        />
        <div style={{ fontSize: 12, color: ADMIN.ink500 }}>
          Изменено в {LOCALE_LABEL[locale]}: <b style={{ color: ADMIN.ink900 }}>{totalOver}</b>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 16, alignItems: "start" }}>
        {/* Список namespace */}
        <div
          style={{
            border: `1px solid ${ADMIN.border}`,
            borderRadius: 8,
            background: ADMIN.surface,
            maxHeight: "70vh",
            overflowY: "auto",
            position: "sticky",
            top: 12,
          }}
        >
          {namespaces.map((n) => {
            const active = n === activeNs;
            const cnt = overCountByNs[n] ?? 0;
            return (
              <button
                key={n}
                onClick={() => setNs(n)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "7px 12px",
                  fontSize: 13,
                  textAlign: "left",
                  border: 0,
                  borderLeft: `2px solid ${active ? ADMIN.accent : "transparent"}`,
                  background: active ? ADMIN.accentSoft : "transparent",
                  color: active ? ADMIN.ink900 : ADMIN.ink700,
                  cursor: "pointer",
                }}
              >
                <span>{n}</span>
                {cnt > 0 ? (
                  <span style={{ fontSize: 11, color: ADMIN.accent }}>{cnt}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Строки выбранного namespace */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.length === 0 ? (
            <div style={{ color: ADMIN.ink500, fontSize: 13, padding: 16 }}>Ничего не найдено.</div>
          ) : null}
          {rows.map((key) => {
            const id = idOf(key);
            const baseVal = base[key];
            const savedVal = over[key] ?? baseVal;
            const draftVal = drafts[id] ?? savedVal;
            const overridden = over[key] !== undefined;
            const dirty = draftVal !== savedVal;
            const busy = busyKey === id;
            const err = errorByKey[id];
            const flashed = flashKey === id;
            return (
              <div
                key={key}
                style={{
                  border: `1px solid ${overridden ? ADMIN.accent : ADMIN.border}`,
                  borderRadius: 8,
                  background: ADMIN.surface,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <code style={{ fontSize: 11, color: ADMIN.ink500 }}>{key}</code>
                  {overridden ? (
                    <span
                      style={{
                        fontSize: 10,
                        color: ADMIN.accent,
                        border: `1px solid ${ADMIN.accent}`,
                        borderRadius: 4,
                        padding: "1px 6px",
                      }}
                    >
                      изменено
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, color: ADMIN.ink500 }}>по умолчанию</span>
                  )}
                  {flashed ? (
                    <span style={{ fontSize: 11, color: ADMIN.success }}>✓ сохранено</span>
                  ) : null}
                </div>

                {overridden ? (
                  <div style={{ fontSize: 12, color: ADMIN.ink500, marginBottom: 6 }}>
                    Оригинал: <span style={{ fontStyle: "italic" }}>{baseVal}</span>
                  </div>
                ) : null}

                <textarea
                  value={draftVal}
                  onChange={(e) =>
                    setDrafts((dd) => ({ ...dd, [id]: e.target.value }))
                  }
                  rows={Math.min(6, Math.max(1, Math.ceil(draftVal.length / 70)))}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: 13,
                    lineHeight: 1.4,
                    border: `1px solid ${dirty ? ADMIN.accent : ADMIN.border}`,
                    borderRadius: 6,
                    background: ADMIN.surface2,
                    color: ADMIN.ink900,
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />

                {err ? (
                  <div style={{ fontSize: 12, color: ADMIN.danger, marginTop: 6 }}>{err}</div>
                ) : null}

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Button size="sm" disabled={busy || !dirty} onClick={() => save(key)}>
                    {busy ? "Сохраняю…" : "Сохранить"}
                  </Button>
                  {overridden ? (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => reset(key)}>
                      Сбросить к оригиналу
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
