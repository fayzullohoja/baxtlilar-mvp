"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";

// PH-3: approve/reject/needs_replacement прямо из карточки клиента (не только из
// очереди). Дёргает тот же decision-эндпоинт. Показывается только для фото в
// активной модерации (under_review/uploaded) — статус решает PhotosTab.
type Neg = "reject" | "needs_replacement";

export function PhotoCardActions({
  photoId,
  reasonTemplates,
}: {
  photoId: string;
  reasonTemplates: { code: string; text: string }[];
}) {
  const router = useRouter();
  const [neg, setNeg] = useState<Neg | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | Neg, reasonText?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body =
        action === "approve"
          ? { action }
          : { action, reason_text: reasonText ?? "" };
      const r = await fetch(`/api/admin/photos/${photoId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (d.ok) router.refresh();
      else {
        setError(d.error ?? "error");
        setBusy(false);
      }
    } catch {
      setError("network");
      setBusy(false);
    }
  }

  if (neg) {
    return (
      <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{
            fontSize: 11,
            padding: "3px 4px",
            border: `1px solid ${ADMIN.border}`,
            borderRadius: 4,
            background: ADMIN.surface,
            color: ADMIN.ink900,
          }}
        >
          <option value="">— причина —</option>
          {reasonTemplates.map((t) => (
            <option key={t.code} value={t.text}>
              {t.text}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 4 }}>
          <Button
            size="sm"
            variant="danger"
            disabled={busy || reason.length < 3}
            onClick={() => decide(neg, reason)}
          >
            {busy ? "…" : neg === "needs_replacement" ? "Замена" : "Reject"}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setNeg(null)}>
            Отмена
          </Button>
        </div>
        {error ? <span style={{ fontSize: 10, color: ADMIN.danger }}>{error}</span> : null}
      </div>
    );
  }

  return (
    <div style={{ padding: "6px 8px", display: "flex", gap: 4, flexWrap: "wrap" }}>
      <Button size="sm" disabled={busy} onClick={() => decide("approve")}>
        {busy ? "…" : "✓"}
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setNeg("needs_replacement")}>
        ↻
      </Button>
      <Button size="sm" variant="danger" disabled={busy} onClick={() => setNeg("reject")}>
        ✕
      </Button>
      {error ? <span style={{ fontSize: 10, color: ADMIN.danger }}>{error}</span> : null}
    </div>
  );
}
