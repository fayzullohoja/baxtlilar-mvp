import { NextRequest } from "next/server";
import { requirePermissionForRequest } from "@/lib/v2/with-permission";
import { loadChatRow, getLiveState } from "@/lib/chat/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TICK_MS = 1500; // частота серверного опроса БД внутри потока
const MAX_MS = 45_000; // закрываем поток заранее (лимиты функции) — клиент переподключится сам
const HEARTBEAT_MS = 10_000; // комментарий-пинг: держит соединение И выявляет отключившегося клиента

/**
 * SSE-поток живого чата: сервер опрашивает БД и пушит ТОЛЬКО изменения
 * (новые сообщения / read_through / typing). Браузер (EventSource) держит одно
 * соединение и переподключается сам (курсор — через Last-Event-ID). В БД ходит
 * только наш сервер (service_role).
 *
 * Важно для serverless: req.signal НЕ срабатывает при закрытии EventSource, поэтому
 * «мёртвого» клиента выявляем по ошибке enqueue (controller закрыт) — и выходим из цикла.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // CHAT-1: SSE-стрим обязан гейтиться той же open_chat-проверкой, что и
  // polling-фолбэк (messages GET). Иначе член чата, потерявший open_chat
  // (shadow/de-verified/rejected), читает сообщения через SSE в обход гейта.
  // open_chat выдаётся verified + paused (paused читает старые чаты).
  const gate = await requirePermissionForRequest("open_chat");
  if ("response" in gate) return gate.response;
  const { user } = gate;
  const { id } = await params;
  const first = await loadChatRow(id, user.id);
  if (!first) return new Response("not found", { status: 404 });

  const url = new URL(req.url);
  let cursor = req.headers.get("last-event-id") || url.searchParams.get("after") || null;

  const enc = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string): boolean => {
        if (closed) return false;
        try {
          controller.enqueue(enc.encode(s));
          return true;
        } catch {
          closed = true; // клиент отключился — поток закрыт
          return false;
        }
      };
      send(": connected\n\n");

      const started = Date.now();
      let lastBeat = Date.now();
      let prevTyping: boolean | null = null;
      let prevRead: string | null | undefined = undefined;
      const sentIds = new Set<string>(); // чтобы не пере-слать пограничное сообщение (cursor inclusive)

      try {
        while (!closed && !req.signal.aborted && Date.now() - started < MAX_MS) {
          const chat = await loadChatRow(id, user.id);
          if (!chat) break;
          const state = await getLiveState(id, user.id, chat, cursor);

          const fresh = state.messages.filter((m) => !sentIds.has(m.id));
          if (fresh.length) {
            for (const m of fresh) sentIds.add(m.id);
            cursor = fresh[fresh.length - 1].created_at;
          }

          const changed = fresh.length > 0 || state.typing !== prevTyping || state.read_through !== prevRead;
          if (changed) {
            const payload = { messages: fresh, read_through: state.read_through, typing: state.typing };
            if (fresh.length) send(`id: ${cursor!.replace(" ", "T")}\n`);
            if (!send(`data: ${JSON.stringify(payload)}\n\n`)) break;
            prevTyping = state.typing;
            prevRead = state.read_through;
            lastBeat = Date.now();
          } else if (Date.now() - lastBeat > HEARTBEAT_MS) {
            if (!send(`: ping\n\n`)) break; // enqueue упал → клиент мёртв → выходим
            lastBeat = Date.now();
          }
          await new Promise((r) => setTimeout(r, TICK_MS));
        }
      } catch {
        /* отменено/сбой */
      }
      try {
        controller.close();
      } catch {
        /* уже закрыт */
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
