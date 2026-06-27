"use client";

import { useState } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";

/** Показ паспорта/селфи по клику (signed URL, доступ логируется на сервере). */
export function RevealDoc({ userId, kind, label }: { userId: string; kind: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/verifications/${userId}/doc?kind=${kind}`);
    const data = await res.json().catch(() => ({ ok: false }));
    if (data.ok && data.url) setUrl(data.url as string);
    else setError(data.error === "no_document" ? "Документ не загружен" : "Ошибка доступа");
    setBusy(false);
  }

  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px solid ${ADMIN.border}`,
        background: ADMIN.surface,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: ADMIN.ink700, marginBottom: 8 }}>
        {label}
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          style={{ maxHeight: 320, borderRadius: 6, border: `1px solid ${ADMIN.border}` }}
        />
      ) : (
        <Button variant="secondary" size="sm" onClick={reveal} disabled={busy}>
          {busy ? "Загрузка…" : `Показать (${label.toLowerCase()})`}
        </Button>
      )}
      {error ? (
        <p style={{ fontSize: 13, color: ADMIN.danger, marginTop: 8 }}>{error}</p>
      ) : null}
    </div>
  );
}
