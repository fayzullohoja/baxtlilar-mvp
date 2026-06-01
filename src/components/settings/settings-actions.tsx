"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";

export function SettingsActions({ paused }: { paused: boolean }) {
  const t = useTranslations("Settings");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pauseToggle() {
    setBusy(true);
    await postJson("/api/account", { action: paused ? "resume" : "pause" });
    router.refresh();
    setBusy(false);
  }

  async function del() {
    if (!window.confirm(t("delete_confirm"))) return;
    setBusy(true);
    const r = await postJson("/api/account", { action: "delete" });
    if (r.ok) router.push("/");
    else setBusy(false);
  }

  return (
    <div className="space-y-3">
      <button
        onClick={pauseToggle}
        disabled={busy}
        className="w-full rounded-xl border border-baxt-border bg-white py-3 text-sm text-baxt-navy"
      >
        {paused ? t("resume") : t("pause")}
      </button>
      <p className="text-xs text-baxt-muted">{paused ? t("paused_hint") : t("pause_hint")}</p>
      <button onClick={del} disabled={busy} className="w-full py-3 text-sm text-baxt-coral-dk">
        {t("delete")}
      </button>
    </div>
  );
}
