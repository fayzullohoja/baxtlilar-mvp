"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/admin-ops/Button";
import { ADMIN } from "@/lib/admin/admin-tokens";

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
      <Button variant="secondary" size="sm" onClick={unban} disabled={busy}>
        Разблокировать
      </Button>
    );
  }

  if (asking) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="причина"
          style={{
            height: 28,
            width: 112,
            padding: "0 8px",
            fontFamily: ADMIN.fontSans,
            fontSize: 12,
            color: ADMIN.ink900,
            background: ADMIN.surface,
            border: `1px solid ${ADMIN.border}`,
            borderRadius: 6,
          }}
        />
        <Button variant="danger" size="sm" onClick={ban} disabled={busy || !reason.trim()}>
          ✓
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setAsking(false)} disabled={busy}>
          ✕
        </Button>
      </span>
    );
  }

  return (
    <Button variant="danger" size="sm" onClick={() => setAsking(true)}>
      Заблокировать
    </Button>
  );
}
