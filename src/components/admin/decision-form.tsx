"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = null | "reject" | "needs_changes";

export function DecisionForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState<"passport" | "selfie" | "both">("both");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/verifications/${userId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => ({ ok: false }));
    if (data.ok) {
      router.push("/admin/verifications");
      router.refresh();
    } else {
      setError(data.error === "not_pending" ? "Заявка уже обработана" : "Ошибка: " + data.error);
      setBusy(false);
    }
  }

  if (mode) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="font-medium text-slate-800">
          {mode === "reject" ? "Отклонить заявку" : "Вернуть на исправление"}
        </div>
        {mode === "needs_changes" && (
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as typeof target)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="passport">Переснять паспорт</option>
            <option value="selfie">Переснять селфи</option>
            <option value="both">Переснять оба</option>
          </select>
        )}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Причина (увидит пользователь)"
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex gap-2">
          <button
            disabled={busy || !reason.trim()}
            onClick={() => send(mode, mode === "needs_changes" ? { reason, target } : { reason })}
            className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Подтвердить
          </button>
          <button onClick={() => setMode(null)} className="rounded-lg border px-4 py-2 text-sm">
            Отмена
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="font-medium text-slate-800 mb-3">Решение модератора</div>
      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={() => send("approve")}
          className="rounded-lg bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          ✓ Одобрить
        </button>
        <button
          onClick={() => setMode("needs_changes")}
          className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-sm"
        >
          ↩ Вернуть на исправление
        </button>
        <button
          onClick={() => setMode("reject")}
          className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm"
        >
          ✕ Отклонить
        </button>
      </div>
    </div>
  );
}
