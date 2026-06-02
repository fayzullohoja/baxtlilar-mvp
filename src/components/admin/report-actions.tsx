"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACTIONS: { status: string; label: string; cls: string }[] = [
  { status: "in_progress", label: "В работу", cls: "text-slate-700" },
  { status: "action_taken", label: "Меры приняты", cls: "text-green-700" },
  { status: "not_confirmed", label: "Отклонить", cls: "text-slate-500" },
];

export function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function decide(status: string) {
    setBusy(true);
    const r = await fetch(`/api/admin/reports/${reportId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (!r.ok) {
      window.alert("Ошибка");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {ACTIONS.map((a) => (
        <button key={a.status} onClick={() => decide(a.status)} disabled={busy} className={a.cls + " hover:underline"}>
          {a.label}
        </button>
      ))}
    </div>
  );
}
