"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";

/**
 * V2 PausedResume — кнопка «Возобновить» на paused-экране /main.
 *
 * Зеркалит resume-флоу из V2SettingsActions (POST /api/account action=resume).
 * Нужна, чтобы paused-юзер мог сняться с паузы прямо с главного экрана:
 * раньше paused вообще не мог дойти до настроек (петля редиректов /main). C1.
 */
export function PausedResume() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function resume() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      if (res.ok) {
        // lifecycle → active; перерисовываем /main (покажется подбор).
        router.refresh();
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={resume} disabled={busy} fullWidth={false}>
      {busy ? "Снимаем паузу…" : "Возобновить"}
    </Button>
  );
}
