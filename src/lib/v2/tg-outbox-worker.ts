/**
 * V2 Phase A · Sprint 6 — TG outbox worker.
 *
 * Источник: Blueprint §1.5 («Push в TG бот при approve»).
 *
 * Архитектура:
 *   1. Admin/system enqueue_tg_outbox(user_id, event_type, payload)
 *   2. Worker processOutboxBatch() забирает pending → шлёт через Bot API
 *   3. Успех → sent_at=now; неуспех → attempts++, last_error
 *
 * Hybrid доставка: при enqueue сразу пытаемся доставить sync через
 * processOutboxEvent(id). Падение → запись остаётся pending → cron retry.
 *
 * Cron: см. /api/cron/tg-outbox + Railway scheduled job (раз в N секунд).
 */

import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export type OutboxEventType =
  | "verification_approved"
  | "verification_needs_changes"
  | "verification_rejected"
  | "tutorial_reminder";

export type OutboxPayload = {
  // Свободная форма, ивент-специфичная (например reason при rejected).
  reason?: string;
  reject_category?: "technical" | "blocking";
  locale?: "ru" | "uz";
};

type TgUser = { telegram_id: number | null; language: "ru" | "uz" | null };

type OutboxRow = {
  id: string;
  user_id: string;
  event_type: OutboxEventType;
  payload: OutboxPayload;
  attempts: number;
};

// =============================================================================
// Templates (RU + UZ)
// =============================================================================

const TEMPLATES: Record<OutboxEventType, { ru: (p: OutboxPayload) => string; uz: (p: OutboxPayload) => string }> = {
  verification_approved: {
    ru: () =>
      "✅ Профиль одобрен.\nТеперь Baxtlilar покажет тебе подбор и&nbsp;ты сможешь отправлять интересы. Открой приложение.",
    uz: () =>
      "✅ Profilingiz tasdiqlandi.\nEndi Baxtlilar sizga moslamani ko‘rsatadi va qiziqish yuborishingiz mumkin. Ilovani oching.",
  },
  verification_needs_changes: {
    ru: (p) =>
      p.reason
        ? `Модератор просит уточнить пару моментов.\n\nПричина: ${p.reason}\n\nОткрой Baxtlilar и&nbsp;переделай — займёт пару минут.`
        : "Модератор просит уточнить пару моментов.\nОткрой Baxtlilar и переделай — займёт пару минут.",
    uz: (p) =>
      p.reason
        ? `Moderator bir nechta narsani aniqlashtirishni so‘ramoqda.\n\nSabab: ${p.reason}\n\nBaxtlilar’ni oching va qaytadan yuboring.`
        : "Moderator bir nechta narsani aniqlashtirishni so‘ramoqda.\nBaxtlilar’ni oching va qaytadan yuboring.",
  },
  verification_rejected: {
    ru: (p) =>
      p.reject_category === "blocking"
        ? "К сожалению, мы не смогли подтвердить твою личность.\nЕсли считаешь это ошибкой — напиши в @baxtlilar_support."
        : "Нужно переснять документы — модератор не смог проверить твои фото.\nОткрой Baxtlilar и попробуй ещё раз.",
    uz: (p) =>
      p.reject_category === "blocking"
        ? "Afsuski, shaxsingizni tasdiqlay olmadik.\nXatolik deb hisoblasangiz — @baxtlilar_support’ga yozing."
        : "Hujjatlarni qayta suratga olishingiz kerak.\nBaxtlilar’ni oching va yana urinib ko‘ring.",
  },
  tutorial_reminder: {
    ru: () =>
      "Ты ещё не закончил знакомство с приложением.\nЭто займёт пару минут — и можно начинать.",
    uz: () =>
      "Ilova bilan tanishishni hali tugatmadingiz.\nBu bir necha daqiqa vaqt oladi.",
  },
};

export function renderTemplate(
  type: OutboxEventType,
  payload: OutboxPayload,
  locale: "ru" | "uz",
): string {
  const t = TEMPLATES[type];
  return locale === "uz" ? t.uz(payload) : t.ru(payload);
}

// =============================================================================
// Bot API
// =============================================================================

async function sendBotMessage(telegramId: number, text: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${env().TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Plain text (нет HTML/MD) — следует политике notify.ts: модератор/system
        // тексты не должны быть parse_mode-уязвимы.
        body: JSON.stringify({ chat_id: telegramId, text }),
      },
    );
    return res.ok;
  } catch (e) {
    console.error("[tg-outbox] sendBotMessage failed:", e);
    return false;
  }
}

// =============================================================================
// Worker
// =============================================================================

async function loadUserForOutbox(userId: string): Promise<TgUser | null> {
  const { data } = await supabaseAdmin()
    .from("users")
    .select("telegram_id, language, lifecycle_state")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  // deleted user — telegram_id обнулён (F-012 erase_user). Не пушим.
  if (data.lifecycle_state === "deleted") return null;
  return { telegram_id: data.telegram_id as number | null, language: data.language as "ru" | "uz" | null };
}

async function markSent(id: string): Promise<void> {
  await supabaseAdmin()
    .from("tg_outbox")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id);
}

async function markFailed(id: string, error: string, attempts: number): Promise<void> {
  await supabaseAdmin()
    .from("tg_outbox")
    .update({ last_error: error.slice(0, 500), attempts: attempts + 1 })
    .eq("id", id);
}

/**
 * Обработать одну запись по id. Идемпотентно: если уже sent_at != null —
 * скипает. Возвращает true при успехе доставки.
 */
export async function processOutboxEvent(id: string): Promise<boolean> {
  const { data: row } = await supabaseAdmin()
    .from("tg_outbox")
    .select("id, user_id, event_type, payload, attempts, sent_at")
    .eq("id", id)
    .maybeSingle();
  if (!row) return false;
  if (row.sent_at) return true; // уже доставлено

  const r = row as OutboxRow & { sent_at: string | null };
  const user = await loadUserForOutbox(r.user_id);
  if (!user || !user.telegram_id) {
    // Нет telegram_id (или deleted) — отметим sent_at чтобы не ретраить вечно.
    // last_error фиксирует причину для аудита.
    await supabaseAdmin()
      .from("tg_outbox")
      .update({ sent_at: new Date().toISOString(), last_error: "no_telegram_id" })
      .eq("id", r.id);
    return false;
  }

  const locale = r.payload.locale ?? user.language ?? "ru";
  const text = renderTemplate(r.event_type, r.payload, locale);
  const ok = await sendBotMessage(user.telegram_id, text);
  if (ok) {
    await markSent(r.id);
    return true;
  }
  await markFailed(r.id, "tg_send_failed", r.attempts);
  return false;
}

/**
 * Drain pending events (sent_at IS NULL) FIFO, max=limit штук.
 * Возвращает stats для логирования / cron мониторинга.
 *
 * Skip: attempts > 5 — exponential backoff не делаем для MVP, просто бросаем.
 * Такие записи в админке руками можно ресэтнуть (attempts=0).
 */
export async function processOutboxBatch(
  limit = 50,
): Promise<{ processed: number; sent: number; failed: number }> {
  const { data: rows } = await supabaseAdmin()
    .from("tg_outbox")
    .select("id, attempts")
    .is("sent_at", null)
    .lt("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!rows?.length) return { processed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const ok = await processOutboxEvent((row as { id: string }).id);
    if (ok) sent++;
    else failed++;
  }
  return { processed: rows.length, sent, failed };
}

/**
 * Hybrid path: вызывается из admin/sender routes сразу после enqueue —
 * sync-доставка best-effort. Падение оставляет запись pending,
 * worker подберёт.
 *
 * Использование:
 *   const { data } = await sb.rpc('enqueue_tg_outbox', { p_user_id, p_event_type, p_payload });
 *   await tryDeliverNow(data); // best-effort, не бросает
 */
export async function tryDeliverNow(outboxId: string | null | undefined): Promise<void> {
  if (!outboxId) return;
  try {
    await processOutboxEvent(outboxId);
  } catch (e) {
    console.error("[tg-outbox] tryDeliverNow failed:", e);
  }
}
