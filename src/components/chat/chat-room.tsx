"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { postJson } from "@/lib/client/api";

export type Msg = { id: string; sender_id: string; body: string; created_at: string };
type Temp = { clientId: string; body: string; created_at: string };

const POLL_MS = 3000;

function hhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Живой чат: начальные сообщения с сервера + опрос дозагрузки (пауза, когда вкладка скрыта),
 * оптимистичная отправка, автоскролл к низу. Без обновления страницы вручную.
 */
export function ChatRoom({
  chatId,
  myId,
  initial,
  safetyTip,
}: {
  chatId: string;
  myId: string;
  initial: Msg[];
  safetyTip: string;
}) {
  const t = useTranslations("Chat");
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [temps, setTemps] = useState<Temp[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true); // пользователь у низа → держим прокрутку внизу
  const cursorRef = useRef<string | undefined>(
    initial.length ? initial[initial.length - 1].created_at : undefined,
  );

  useEffect(() => {
    if (messages.length) cursorRef.current = messages[messages.length - 1].created_at;
  }, [messages]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const mergeReal = useCallback(
    (incoming: Msg[]) => {
      if (!incoming.length) return;
      setMessages((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]));
        let changed = false;
        for (const m of incoming)
          if (!map.has(m.id)) {
            map.set(m.id, m);
            changed = true;
          }
        if (!changed) return prev;
        return [...map.values()].sort((a, b) =>
          a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1,
        );
      });
      if (incoming.some((m) => m.sender_id !== myId)) void postJson(`/api/chats/${chatId}/read`);
    },
    [chatId, myId],
  );

  const poll = useCallback(async () => {
    try {
      const after = cursorRef.current;
      const url = `/api/chats/${chatId}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; messages?: Msg[] };
      if (data.ok && data.messages) mergeReal(data.messages);
    } catch {
      /* офлайн/сбой сети — тихо повторим в следующем тике */
    }
  }, [chatId, mergeReal]);

  // отметить прочитанным + прокрутка вниз при открытии
  useEffect(() => {
    void postJson(`/api/chats/${chatId}/read`);
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [chatId, scrollToBottom]);

  // опрос новых сообщений (пауза, когда вкладка не активна)
  useEffect(() => {
    const iv = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) void poll();
    }, POLL_MS);
    const onWake = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [poll]);

  // автоскролл при новых сообщениях, если пользователь у низа
  useEffect(() => {
    if (stickRef.current) scrollToBottom("smooth");
  }, [messages, temps, scrollToBottom]);

  function onScroll() {
    const el = scrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setErr(null);
    const clientId = `tmp-${performance.now()}-${body.length}`;
    setTemps((p) => [...p, { clientId, body, created_at: new Date().toISOString() }]);
    setText("");
    stickRef.current = true;
    setBusy(true);
    const r = (await postJson(`/api/chats/${chatId}/messages`, { body })) as {
      ok: boolean;
      error?: string;
      message?: Msg;
    };
    setBusy(false);
    setTemps((p) => p.filter((x) => x.clientId !== clientId));
    if (r.ok) {
      if (r.message) mergeReal([r.message]);
      else void poll();
    } else {
      setText(body);
      setErr(r.error === "contact_blocked" ? t("contact_blocked") : t("send_err"));
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const empty = messages.length === 0 && temps.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {empty ? (
          <div className="mx-auto max-w-xs rounded-2xl bg-baxt-coral-bg px-4 py-3 text-center text-xs text-baxt-navy">
            {safetyTip}
          </div>
        ) : null}

        {messages.map((m) => {
          const mine = m.sender_id === myId;
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  "max-w-[80%] break-words rounded-2xl px-3.5 py-2 text-sm " +
                  (mine
                    ? "rounded-br-md bg-baxt-coral text-white"
                    : "rounded-bl-md border border-baxt-border bg-white text-baxt-navy")
                }
              >
                <span className="whitespace-pre-wrap">{m.body}</span>
                <span className={"ml-2 align-bottom text-[10px] " + (mine ? "text-white/70" : "text-baxt-muted")}>
                  {hhmm(m.created_at)}
                </span>
              </div>
            </div>
          );
        })}

        {temps.map((tp) => (
          <div key={tp.clientId} className="flex justify-end">
            <div className="max-w-[80%] break-words rounded-2xl rounded-br-md bg-baxt-coral px-3.5 py-2 text-sm text-white opacity-60">
              <span className="whitespace-pre-wrap">{tp.body}</span>
              <span className="ml-2 align-bottom text-[10px] text-white/70">…</span>
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-baxt-border bg-white px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        {err ? <p className="mb-1.5 px-1 text-xs text-baxt-coral-dk">{err}</p> : null}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("placeholder")}
            rows={1}
            className="max-h-28 flex-1 resize-none rounded-2xl border border-baxt-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-baxt-coral"
          />
          <button
            onClick={send}
            disabled={busy || !text.trim()}
            aria-label={t("send")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-baxt-coral text-white transition disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3.4 20.4 21 12 3.4 3.6 3 10l12 2-12 2 .4 6.4Z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
