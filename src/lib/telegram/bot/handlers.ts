import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeUzPhone, PhoneError } from "@/lib/phone";
import { transition, tryTransition } from "@/lib/state-machine/transitions";
import { hashPhone } from "@/lib/identity/hashing";
import { signStartToken } from "../start-token";
import { sendMessage, answerCallbackQuery } from "../bot-api";
import type { InlineKeyboardMarkup, ReplyKeyboardMarkup } from "../bot-api";
import { M, pick, type Lang } from "./messages";

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

async function isPhoneBlacklisted(phone: string): Promise<{ blocked: boolean; until?: string }> {
  const sb = supabaseAdmin();
  const h = hashPhone(phone);
  const { data, error } = await sb
    .from("phone_blacklist")
    .select("until_at")
    .eq("phone_hash", h)
    .gt("until_at", new Date().toISOString())
    .order("until_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[bot] phone-blacklist check failed:", error.message);
    return { blocked: false }; // fail-open: лучше пропустить, чем кричать о ложной блокировке
  }
  if (!data) return { blocked: false };
  return { blocked: true, until: data.until_at as string };
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

function buildAppWebUrl(uid: string): string {
  const appUrl = env().APP_URL ?? "https://baxtlilar-mvp-production.up.railway.app";
  const token = signStartToken(uid);
  // Запихиваем токен в URL мини-аппы как ?token=. Сам TG добавит свой
  // tgWebAppData в hash; токен читаем из location.search в AutoBootstrap.
  // Так не нужно настраивать short_name в BotFather (web_app-кнопка тянет
  // любой HTTPS-URL).
  return `${appUrl.replace(/\/$/, "")}/open-in-telegram?token=${encodeURIComponent(token)}`;
}

function openAppButton(uid: string, lang: Lang): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: pick(M.open_app, lang), web_app: { url: buildAppWebUrl(uid) } }],
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

const LEGAL_VERSION = "2026-06-19";

async function recordConsent(
  userId: string,
  types: string[],
  text: string,
  lang: Lang,
): Promise<void> {
  const sb = supabaseAdmin();
  const sha = crypto.createHash("sha256").update(text + "::" + LEGAL_VERSION).digest("hex");
  const rows = types.map((t) => ({
    user_id: userId,
    consent_type: t,
    consent_version: LEGAL_VERSION,
    ip: "tg-webhook",
    user_agent: "telegram-bot",
    language: lang,
    consent_text_sha256: sha,
  }));
  const { error } = await sb.from("consents").insert(rows);
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
    await sendMessage(chatId, "Заблокирован модератором.\nModerator tomonidan bloklangan.");
    return;
  }
  if (user.lifecycle_state === "active" || user.lifecycle_state === "paused") {
    await sendMessage(
      chatId,
      pick(M.already_active, user.language),
      openAppButton(user.id, user.language),
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
      await sendMessage(
        chatId,
        pick(M.pd_consent_ask, user.language),
        pdConsentKeyboard(user.language),
      );
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
        openAppButton(user.id, user.language),
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

  const data = cb.data ?? "";
  const [ns, val] = data.split(":");

  try {
    if (ns === "lang" && user.onboarding_step === "bot_language") {
      const lang: Lang = val === "uz" ? "uz" : "ru";
      const sb = supabaseAdmin();
      const { error } = await sb.from("users").update({ language: lang }).eq("id", user.id);
      if (error) throw new Error(error.message);
      const r = await tryTransition(
        user.id,
        { onboarding_step: "bot_contact", language: lang },
        "bot:language_picked",
        { kind: "user", id: user.id },
      );
      if (!r.ok) {
        await answerCallbackQuery(cb.id, "Try /start again");
        return;
      }
      await answerCallbackQuery(cb.id);
      await sendMessage(chatId, pick(M.contact_ask, lang), contactKeyboard(lang));
      return;
    }

    if (ns === "pd" && user.onboarding_step === "bot_consent_pd") {
      if (val !== "yes") {
        await answerCallbackQuery(cb.id);
        await sendMessage(chatId, pick(M.declined_pd, user.language));
        return;
      }
      await recordConsent(
        user.id,
        ["terms", "privacy", "pd"],
        pick(M.pd_consent_ask, user.language),
        user.language,
      );
      const r = await tryTransition(
        user.id,
        { onboarding_step: "bot_consent_biometric" },
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
        pick(M.bio_consent_ask, user.language),
        bioConsentKeyboard(user.language),
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
        ["biometric"],
        pick(M.bio_consent_ask, user.language),
        user.language,
      );
      // bot_consent_biometric → doc_upload (мини-аппа берёт дальше).
      // verification_status пишем сразу: phone_verified (раз есть phone_number).
      await transition(
        user.id,
        {
          onboarding_step: "doc_upload",
          verification_status: "phone_verified",
        },
        "bot:bio_accepted",
        { kind: "user", id: user.id },
      );
      await answerCallbackQuery(cb.id);
      await sendMessage(
        chatId,
        pick(M.ready, user.language),
        openAppButton(user.id, user.language),
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
  // Telegram иногда передаёт phone_number без "+" — нормализуем под UZ.
  let phone: string;
  try {
    phone = normalizeUzPhone(contact.phone_number);
  } catch (e) {
    if (e instanceof PhoneError) {
      await sendMessage(chatId, "Номер должен быть узбекским (+998).\nUz raqami kerak (+998).");
      return;
    }
    throw e;
  }

  // F-006: cooldown после delete — этот номер мог быть свежеудалённым.
  const blocklist = await isPhoneBlacklisted(phone);
  if (blocklist.blocked) {
    const untilDate = (blocklist.until ?? "").slice(0, 10);
    await sendMessage(
      chatId,
      pick(M.phone_cooldown, user.language).replace("{until}", untilDate || "—"),
    );
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
        "Этот номер уже привязан к другому аккаунту.\nBu raqam boshqa hisobga bog'langan.",
      );
      return;
    }
    console.error("[bot] phone update failed:", upd.error.message);
    await sendMessage(chatId, pick(M.error_generic, user.language));
    return;
  }
  const r = await tryTransition(
    user.id,
    { onboarding_step: "bot_consent_pd" },
    "bot:phone_set",
    { kind: "user", id: user.id },
  );
  if (!r.ok) {
    await sendMessage(chatId, pick(M.error_generic, user.language));
    return;
  }
  await sendMessage(chatId, pick(M.pd_consent_ask, user.language), pdConsentKeyboard(user.language));
}

// =====================================================================
//  Точка входа из webhook'а
// =====================================================================

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.message) {
    const text = update.message.text?.trim() ?? "";
    if (text.startsWith("/start")) {
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
