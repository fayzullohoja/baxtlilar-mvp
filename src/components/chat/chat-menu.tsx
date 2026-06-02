"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/client/api";

/** Меню чата: пожаловаться / заблокировать (безопасность доступна прямо из переписки). */
export function ChatMenu({ otherId, chatId }: { otherId: string; chatId: string }) {
  const t = useTranslations("ProfileView");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function block() {
    setOpen(false);
    if (!window.confirm(t("block_confirm"))) return;
    await postJson("/api/block", { target_id: otherId });
    router.push("/chats");
  }

  async function report() {
    setOpen(false);
    const reason = window.prompt(t("report_prompt"));
    if (!reason) return;
    await postJson("/api/report", {
      target_user_id: otherId,
      chat_id: chatId,
      reason_code: "other",
      comment: reason,
    });
    setNote(t("report_done"));
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t("report")}
        onClick={() => setOpen((o) => !o)}
        className="grid h-9 w-9 place-items-center rounded-full text-xl text-baxt-muted hover:bg-baxt-pink-bg"
      >
        ⋯
      </button>
      {open ? (
        <div className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl border border-baxt-border bg-white text-sm shadow-lg">
          <button onClick={report} className="block w-full px-4 py-2.5 text-left text-baxt-navy hover:bg-baxt-pink-bg">
            {t("report")}
          </button>
          <button
            onClick={block}
            className="block w-full px-4 py-2.5 text-left text-baxt-coral-dk hover:bg-baxt-pink-bg"
          >
            {t("block")}
          </button>
        </div>
      ) : null}
      {note ? (
        <div className="absolute right-0 top-10 z-30 rounded-lg bg-baxt-navy px-3 py-1.5 text-xs text-white">
          {note}
        </div>
      ) : null}
    </div>
  );
}
