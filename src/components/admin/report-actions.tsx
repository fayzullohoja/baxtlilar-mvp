"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/admin-ops/Button";

const ACTIONS: {
  status: string;
  label: string;
  variant: "primary" | "secondary" | "danger" | "ghost";
}[] = [
  { status: "in_progress", label: "В работу", variant: "secondary" },
  { status: "action_taken", label: "Меры приняты", variant: "primary" },
  { status: "not_confirmed", label: "Отклонить", variant: "ghost" },
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
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {ACTIONS.map((a) => (
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
    </div>
  );
}
