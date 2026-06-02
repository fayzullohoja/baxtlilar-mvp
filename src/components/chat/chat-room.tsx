"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { postJson } from "@/lib/client/api";

export type Msg = { id: string; sender_id: string; body: string; created_at: string; read_at?: string | null };
type Temp = { clientId: string; body: string; created_at: string };
type LiveState = { messages?: Msg[]; read_through?: string | null; typing?: boolean };

const FALLBACK_POLL_MS = 3000;

function hhmm(iso: string): string {
  // PostgREST timestamptz приходит как "2026-06-02 10:30:00.123456+00" — нормализуем,
  // иначе Safari / Telegram iOS WebView даёт NaN и время не показывается.
  const norm = iso
    .replace(" ", "T")
    .replace(/(\.\d{3})\d+/, "$1")
    .replace(/([+-]\d\d)$/, "$1:00");
  const d = new Date(norm);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Живой чат: мгновенная доставка через SSE (поток `/stream`), при сбое/отсутствии —
 * фолбэк на опрос. Галочки ✓/✓✓ (read_through), индикатор «печатает…», оптимистичная
 * отправка, автоскролл. Без обновления страницы вручную.
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
  const [readThrough, setReadThrough] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  const cursorRef = useRef<string | undefined>(
    initial.length ? initial[initial.length - 1].created_at : undefined,
  );
  const typingSentRef = useRef(0);

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
      let addedIncoming = false; // отмечаем прочитанным ТОЛЬКО реально новые входящие (не пограничный повтор)
      setMessages((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]));
        let changed = false;
        for (const m of incoming)
          if (!map.has(m.id)) {
            map.set(m.id, m);
            changed = true;
            if (m.sender_id !== myId) addedIncoming = true;
          }
        if (!changed) return prev;
        return [...map.values()].sort((a, b) =>
          a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1,
        );
      });
      if (addedIncoming) void postJson(`/api/chats/${chatId}/read`);
    },
    [chatId, myId],
  );

  const applyState = useCallback(
    (s: LiveState) => {
      if (s.messages?.length) mergeReal(s.messages);
      if (s.read_through !== undefined) setReadThrough((prev) => s.read_through ?? prev);
      if (typeof s.typing === "boolean") setPeerTyping(s.typing);
    },
    [mergeReal],
  );

  const pollOnce = useCallback(async () => {
    try {
      const after = cursorRef.current;
      const url = `/api/chats/${chatId}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as LiveState & { ok?: boolean };
      applyState(data);
    } catch {
      /* офлайн — повторим */
    }
  }, [chatId, applyState]);

  // отметить прочитанным + прокрутка вниз при открытии
  useEffect(() => {
    void postJson(`/api/chats/${chatId}/read`);
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [chatId, scrollToBottom]);

  // живой канал: SSE с фолбэком на опрос
  useEffect(() => {
    let es: EventSource | null = null;
    let pollIv: ReturnType<typeof setInterval> | null = null;
    let grace: ReturnType<typeof setTimeout> | null = null;

    const startPolling = () => {
      if (!pollIv) pollIv = setInterval(() => !document.hidden && void pollOnce(), FALLBACK_POLL_MS);
    };
    const stopPolling = () => {
      if (grace) {
        clearTimeout(grace);
        grace = null;
      }
      if (pollIv) {
        clearInterval(pollIv);
        pollIv = null;
      }
    };
    // не опрашиваем во время штатного быстрого переподключения SSE — только если сбой держится >2с
    const scheduleFallback = () => {
      if (pollIv || grace) return;
      grace = setTimeout(() => {
        grace = null;
        startPolling();
      }, 2000);
    };

    if (typeof EventSource !== "undefined") {
      try {
        es = new EventSource(`/api/chats/${chatId}/stream?after=${encodeURIComponent(cursorRef.current ?? "")}`);
        es.onopen = stopPolling;
        es.onmessage = (e) => {
          try {
            applyState(JSON.parse(e.data) as LiveState);
          } catch {
            /* пропускаем битый кадр */
          }
        };
        es.onerror = scheduleFallback;
      } catch {
        startPolling();
      }
    } else {
      startPolling();
    }

    const onWake = () => !document.hidden && void pollOnce();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      es?.close();
      stopPolling();
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [chatId, pollOnce, applyState]);

  // защита от «застрявшего» индикатора печати
  useEffect(() => {
    if (!peerTyping) return;
    const id = setTimeout(() => setPeerTyping(false), 7000);
    return () => clearTimeout(id);
  }, [peerTyping, messages]);

  // автоскролл, если пользователь у низа
  useEffect(() => {
    if (stickRef.current) scrollToBottom("smooth");
  }, [messages, temps, peerTyping, scrollToBottom]);

  function onScroll() {
    const el = scrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  function onChangeText(v: string) {
    setText(v);
    if (v.trim()) {
      const now = performance.now();
      if (now - typingSentRef.current > 3000) {
        typingSentRef.current = now;
        void fetch(`/api/chats/${chatId}/typing`, { method: "POST" }).catch(() => {});
      }
    }
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
      else void pollOnce();
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
          const read = mine && !!readThrough && m.created_at <= readThrough;
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
                  {mine ? <span className="ml-0.5">{read ? "✓✓" : "✓"}</span> : null}
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

        {peerTyping ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-baxt-border bg-white px-3.5 py-2 text-sm italic text-baxt-muted">
              {t("typing")}
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-baxt-border bg-white px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        {err ? <p className="mb-1.5 px-1 text-xs text-baxt-coral-dk">{err}</p> : null}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => onChangeText(e.target.value)}
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
