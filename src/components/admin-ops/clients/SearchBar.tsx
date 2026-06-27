"use client";
import { useEffect, useState } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";
import type { ClientRow } from "@/lib/admin/load-clients-search";

export function SearchBar({
  onResults,
}: {
  onResults: (rows: ClientRow[] | null) => void;
}) {
  const [q, setQ] = useState("");
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
            right: 12,
            top: 11,
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
