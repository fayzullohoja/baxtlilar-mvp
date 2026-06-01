"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";

export function RequestActions({ requestId, kind }: { requestId: string; kind: "incoming" | "outgoing" }) {
  const t = useTranslations("Requests");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "accept" | "decline" | "withdraw") {
    setBusy(true);
    const r = await postJson(`/api/requests/${requestId}/decision`, { action });
    if (action === "accept" && r.ok && r.next) router.push(r.next);
    else router.refresh();
  }

  if (kind === "outgoing") {
    return (
      <button onClick={() => act("withdraw")} disabled={busy} className="text-sm text-baxt-muted">
        {t("withdraw")}
      </button>
    );
  }
  return (
    <div className="flex gap-2">
      <button
        onClick={() => act("accept")}
        disabled={busy}
        className="rounded-full bg-baxt-coral text-white text-sm px-4 py-1.5 disabled:opacity-50"
      >
        {t("accept")}
      </button>
      <button
        onClick={() => act("decline")}
        disabled={busy}
        className="rounded-full bg-white border border-baxt-border text-baxt-navy text-sm px-4 py-1.5"
      >
        {t("decline")}
      </button>
    </div>
  );
}
