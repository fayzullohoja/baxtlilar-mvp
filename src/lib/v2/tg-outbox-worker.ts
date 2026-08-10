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
  | "tutorial_reminder"
  // F1: match/chat события теперь тоже через outbox (retry-safe + локаль получателя)
  | "mutual_match"
  | "new_interest"
  | "interest_accepted"
  | "new_message";

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
      "✅ Профиль одобрен.\nТеперь Baxtlilar покажет Вам подбор и Вы сможете отправлять интересы. Откройте приложение.",
    uz: () =>
      "✅ Profilingiz tasdiqlandi.\nEndi Baxtlilar sizga moslamani ko‘rsatadi va qiziqish yuborishingiz mumkin. Ilovani oching.",
  },
  verification_needs_changes: {
    ru: (p) =>
      p.reason
        ? `Модератор просит уточнить пару моментов.\n\nПричина: ${p.reason}\n\nОткройте Baxtlilar и переделайте — займёт пару минут.`
        : "Модератор просит уточнить пару моментов.\nОткройте Baxtlilar и переделайте — займёт пару минут.",
    uz: (p) =>
      p.reason
        ? `Moderator bir nechta narsani aniqlashtirishni so‘ramoqda.\n\nSabab: ${p.reason}\n\nBaxtlilar’ni oching va qaytadan yuboring.`
        : "Moderator bir nechta narsani aniqlashtirishni so‘ramoqda.\nBaxtlilar’ni oching va qaytadan yuboring.",
  },
  verification_rejected: {
    ru: (p) =>
      p.reject_category === "blocking"
        ? "К сожалению, мы не смогли подтвердить Вашу личность.\nЕсли считаете это ошибкой — напишите в @baxtlilar_support."
        : "Нужно переснять документы — модератор не смог проверить Ваши фото.\nОткройте Baxtlilar и попробуйте ещё раз.",
    uz: (p) =>
      p.reject_category === "blocking"
        ? "Afsuski, shaxsingizni tasdiqlay olmadik.\nXatolik deb hisoblasangiz — @baxtlilar_support’ga yozing."
        : "Hujjatlarni qayta suratga olishingiz kerak.\nBaxtlilar’ni oching va yana urinib ko‘ring.",
  },
  tutorial_reminder: {
    ru: () =>
      "Вы ещё не закончили знакомство с приложением.\nЭто займёт пару минут — и можно начинать.",
    uz: () =>
      "Ilova bilan tanishishni hali tugatmadingiz.\nBu bir necha daqiqa vaqt oladi.",
  },
  mutual_match: {
    ru: () => "Ваш интерес взаимен — чат открыт в Baxtlilar.",
    uz: () => "Qiziqishingiz o‘zaro bo‘ldi — Baxtlilar’da chat ochildi.",
  },
  new_interest: {
    ru: () => "У Вас новый интерес в Baxtlilar. Откройте «Запросы».",
    uz: () => "Baxtlilar’da sizga yangi qiziqish bor. «So‘rovlar»ni oching.",
  },
  interest_accepted: {
    ru: () => "Ваш интерес принят — чат открыт в Baxtlilar.",
    uz: () => "Qiziqishingiz qabul qilindi — Baxtlilar’da chat ochildi.",
  },
  new_message: {
    ru: () => "Новое сообщение в Baxtlilar.",
    uz: () => "Baxtlilar’da yangi xabar.",
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

// C-032: строка «занята» этим воркером на время попытки (claim_tg_outbox ставит
// locked_until = now + LOCK_SECONDS). Достаточно на один HTTP-запрос к Bot API.
const LOCK_SECONDS = 60;

/** Экспоненциальный backoff с потолком 30 мин: 1,2,4,8,16,30 мин по attempts. */
export function backoffMs(attempts: number): number {
  return Math.min(2 ** attempts, 30) * 60_000;
}

async function markSent(id: string): Promise<void> {
  await supabaseAdmin()
    .from("tg_outbox")
    .update({ sent_at: new Date().toISOString(), locked_until: null })
    .eq("id", id);
}

async function markFailed(id: string, error: string, attempts: number): Promise<void> {
  // Освобождаем лок и откладываем следующую попытку (backoff) — иначе строка
  // ретраилась бы каждый тик крона до attempts=5.
  await supabaseAdmin()
    .from("tg_outbox")
    .update({
      last_error: error.slice(0, 500),
      attempts: attempts + 1,
      next_attempt_at: new Date(Date.now() + backoffMs(attempts)).toISOString(),
      locked_until: null,
    })
    .eq("id", id);
}

/** Доставить одну ЗАКЛЕЙМЛЕННУЮ строку (данные уже получены из claim). */
async function deliverRow(row: OutboxRow): Promise<boolean> {
  const user = await loadUserForOutbox(row.user_id);
  if (!user || !user.telegram_id) {
    // Нет telegram_id (или deleted) — sent_at чтобы не ретраить вечно; last_error для аудита.
    await supabaseAdmin()
      .from("tg_outbox")
      .update({ sent_at: new Date().toISOString(), last_error: "no_telegram_id", locked_until: null })
      .eq("id", row.id);
    return false;
  }
  const locale = row.payload.locale ?? user.language ?? "ru";
  const text = renderTemplate(row.event_type, row.payload, locale);
  const ok = await sendBotMessage(user.telegram_id, text);
  if (ok) {
    await markSent(row.id);
    return true;
  }
  await markFailed(row.id, "tg_send_failed", row.attempts);
  return false;
}

/**
 * Обработать одну запись по id (sync-путь tryDeliverNow). Клеймит строку через
 * claim_tg_outbox_one (FOR UPDATE SKIP LOCKED + locked_until): если её уже держит
 * cron или она отправлена/исчерпана — пропускает (нет двойной доставки).
 */
export async function processOutboxEvent(id: string): Promise<boolean> {
  const { data: claimed } = await supabaseAdmin().rpc("claim_tg_outbox_one", {
    p_id: id,
    p_lock_seconds: LOCK_SECONDS,
  });
  const row = (Array.isArray(claimed) ? claimed[0] : claimed) as OutboxRow | undefined;
  if (!row) return false; // занята другим воркером / уже sent / attempts исчерпаны
  return deliverRow(row);
}

/**
 * Drain готовых к доставке событий (claim FOR UPDATE SKIP LOCKED + locked_until).
 * Конкурентные воркеры (cron + sync tryDeliverNow) не берут одну строку дважды.
 * Отложенные (next_attempt_at в будущем, backoff) и заблокированные пропускаются.
 */
export async function processOutboxBatch(
  limit = 50,
): Promise<{ processed: number; sent: number; failed: number }> {
  const { data: rows } = await supabaseAdmin().rpc("claim_tg_outbox", {
    p_limit: limit,
    p_lock_seconds: LOCK_SECONDS,
  });
  const claimed = (rows as OutboxRow[] | null) ?? [];
  if (!claimed.length) return { processed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const row of claimed) {
    const ok = await deliverRow(row);
    if (ok) sent++;
    else failed++;
  }
  return { processed: claimed.length, sent, failed };
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

/**
 * F1: положить событие в outbox + best-effort sync-доставка. Заменяет прямой
 * notifyUser в sender-роутах — теперь матч/новый интерес/принятие/новое
 * сообщение идут через retry-safe очередь (не теряются при сбое/бане бота) и
 * рендерятся на локали получателя. Принимает user_id (uuid), не telegram_id —
 * telegram_id и пропуск deleted делает worker.
 */
export async function enqueueAndDeliver(
  userId: string,
  eventType: OutboxEventType,
  payload: OutboxPayload = {},
): Promise<void> {
  const { data } = await supabaseAdmin().rpc("enqueue_tg_outbox", {
    p_user_id: userId,
    p_event_type: eventType,
    p_payload: payload,
  });
  await tryDeliverNow((data as string | null) ?? null);
}
