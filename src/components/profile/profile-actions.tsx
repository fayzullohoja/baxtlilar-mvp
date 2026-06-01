"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";
import { PrimaryButton } from "@/components/ui/screen";

export function ProfileActions({ targetId }: { targetId: string }) {
  const t = useTranslations("ProfileView");
  const router = useRouter();
  const [showMsg, setShowMsg] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function interest() {
    setBusy(true);
    setNote(null);
    const r = await postJson("/api/interest", { receiver_id: targetId, message: message || undefined });
    if (r.ok && r.mutual && r.next) router.push(r.next);
    else if (r.ok) {
      router.push("/main");
    } else {
      setNote(r.error === "daily_limit" ? t("limit") : t("err"));
      setBusy(false);
    }
  }

  async function skip() {
    setBusy(true);
    await postJson("/api/feed/skip", { target_id: targetId });
    router.push("/main");
  }

  async function block() {
    if (!window.confirm(t("block_confirm"))) return;
    setBusy(true);
    await postJson("/api/block", { target_id: targetId });
    router.push("/main");
  }

  async function report() {
    const reason = window.prompt(t("report_prompt"));
    if (!reason) return;
    await postJson("/api/report", { target_user_id: targetId, reason_code: "other", comment: reason });
    setNote(t("report_done"));
  }

  return (
    <div className="space-y-3">
      {showMsg ? (
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={300}
          placeholder={t("message_hint")}
          className="w-full rounded-xl border border-baxt-border bg-white px-3 py-2.5 text-sm min-h-20"
        />
      ) : null}
      {note ? <p className="text-sm text-baxt-coral-dk">{note}</p> : null}
      <PrimaryButton onClick={showMsg ? interest : () => setShowMsg(true)} disabled={busy}>
        {showMsg ? t("send_interest") : t("interest")}
      </PrimaryButton>
      <button onClick={skip} disabled={busy} className="w-full py-2.5 text-sm text-baxt-muted">
        {t("skip")}
      </button>
      <div className="flex justify-center gap-5 text-xs text-baxt-muted pt-1">
        <button onClick={block}>{t("block")}</button>
        <button onClick={report}>{t("report")}</button>
      </div>
    </div>
  );
}
