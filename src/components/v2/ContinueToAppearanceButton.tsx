"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";

/**
 * V3 Sprint 1 — кнопка из заглушки /v2/anketa/self в /v2/anketa/appearance.
 * Sprint 2 удалит эту кнопку и заменит заглушку реальной формой.
 *
 * Делает transition profile_self → profile_appearance (legacy V2 flow).
 */
export function ContinueToAppearanceButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function go() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/onboarding/profile/skip-self", {
        method: "POST",
      });
      const d = (await r.json().catch(() => ({}))) as {
        ok: boolean;
        next?: string;
      };
      if (d.ok && d.next) router.replace(d.next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="primary"
      onClick={go}
      disabled={busy}
      style={{ width: "100%" }}
    >
      {busy ? "Переходим…" : "Продолжить"}
    </Button>
  );
}
