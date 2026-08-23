import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { blockUser } from "@/lib/safety/blocks";
import { chatPairKey } from "@/lib/safety/chat-pair";
import { requirePermissionForRequest } from "@/lib/v2/with-permission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASONS = ["fake", "offensive", "contacts", "spam", "inappropriate", "other"];
// статусы «открытой» жалобы — те же, что в очереди модерации (/admin/reports)
const OPEN_REPORT_STATUSES = ["new", "in_progress", "requires_clarification", "escalated"];

/**
 * Пожаловаться на пользователя/чат (анонимно для нарушителя) → очередь модерации.
 * V2 gate: report_user (verified + paused — safety floor сохраняется на паузе).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requirePermissionForRequest("report_user");
  if ("response" in gate) return gate.response;
  const { user } = gate;
  // chat_id из тела НЕ принимаем. Раньше принимали, и он уходил в запись жалобы
  // без единой проверки: достаточно было руками отправить запрос с id своего
  // чата с посторонним, и модератор открывал дело, читая до 200 сообщений
  // разговора двух людей, к жалобе не причастных - причём подлог выглядел
  // нормальным транскриптом. Ни один клиент это поле не отправлял вообще,
  // то есть панель «переписка как доказательство» у модератора всегда была
  // пустой, а поле служило только для скроенного вручную запроса.
  // Теперь чат выводится на сервере из пары «жалобщик - нарушитель»: дыра
  // закрыта, и заодно доказательство наконец появляется у настоящих жалоб.
  const { target_user_id, reason_code, comment } = (await req.json().catch(() => ({}))) as {
    target_user_id?: string;
    reason_code?: string;
    comment?: string;
  };
  if (!target_user_id || target_user_id === user.id)
    return NextResponse.json({ ok: false, error: "bad_target" }, { status: 400 });
  const reason = REASONS.includes(reason_code ?? "") ? reason_code : "other";

  const sb = supabaseAdmin();

  // E1: жалоба ОБРЫВАЕТ контакт. Пользователь жмёт «Пожаловаться», ожидая, что
  // нарушитель перестанет писать — поэтому одновременно блокируем (глушит чат
  // через areBlocked-гард + рвёт pending-заявки). Идемпотентно; делаем ДО дедупа,
  // чтобы повторная жалоба тоже гарантировала блок. Обратимо через разблокировку.
  const cut = await blockUser(user.id, target_user_id);
  if (!cut) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });

  // дедуп: один ОТКРЫТЫЙ репорт на пару (reporter,target). Иначе один пользователь
  // накрутит счётчик «жалоб: N» на странице модерации (по нему приоритизируют/банят) —
  // griefing; так счётчик отражает число РАЗНЫХ жалующихся, а не повторов одного.
  // Fail-open: если сам dedup-запрос упал — всё равно даём подать жалобу (safety).
  const dup = await sb
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("target_user_id", target_user_id)
    .in("status", OPEN_REPORT_STATUSES)
    .limit(1);
  if (dup.data && dup.data.length) return NextResponse.json({ ok: true, deduped: true });

  // Чат жалобщика с нарушителем - единственный, который модератор вправе
  // прочитать по этой жалобе. Ищем одним равенством: пара в chats хранится
  // нормализованной (least/greatest) и уникальна по индексу chats_pair.
  // Нет чата - нет доказательства, пишем null: жалоба на анкету без переписки
  // это нормальный случай.
  const pair = chatPairKey(user.id, target_user_id);
  const chatRow = await sb
    .from("chats")
    .select("id")
    .eq("user_a", pair.userA)
    .eq("user_b", pair.userB)
    .maybeSingle();
  // Ошибку поиска глотаем намеренно: жалоба важнее доказательства, потерять
  // сигнал о нарушении из-за сбоя вспомогательного запроса нельзя.
  const evidenceChatId = (chatRow.data?.id as string | undefined) ?? null;

  // Жалоба — safety-critical: нельзя отвечать «ok», если запись не легла в очередь
  // модерации (иначе сигнал о нарушении тихо теряется).
  const { error } = await sb.from("reports").insert({
    reporter_id: user.id,
    target_user_id,
    chat_id: evidenceChatId,
    reason_code: reason,
    comment: comment?.slice(0, 1000) ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
