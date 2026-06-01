"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UserActions({ userId, blocked }: { userId: string; blocked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");

  async function ban() {
    if (!reason.trim()) return;
    // ADM-5: подтверждение опасного действия
    if (!window.confirm(`Заблокировать пользователя?\nПричина: ${reason}`)) return;
    setBusy(true);
    const r = await fetch(`/api/admin/users/${userId}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setBusy(false);
    if (!r.ok) {
      window.alert(r.status === 403 ? "Недостаточно прав (нужен супер-админ)" : "Ошибка");
      return;
    }
    setAsking(false);
    setReason("");
    router.refresh();
  }

  async function unban() {
    setBusy(true);
    await fetch(`/api/admin/users/${userId}/unban`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  if (blocked) {
    return (
      <button onClick={unban} disabled={busy} className="text-green-700 hover:underline text-sm">
        Разблокировать
      </button>
    );
  }

  if (asking) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="причина"
          className="rounded border border-slate-300 px-2 py-1 text-xs w-28"
        />
        <button onClick={ban} disabled={busy || !reason.trim()} className="text-red-600 text-sm">
          ✓
        </button>
        <button onClick={() => setAsking(false)} className="text-slate-400 text-sm">
          ✕
        </button>
      </span>
    );
  }

  return (
    <button onClick={() => setAsking(true)} className="text-red-600 hover:underline text-sm">
      Заблокировать
    </button>
  );
}
