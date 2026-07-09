import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeInternationalPhone, PhoneError } from "@/lib/phone";
import { transition, tryTransition } from "@/lib/state-machine/transitions";
import { hashPhone } from "@/lib/identity/hashing";
import { signStartToken } from "../start-token";
import { sendMessage, answerCallbackQuery } from "../bot-api";
import type { InlineKeyboardMarkup, ReplyKeyboardMarkup } from "../bot-api";
import { M, pick, type Lang } from "./messages";
import { LEGAL_VERSION } from "@/content/legal";
import { TokenBucketLimiter } from "@/lib/http/rate-limit";

// SEC-3a: per-user кулдаун на /start — каждый /start = sendMessage + запросы к
// БД, циклом его дёргать нельзя. Burst 3 (легитимные double-tap), дальше 1 в
// 20с. In-memory (один инстанс); лишние /start молча игнорируем — ответ на
// флуд сам был бы усилителем.
const startCooldown = new TokenBucketLimiter({ capacity: 3, refillPerSec: 0.05 });

/**
 * V3 (2026-06-30, product feedback): legal-документы шлём как HTML
 * hyperlinks в самом тексте согласия, а не как 4 отдельных PDF-attachment.
 * Чище лента бота + клик переходит сразу к нужному документу.
 *
 * Контент pd_consent_ask формируется как HTML с <a href="${APP_URL}/legal/*.pdf">.
 * parse_mode="HTML" безопасен т.к. контент — статическая константа в M, не user input.
 */
async function sendLegalDocsAndConsentPrompt(chatId: number, lang: Lang): Promise<void> {
  await sendMessage(chatId, pick(M.pd_consent_ask, lang), pdConsentKeyboard(lang), "HTML");
}

// =====================================================================
//  Telegram Update shapes (минимум, что нам реально нужен — без всей PI).
// =====================================================================

type TgChat = { id: number };
type TgUser = {
  id: number;
  is_bot?: boolean;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};
type TgContact = { phone_number: string; user_id?: number };
type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
  contact?: TgContact;
};
type TgCallbackQuery = {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
};
export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
};

// =====================================================================
//  Утилиты
// =====================================================================

function detectLang(tg?: TgUser): Lang {
  const lc = tg?.language_code?.toLowerCase() ?? "";
  if (lc.startsWith("uz")) return "uz";
  if (lc.startsWith("tr")) return "tr";
  return "ru";
}

type DbUser = {
  id: string;
  telegram_id: number;
  language: Lang;
  lifecycle_state: string;
  onboarding_step: string;
  phone_number: string | null;
  phone_verified: boolean;
};

async function findByTg(tgId: number): Promise<DbUser | null> {
  const sb = supabaseAdmin();
  // F-006: deleted-строки игнорируем — partial UNIQUE их допускает, и
  // пользователь после delete должен иметь возможность создать новый аккаунт.
  // (Cooldown по phone в phone_blacklist срабатывает только при попытке
  // привязать тот же номер; здесь же — про телеграм.)
  const { data, error } = await sb
    .from("users")
    .select("id, telegram_id, language, lifecycle_state, onboarding_step, phone_number, phone_verified")
    .eq("telegram_id", tgId)
    .neq("lifecycle_state", "deleted")
    .maybeSingle();
  if (error) {
    console.error("[bot] findByTg failed:", error.message);
    return null;
  }
  return (data as DbUser) ?? null;
}

async function isPhoneBlacklisted(
  phone: string,
): Promise<{ blocked: boolean; reason?: "blocking" | "cooldown" | "tombstone_check_failed"; until?: string }> {
  // F-final-2 (C11 verdict): split fail-policy.
  //   blocking-tombstone (verification_blocking_reject) → fail-closed:
  //     при DB-error отказываем регистрацию. Лучше ложно заблокировать одного
  //     legit-юзера на минуту, чем пустить катфиша через transient DB issue.
  //   cooldown (account_deleted 90д) → fail-open:
  //     UX-friendly для случайного self-delete. Не критично пустить, если БД лежит.
  const sb = supabaseAdmin();
  const h = hashPhone(phone);
  const now = new Date().toISOString();

  // 1. Blocking tombstone first.
  const blocking = await sb
    .from("phone_blacklist")
    .select("until_at")
    .eq("phone_hash", h)
    .eq("reason", "verification_blocking_reject")
    .gt("until_at", now)
    .limit(1)
    .maybeSingle();
  if (blocking.error) {
    console.error("[bot] phone-blacklist blocking check failed:", blocking.error.message);
    return { blocked: true, reason: "tombstone_check_failed" }; // fail-closed
  }
  if (blocking.data) {
    return { blocked: true, reason: "blocking", until: blocking.data.until_at as string };
  }

  // 2. Cooldown — fail-open.
  const cooldown = await sb
    .from("phone_blacklist")
    .select("until_at")
    .eq("phone_hash", h)
    .neq("reason", "verification_blocking_reject")
    .gt("until_at", now)
    .order("until_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cooldown.error) {
    console.error("[bot] phone-blacklist cooldown check failed:", cooldown.error.message);
    return { blocked: false };
  }
  if (!cooldown.data) return { blocked: false };
  return { blocked: true, reason: "cooldown", until: cooldown.data.until_at as string };
}

async function createInitial(tg: TgUser): Promise<DbUser | null> {
  const sb = supabaseAdmin();
  const language: Lang = detectLang(tg); // временный язык, юзер уточнит на bot_language
  const { data, error } = await sb
    .from("users")
    .insert({
      telegram_id: tg.id,
      telegram_username: tg.username ?? null,
      telegram_first_name: tg.first_name ?? null,
      telegram_last_name: tg.last_name ?? null,
      language,
      // дефолт onboarding_step — bot_language (см. миграцию 20260619100000)
    })
    .select("id, telegram_id, language, lifecycle_state, onboarding_step, phone_number, phone_verified")
    .single();
  if (error || !data) {
    // гонка по unique(telegram_id) — перечитываем
    if (error && (error.code === "23505" || /duplicate|unique/i.test(error.message))) {
      return await findByTg(tg.id);
    }
    console.error("[bot] createInitial failed:", error?.message);
    return null;
  }
  return data as DbUser;
}

function buildAppWebUrl(uid: string, telegramId: number, lang: Lang): string {
  const appUrl = env().APP_URL ?? "https://baxtlilar-mvp-production.up.railway.app";
  // H3 verdict-fix: токен биндится к telegram_id юзера. /api/auth/bootstrap
  // проверяет parsed.user.id === verifiedToken.tg — украденный токен в чужой
  // initData больше не пройдёт.
  const token = signStartToken(uid, telegramId);
  // Bug #19 (loop pass 4): передаём язык query-параметром. /api/auth/bootstrap
  // прочитает его и поставит cookie NEXT_LOCALE — middleware next-intl
  // перенаправит на правильную локаль после window.location.replace("/").
  // Path-prefix /${lang}/open-in-telegram не работает — этой страницы нет
  // под [locale]/.
  return `${appUrl.replace(/\/$/, "")}/open-in-telegram?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(lang)}`;
}

function openAppButton(uid: string, telegramId: number, lang: Lang): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: pick(M.open_app, lang), web_app: { url: buildAppWebUrl(uid, telegramId, lang) } }],
    ],
  };
}

function langKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: M.lang_ru, callback_data: "lang:ru" },
        { text: M.lang_uz, callback_data: "lang:uz" },
      ],
      [{ text: M.lang_tr, callback_data: "lang:tr" }],
    ],
  };
}

function contactKeyboard(lang: Lang): ReplyKeyboardMarkup {
  return {
    keyboard: [[{ text: pick(M.contact_button, lang), request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function pdConsentKeyboard(lang: Lang): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: pick(M.pd_consent_yes, lang), callback_data: "pd:yes" },
        { text: pick(M.pd_consent_no, lang), callback_data: "pd:no" },
      ],
    ],
  };
}

function bioConsentKeyboard(lang: Lang): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: pick(M.bio_consent_yes, lang), callback_data: "bio:yes" },
        { text: pick(M.bio_consent_no, lang), callback_data: "bio:no" },
      ],
    ],
  };
}

// =====================================================================
//  Запись consent с доказательством (F-013/F-004/P4)
// =====================================================================

async function recordConsent(
  userId: string,
  telegramId: number,
  types: string[],
  text: string,
  lang: Lang,
): Promise<void> {
  const sb = supabaseAdmin();
  const sha = crypto.createHash("sha256").update(text + "::" + LEGAL_VERSION).digest("hex");
  // LC-1: категории ПД — грубый хук для юриста. Биометрия — спец-категория
  // (ст. 24 закона РУз «О ПД»); остальное — общие ПД под зонтичным согласием.
  // Точный список категорий и нужны ли гранулярные согласия — решение юриста
  // (docs/lawyer-brief-2026-07-04.md).
  const categories = types.includes("biometric") ? ["biometric"] : ["general_pd"];
  // LC-1: единая точка записи — record_consent RPC (insert-or-REACTIVATE).
  // Идемпотентен на retry/двойной callback (H12) и снимает withdrawn при
  // свежем согласии той же версии (иначе «отзыв залипает»).
  const { error } = await sb.rpc("record_consent", {
    p_user_id: userId,
    p_telegram_id: telegramId,
    p_types: types,
    p_version: LEGAL_VERSION,
    p_language: lang,
    p_sha: sha,
    p_source: "tg_bot",
    p_categories: categories,
    p_ip: "tg-webhook",
    p_user_agent: "telegram-bot",
  });
  if (error) {
    console.error("[bot] consent insert failed:", error.message);
    throw error;
  }
}

// =====================================================================
//  Высокоуровневые шаги — отправка вопроса/итога
// =====================================================================

async function promptStep(chatId: number, user: DbUser): Promise<void> {
  // lifecycle переопределяет шаг
  if (user.lifecycle_state === "blocked") {
    await sendMessage(chatId, pick(M.blocked_by_moderator, user.language));
    return;
  }
  if (user.lifecycle_state === "active" || user.lifecycle_state === "paused") {
    await sendMessage(
      chatId,
      pick(M.already_active, user.language),
      openAppButton(user.id, user.telegram_id, user.language),
    );
    return;
  }
  switch (user.onboarding_step) {
    case "bot_language":
      await sendMessage(chatId, M.greeting, langKeyboard());
      return;
    case "bot_contact":
      await sendMessage(chatId, pick(M.contact_ask, user.language), contactKeyboard(user.language));
      return;
    case "bot_consent_pd":
      // V2 ext 2026-06-28: 4 PDF + сообщение с клавиатурой.
      await sendLegalDocsAndConsentPrompt(chatId, user.language);
      return;
    case "bot_consent_biometric":
      await sendMessage(
        chatId,
        pick(M.bio_consent_ask, user.language),
        bioConsentKeyboard(user.language),
      );
      return;
    default:
      // Пользователь уже прошёл регистрацию у бота → открыть мини-аппу
      await sendMessage(
        chatId,
        pick(M.ready, user.language),
        openAppButton(user.id, user.telegram_id, user.language),
      );
      return;
  }
}

// =====================================================================
//  Хендлеры команд/событий
// =====================================================================

async function handleStart(msg: TgMessage): Promise<void> {
  const tg = msg.from;
  if (!tg) return;
  if (tg.is_bot) return;
  const chatId = msg.chat.id;
  let user = await findByTg(tg.id);
  if (!user) {
    user = await createInitial(tg);
  }
  if (!user) {
    await sendMessage(chatId, pick(M.error_generic, "ru"));
    return;
  }
  await promptStep(chatId, user);
}

async function handleCallback(cb: TgCallbackQuery): Promise<void> {
  const tg = cb.from;
  const chatId = cb.message?.chat.id;
  if (!chatId) {
    await answerCallbackQuery(cb.id);
    return;
  }
  const user = await findByTg(tg.id);
  if (!user) {
    // нет user — переотправим /start логику
    await answerCallbackQuery(cb.id);
    if (cb.message) await handleStart({ ...cb.message, from: tg, text: "/start" });
    return;
  }

  // TGBOT-2: заблокированный юзер не должен мутировать свой онбординг через
  // устаревшие consent-кнопки (lang:/pd:/bio:). Хендлеры гейтились только по
  // onboarding_step — заблокированный mid-онбординга мог кликнуть bio:yes и
  // продвинуть onboarding_step + verification_status. Короткое замыкание до
  // диспетча. (pending_ban НЕ трогаем — Option A: невидимое предложение бана,
  // юзер продолжает как active.)
  if (user.lifecycle_state === "blocked") {
    await answerCallbackQuery(cb.id);
    await promptStep(chatId, user);
    return;
  }

  const data = cb.data ?? "";
  const [ns, val] = data.split(":");

  try {
    if (ns === "lang" && user.onboarding_step === "bot_language") {
      const lang: Lang = val === "uz" ? "uz" : val === "tr" ? "tr" : "ru";
      const sb = supabaseAdmin();
      const { error } = await sb.from("users").update({ language: lang }).eq("id", user.id);
      if (error) throw new Error(error.message);
      // V2 ext 2026-06-28 round 2: после языка → оферта (ДО передачи телефона).
      const r = await tryTransition(
        user.id,
        { onboarding_step: "bot_consent_pd", language: lang },
        "bot:language_picked",
        { kind: "user", id: user.id },
      );
      if (!r.ok) {
        await answerCallbackQuery(cb.id, "Try /start again");
        return;
      }
      await answerCallbackQuery(cb.id);
      // V2 ext 2026-06-28: после языка → 4 PDF + сообщение оферты.
      await sendLegalDocsAndConsentPrompt(chatId, lang);
      return;
    }

    if (ns === "pd" && user.onboarding_step === "bot_consent_pd") {
      if (val !== "yes") {
        await answerCallbackQuery(cb.id);
        await sendMessage(chatId, pick(M.declined_pd, user.language));
        return;
      }
      // V2 ext 2026-06-28 round 2: оферта объединяет 4 документа —
      // terms+privacy+offer+rules (биометрия будет отдельным согласием на шаге 4).
      await recordConsent(
        user.id,
        user.telegram_id,
        ["terms", "privacy", "offer", "pd", "rules"],
        pick(M.pd_consent_ask, user.language),
        user.language,
      );
      // V2 ext 2026-06-28 round 2: после оферты → телефон (а не биометрия).
      const r = await tryTransition(
        user.id,
        { onboarding_step: "bot_contact" },
        "bot:pd_accepted",
        { kind: "user", id: user.id },
      );
      if (!r.ok) {
        await answerCallbackQuery(cb.id);
        return;
      }
      await answerCallbackQuery(cb.id);
      await sendMessage(
        chatId,
        pick(M.contact_ask, user.language),
        contactKeyboard(user.language),
      );
      return;
    }

    if (ns === "bio" && user.onboarding_step === "bot_consent_biometric") {
      if (val !== "yes") {
        await answerCallbackQuery(cb.id);
        await sendMessage(chatId, pick(M.declined_bio, user.language));
        return;
      }
      await recordConsent(
        user.id,
        user.telegram_id,
        ["biometric"],
        pick(M.bio_consent_ask, user.language),
        user.language,
      );
      // V2 ext 2026-06-28 hard-cutover: bot_consent_biometric → welcome_mission
      // (3 экрана welcome перед verification_intro). Раньше шёл сразу в
      // verification_intro — это сломалось вместе с моим hard-cutover state-machine
      // фиксом (ALLOWED_TRANSITIONS.bot_consent_biometric теперь = ["welcome_mission"]).
      // verification_status пишем сразу: phone_verified (раз есть phone_number).
      await transition(
        user.id,
        {
          onboarding_step: "welcome_mission",
          verification_status: "phone_verified",
        },
        "bot:bio_accepted",
        { kind: "user", id: user.id },
      );
      await answerCallbackQuery(cb.id);
      await sendMessage(
        chatId,
        pick(M.ready, user.language),
        openAppButton(user.id, user.telegram_id, user.language),
      );
      return;
    }

    // Неактуальный callback (старая клавиатура / wrong_step) — мягко ответим текущим шагом
    await answerCallbackQuery(cb.id);
    await promptStep(chatId, user);
  } catch (e) {
    console.error("[bot] callback error:", e instanceof Error ? e.message : e);
    await answerCallbackQuery(cb.id, "Error, try /start");
  }
}

async function handleContact(msg: TgMessage): Promise<void> {
  const tg = msg.from;
  const contact = msg.contact;
  if (!tg || !contact) return;
  const chatId = msg.chat.id;
  const user = await findByTg(tg.id);
  if (!user) {
    await handleStart(msg);
    return;
  }
  if (user.onboarding_step !== "bot_contact") {
    // не на этом шаге — игнор + промпт текущего
    await promptStep(chatId, user);
    return;
  }
  // F-007 / SMS2: контакт должен быть СВОИМ. Жёсткий чек:
  //  (1) request_contact-кнопка ВСЕГДА присылает contact.user_id == sender.id;
  //  (2) если user_id отсутствует — это пересланная карточка стороннего лица
  //      (контакт не зарегистрирован в TG), мы НЕ имеем согласия владельца номера;
  //  (3) если user_id есть, но не равен sender.id — пересланный TG-контакт.
  // Принимаем только (1).
  if (contact.user_id !== tg.id) {
    await sendMessage(chatId, pick(M.contact_not_yours, user.language));
    return;
  }
  // Telegram иногда передаёт phone_number без "+" — нормализуем в E.164.
  // 2026-06-20: больше НЕ требуем +998 — резиденты УЗ с иностранными SIM
  // (диаспора, рабочие за границей) тоже должны проходить. Trust-якорь не
  // в стране номера, а в чеке contact.user_id === sender.id выше.
  let phone: string;
  try {
    phone = normalizeInternationalPhone(contact.phone_number);
  } catch (e) {
    if (e instanceof PhoneError) {
      await sendMessage(
        chatId,
        pick(M.phone_recognize_failed, user.language),
      );
      return;
    }
    throw e;
  }

  // F-006 cooldown + R2 blocking-tombstone + C11 fail-closed-on-blocking.
  const blocklist = await isPhoneBlacklisted(phone);
  if (blocklist.blocked) {
    let text: string;
    if (blocklist.reason === "blocking") {
      text = pick(M.phone_blocking, user.language);
    } else if (blocklist.reason === "tombstone_check_failed") {
      text = pick(M.phone_check_failed, user.language);
    } else {
      const untilDate = (blocklist.until ?? "").slice(0, 10);
      text = pick(M.phone_cooldown, user.language).replace("{until}", untilDate || "—");
    }
    await sendMessage(chatId, text);
    return;
  }

  // Проставляем phone + phone_verified=true (TG уже верифицировал) + ход на consent_pd.
  // Уникальный partial-index по phone (для phone_verified=true) может бросить — обрабатываем.
  const sb = supabaseAdmin();
  const upd = await sb
    .from("users")
    .update({ phone_number: phone, phone_verified: true })
    .eq("id", user.id);
  if (upd.error) {
    if (upd.error.code === "23505" || /duplicate|unique/i.test(upd.error.message)) {
      await sendMessage(
        chatId,
        pick(M.phone_duplicate, user.language),
      );
      return;
    }
    console.error("[bot] phone update failed:", upd.error.message);
    await sendMessage(chatId, pick(M.error_generic, user.language));
    return;
  }
  // V2 ext 2026-06-28 round 2: после телефона → биометрия (а не оферта,
  // оферту уже приняли до телефона).
  const r = await tryTransition(
    user.id,
    { onboarding_step: "bot_consent_biometric" },
    "bot:phone_set",
    { kind: "user", id: user.id },
  );
  if (!r.ok) {
    await sendMessage(chatId, pick(M.error_generic, user.language));
    return;
  }
  await sendMessage(
    chatId,
    pick(M.bio_consent_ask, user.language),
    bioConsentKeyboard(user.language),
  );
}

// =====================================================================
//  Точка входа из webhook'а
// =====================================================================

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.message) {
    const text = update.message.text?.trim() ?? "";
    if (text.startsWith("/start")) {
      if (!startCooldown.take(`tg:${update.message.chat.id}`)) return;
      await handleStart(update.message);
      return;
    }
    if (update.message.contact) {
      await handleContact(update.message);
      return;
    }
    // прочие сообщения игнорируем (или мягко промптим current step)
    const user = update.message.from ? await findByTg(update.message.from.id) : null;
    if (user) await promptStep(update.message.chat.id, user);
    return;
  }
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }
}
