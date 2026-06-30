"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from 'next-intl';

/**
 * V2 ChatRoom — editorial-restyled chat (Blueprint §3.4 C6).
 *
 * Логика идентична V1 (SSE + polling fallback, optimistic send, read
 * receipts, typing indicator). Только стили editorial.
 *
 * Bubble стили:
 *   - Мои: ink-100 фон, paper текст
 *   - Их: paper фон, ink-500 border, ink-100 текст
 *   - Время: 10px, ink-400 (мои светлее)
 *   - ✓ / ✓✓: subtle в ink-300
 *
 * Composer: underline textarea editorial-style, send-button label
 * (без иконки самолёта).
 */

export type Msg = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at?: string | null;
};
type Temp = { clientId: string; body: string; created_at: string };
type LiveState = { messages?: Msg[]; read_through?: string | null; typing?: boolean };

const FALLBACK_POLL_MS = 3000;

function hhmm(iso: string): string {
  const norm = iso
    .replace(" ", "T")
    .replace(/(\.\d{3})\d+/, "$1")
    .replace(/([+-]\d\d)$/, "$1:00");
  const d = new Date(norm);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const ERR_COPY_KEYS = {
  contact_blocked: "err_contact_blocked",
  too_fast: "err_too_fast",
  too_long: "err_too_long",
  blocked: "err_blocked",
  send_err: "err_send",
};

// SAFETY_TIP will be fetched via t('safety_tip_extended')

export function V2ChatRoom({
  chatId,
  myId,
  initial,
}: {
  chatId: string;
  myId: string;
  initial: Msg[];
}) {
  const t = useTranslations('Chat');
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
      let addedIncoming = false;
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
          a.created_at < b.created_at
            ? -1
            : a.created_at > b.created_at
              ? 1
              : a.id < b.id
                ? -1
                : 1,
        );
      });
      if (addedIncoming) {
        void fetch(`/api/chats/${chatId}/read`, { method: "POST" }).catch(() => {});
      }
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
      const data = (await res.json()) as LiveState;
      applyState(data);
    } catch {
      /* офлайн — повторим */
    }
  }, [chatId, applyState]);

  // отметить прочитанным + прокрутка вниз при открытии
  useEffect(() => {
    void fetch(`/api/chats/${chatId}/read`, { method: "POST" }).catch(() => {});
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [chatId, scrollToBottom]);

  // SSE + fallback polling
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
    const scheduleFallback = () => {
      if (pollIv || grace) return;
      grace = setTimeout(() => {
        grace = null;
        startPolling();
      }, 2000);
    };

    if (typeof EventSource !== "undefined") {
      try {
        es = new EventSource(
          `/api/chats/${chatId}/stream?after=${encodeURIComponent(cursorRef.current ?? "")}`,
        );
        es.onopen = stopPolling;
        es.onmessage = (e) => {
          try {
            applyState(JSON.parse(e.data) as LiveState);
          } catch {
            /* битый кадр */
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

  useEffect(() => {
    if (!peerTyping) return;
    const id = setTimeout(() => setPeerTyping(false), 7000);
    return () => clearTimeout(id);
  }, [peerTyping, messages]);

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
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok: boolean;
        error?: string;
        message?: Msg;
      };
      setTemps((p) => p.filter((x) => x.clientId !== clientId));
      if (data.ok) {
        if (data.message) mergeReal([data.message]);
        else void pollOnce();
      } else {
        setText(body);
        setErr(data.error ?? "send_err");
      }
    } catch {
      setTemps((p) => p.filter((x) => x.clientId !== clientId));
      setText(body);
      setErr("send_err");
    } finally {
      setBusy(false);
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        fontFamily: "var(--font-v2-body)",
        background: "var(--color-v2-paper)",
      }}
    >
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 20px 12px",
        }}
      >
        {empty ? (
          <div
            style={{
              maxWidth: "320px",
              margin: "16px auto 24px",
              padding: "16px 18px",
              border: "1px solid var(--color-v2-ink-500)",
              borderRadius: "var(--v2-radius-md)",
              fontSize: "13px",
              lineHeight: "1.55",
              color: "var(--color-v2-ink-300)",
              textAlign: "center",
            }}
          >
            {t('safety_tip_extended')}
          </div>
        ) : null}

        {messages.map((m) => {
          const mine = m.sender_id === myId;
          const read = mine && !!readThrough && m.created_at <= readThrough;
          return (
            <Bubble key={m.id} mine={mine}>
              <span style={{ whiteSpace: "pre-wrap" }}>{m.body}</span>
              <Meta mine={mine}>
                {hhmm(m.created_at)}
                {mine ? <span style={{ marginLeft: "4px" }}>{read ? "✓✓" : "✓"}</span> : null}
              </Meta>
            </Bubble>
          );
        })}

        {temps.map((tp) => (
          <Bubble key={tp.clientId} mine pending>
            <span style={{ whiteSpace: "pre-wrap" }}>{tp.body}</span>
            <Meta mine>…</Meta>
          </Bubble>
        ))}

        {peerTyping ? (
          <div style={{ display: "flex", justifyContent: "flex-start", marginTop: "8px" }}>
            <div
              style={{
                background: "transparent",
                border: "1px solid var(--color-v2-ink-500)",
                color: "var(--color-v2-ink-400)",
                borderRadius: "var(--v2-radius-md)",
                padding: "8px 14px",
                fontSize: "13px",
                fontStyle: "italic",
              }}
            >
              {t('typing')}
            </div>
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--color-v2-ink-500)",
          padding: "12px 20px max(12px, env(safe-area-inset-bottom)) 20px",
          background: "var(--color-v2-paper)",
        }}
      >
        {err ? (
          <div
            style={{
              padding: "8px 12px",
              marginBottom: "8px",
              background: "rgba(180, 50, 50, 0.08)",
              border: "1px solid rgba(180, 50, 50, 0.3)",
              borderRadius: "var(--v2-radius-md)",
              fontSize: "12px",
              color: "var(--color-v2-ink-200)",
              lineHeight: "1.5",
            }}
          >
            {t(ERR_COPY_KEYS[err as keyof typeof ERR_COPY_KEYS] ?? 'err_send')}
          </div>
        ) : null}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "10px" }}>
          <textarea
            value={text}
            onChange={(e) => onChangeText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('input_placeholder')}
            rows={1}
            maxLength={2000}
            style={{
              flex: 1,
              maxHeight: "112px",
              resize: "none",
              padding: "10px 12px",
              fontFamily: "var(--font-v2-body)",
              fontSize: "15px",
              lineHeight: "1.4",
              color: "var(--color-v2-ink-100)",
              background: "transparent",
              border: "1px solid var(--color-v2-ink-500)",
              borderRadius: "var(--v2-radius-md)",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || !text.trim()}
            style={{
              padding: "10px 16px",
              fontFamily: "var(--font-v2-body)",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--color-v2-paper)",
              background: "var(--color-v2-ink-100)",
              border: "none",
              borderRadius: "var(--v2-radius-md)",
              cursor: busy || !text.trim() ? "not-allowed" : "pointer",
              opacity: busy || !text.trim() ? 0.4 : 1,
              flexShrink: 0,
            }}
          >
            {t('send')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  children,
  mine,
  pending,
}: {
  children: React.ReactNode;
  mine: boolean;
  pending?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: mine ? "flex-end" : "flex-start",
        marginBottom: "8px",
      }}
    >
      <div
        style={{
          maxWidth: "80%",
          padding: "10px 14px",
          fontSize: "15px",
          lineHeight: "1.45",
          background: mine ? "var(--color-v2-ink-100)" : "transparent",
          color: mine ? "var(--color-v2-paper)" : "var(--color-v2-ink-100)",
          border: mine ? "none" : "1px solid var(--color-v2-ink-500)",
          borderRadius: "var(--v2-radius-md)",
          borderBottomRightRadius: mine ? "4px" : "var(--v2-radius-md)",
          borderBottomLeftRadius: !mine ? "4px" : "var(--v2-radius-md)",
          opacity: pending ? 0.5 : 1,
          wordBreak: "break-word",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Meta({ mine, children }: { mine: boolean; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: "10px",
        marginLeft: "8px",
        color: mine ? "rgba(250, 246, 241, 0.7)" : "var(--color-v2-ink-400)",
        verticalAlign: "bottom",
      }}
    >
      {children}
    </span>
  );
}
