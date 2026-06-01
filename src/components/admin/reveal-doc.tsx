"use client";

import { useState } from "react";

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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-medium text-slate-700 mb-2">{label}</div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="max-h-80 rounded-lg border border-slate-200" />
      ) : (
        <button
          onClick={reveal}
          disabled={busy}
          className="text-sm rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Загрузка…" : `👁 Показать (${label.toLowerCase()})`}
        </button>
      )}
      {error ? <p className="text-sm text-red-600 mt-2">{error}</p> : null}
    </div>
  );
}
