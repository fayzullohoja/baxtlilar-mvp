"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";

// REP-2/3/4 — решение по жалобе с причиной + реальная санкция.
// «Предложить бан нарушителю» дёргает готовый ban-эндпоинт (two-person) и
// помечает жалобу action_taken. Escalate/reason провязаны (route их уже принимал).

const STATUS_BTNS: {
  status: string;
  label: string;
  variant: "primary" | "secondary" | "ghost";
}[] = [
  { status: "in_progress", label: "В работу", variant: "secondary" },
  { status: "action_taken", label: "Меры приняты", variant: "primary" },
  { status: "escalated", label: "Эскалация", variant: "secondary" },
  { status: "not_confirmed", label: "Отклонить", variant: "ghost" },
];

export function ReportTriageActions({
  reportId,
  targetId,
  targetBlocked,
}: {
  reportId: string;
  targetId: string;
  targetBlocked: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(status: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/reports/${reportId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: reason.trim() || undefined }),
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

  async function banTarget() {
    if (reason.trim().length < 3) {
      setError("Для бана укажите причину");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/users/${targetId}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "propose", reason: reason.trim() }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!d.ok) {
        setError(`бан: ${d.error ?? "error"}`);
        setBusy(false);
        return;
      }
      // санкция предложена → фиксируем жалобу как «меры приняты»
      await fetch(`/api/admin/reports/${reportId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "action_taken", reason: reason.trim() }),
      });
      router.refresh();
    } catch {
      setError("network");
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        padding: 20,
        marginBottom: 20,
        border: `1px solid ${ADMIN.border}`,
        borderRadius: 8,
        background: ADMIN.surface,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: ADMIN.ink500,
          marginBottom: 10,
        }}
      >
        Решение
      </div>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Причина / комментарий (пишется в аудит)"
        style={{
          width: "100%",
          padding: "8px 10px",
          fontSize: 14,
          fontFamily: ADMIN.fontSans,
          background: ADMIN.surface,
          color: ADMIN.ink900,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 4,
          outline: "none",
          marginBottom: 12,
        }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {STATUS_BTNS.map((a) => (
          <Button
            key={a.status}
            variant={a.variant}
            size="sm"
            disabled={busy}
            onClick={() => decide(a.status)}
          >
            {a.label}
          </Button>
        ))}
        {!targetBlocked ? (
          <Button variant="danger" size="sm" disabled={busy} onClick={banTarget}>
            Предложить бан нарушителю
          </Button>
        ) : null}
      </div>

      {error ? (
        <div style={{ marginTop: 10, fontSize: 13, color: ADMIN.danger }}>Ошибка: {error}</div>
      ) : null}
    </div>
  );
}
