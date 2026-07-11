"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";
import type { LoadedCase } from "@/lib/admin/load-case";

const ACTION_RU: Record<string, string> = {
  claimed: "Взят в работу",
  released: "Освобождён в пул",
  draft_saved: "Сохранён черновик",
  decided: "Вынесено решение",
  reassigned: "Переназначен",
  reopened: "Переоткрыт",
  blocking_rejected: "Blocking-reject",
};

function actionLabel(a: string): string {
  return ACTION_RU[a] ?? a;
}

// QZ-3 (заметки) + QZ-4 (таймлайн событий) — контекст решения по кейсу в одном
// месте. Заметки — редактируемый канал между модераторами; таймлайн —
// append-only аудит (кто/когда claim/release/draft/decision).
export function CaseHistory({
  caseId,
  notes,
  events,
}: {
  caseId: string;
  notes: LoadedCase["notes"];
  events: LoadedCase["events"];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addNote() {
    const body = draft.trim();
    if (body.length < 1 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/cases/${caseId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (d.ok) {
        setDraft("");
        router.refresh();
      } else {
        setError(d.error ?? "error");
      }
    } catch {
      setError("network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 24,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 16,
      }}
    >
      {/* Заметки */}
      <section style={panel}>
        <div style={label}>Заметки ({notes.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            maxLength={2000}
            // disabled пока POST в полёте — иначе набранное после отправки
            // затрётся setDraft('') на успехе (потеря ввода).
            disabled={busy}
            placeholder="Внутренняя заметка (видна только модераторам)…"
            style={{
              width: "100%",
              padding: "6px 8px",
              fontSize: 13,
              fontFamily: ADMIN.fontSans,
              background: ADMIN.surface,
              color: ADMIN.ink900,
              border: `1px solid ${ADMIN.border}`,
              borderRadius: 4,
              outline: "none",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button size="sm" disabled={busy || draft.trim().length < 1} onClick={addNote}>
              {busy ? "…" : "Добавить"}
            </Button>
            {error ? <span style={{ fontSize: 12, color: ADMIN.danger }}>{error}</span> : null}
          </div>
        </div>
        {notes.length === 0 ? (
          <div style={{ fontSize: 13, color: ADMIN.ink500 }}>Заметок нет.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notes.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: "8px 10px",
                  border: `1px solid ${ADMIN.border}`,
                  borderRadius: 6,
                  background: ADMIN.surface2,
                }}
              >
                <div style={{ fontSize: 13, whiteSpace: "pre-wrap", color: ADMIN.ink900 }}>
                  {n.body}
                </div>
                <div style={{ fontSize: 11, color: ADMIN.ink500, marginTop: 4 }}>
                  {n.author} · {new Date(n.created_at).toLocaleString("ru-RU")}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Таймлайн */}
      <section style={panel}>
        <div style={label}>История ({events.length})</div>
        {events.length === 0 ? (
          <div style={{ fontSize: 13, color: ADMIN.ink500 }}>Событий нет.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {events.map((e) => {
              const outcome = e.payload?.["outcome"];
              return (
                <div
                  key={e.id}
                  style={{ display: "flex", gap: 10, fontSize: 13, color: ADMIN.ink700 }}
                >
                  <span
                    style={{
                      color: ADMIN.ink500,
                      fontFamily: ADMIN.fontMono,
                      fontSize: 11,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(e.created_at).toLocaleString("ru-RU")}
                  </span>
                  <span style={{ flex: 1 }}>
                    {actionLabel(e.action)}
                    {typeof outcome === "string" ? ` → ${outcome}` : ""}
                    {e.actor ? (
                      <span style={{ color: ADMIN.ink500 }}> · {e.actor}</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const panel: React.CSSProperties = {
  padding: 16,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 8,
  background: ADMIN.surface,
};
const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: ADMIN.ink500,
  marginBottom: 12,
};
