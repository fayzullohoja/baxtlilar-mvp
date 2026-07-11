"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";

/**
 * F4 hard-gate (ревью оунера): панель контент-ревью семейного положения.
 * Показывается в ProfileTab, когда needs_marital_review=true. Профиль скрыт из
 * мэтчинга до одобрения. Кнопка «Одобрить» снимает флаг (POST approve-marital) →
 * профиль возвращается в подбор. router.refresh() после успеха.
 */
export function MaritalReviewAction({
  userId,
  maritalLabel,
}: {
  userId: string;
  maritalLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/approve-marital`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as { ok: boolean; error?: string };
      if (data.ok) {
        router.refresh();
        return;
      }
      setError(data.error ?? "failed");
    } catch {
      setError("network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        border: `1px solid ${ADMIN.warning}`,
        background: "#FFF8E6",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontSize: 13, color: ADMIN.ink700, lineHeight: 1.5 }}>
        <strong>⚠ Контент-ревью: семейное положение.</strong>{" "}
        «{maritalLabel}» требует ручной проверки. Профиль <b>скрыт из мэтчинга</b>{" "}
        (не показывается, не может слать/получать интерес) до одобрения.
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <button
          type="button"
          onClick={approve}
          disabled={busy}
          style={{
            border: 0,
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            background: busy ? ADMIN.ink300 : ADMIN.success,
            cursor: busy ? "wait" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {busy ? "…" : "Одобрить — вернуть в мэтчинг"}
        </button>
        {error ? (
          <span style={{ fontSize: 12, color: ADMIN.danger }}>
            {error === "not_flagged"
              ? "Уже снят с ревью."
              : error === "not_found"
                ? "Профиль не найден."
                : "Не удалось — попробуйте ещё раз."}
          </span>
        ) : null}
      </div>
    </div>
  );
}
