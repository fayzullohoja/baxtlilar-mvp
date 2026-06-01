"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";

export function MessageForm({ chatId }: { chatId: string }) {
  const t = useTranslations("Chat");
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // отметить входящие прочитанными при открытии
  useEffect(() => {
    void postJson(`/api/chats/${chatId}/read`);
  }, [chatId]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setErr(null);
    const r = await postJson(`/api/chats/${chatId}/messages`, { body });
    if (r.ok) {
      setText("");
      router.refresh();
    } else {
      setErr(r.error === "contact_blocked" ? t("contact_blocked") : t("send_err"));
    }
    setBusy(false);
  }

  return (
    <div className="fixed bottom-0 inset-x-0 bg-white border-t border-baxt-border p-3">
      {err ? <p className="text-xs text-baxt-coral-dk mb-1.5 px-1">{err}</p> : null}
      <div className="flex gap-2 items-end">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("placeholder")}
          rows={1}
          className="flex-1 rounded-2xl border border-baxt-border bg-white px-3 py-2 text-sm resize-none max-h-28 outline-none focus:border-baxt-coral"
        />
        <button
          onClick={send}
          disabled={busy || !text.trim()}
          className="rounded-full bg-baxt-coral text-white px-4 py-2 text-sm disabled:opacity-50 shrink-0"
        >
          {t("send")}
        </button>
      </div>
    </div>
  );
}
