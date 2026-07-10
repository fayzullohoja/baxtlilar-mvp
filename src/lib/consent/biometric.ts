import "server-only";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LEGAL_VERSION } from "@/content/legal";
import { BIOMETRIC_CONSENT_TEXT } from "@/content/biometric-consent";

/**
 * Согласие на биометрию — app-side (перенесено из бота 2026-07-10).
 *
 * Записывается на экране верификации (verification_intro CTA) ПЕРЕД загрузкой
 * документа/селфи и ENFORCE'ится в upload-роутах (doc/selfie) — потому что
 * retry-пути (needs_changes/verification_rejected → doc_upload) минуют intro
 * (совет advisor: record at intro, enforce at upload).
 *
 * Хэш идентичен бот-версии: sha256(text + '::' + LEGAL_VERSION) — единый текст
 * из @/content/biometric-consent, поэтому (text::version) tuple consistent.
 */

const CONSENT_HASH_NS = "::";

function shaFor(text: string): string {
  return crypto.createHash("sha256").update(text + CONSENT_HASH_NS + LEGAL_VERSION).digest("hex");
}

/** Есть ли активное согласие на биометрию у юзера. */
export async function hasActiveBiometricConsent(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("consents")
    .select("consent_type")
    .eq("user_id", userId)
    .eq("consent_type", "biometric")
    .eq("consent_status", "active")
    .limit(1)
    .maybeSingle();
  if (error) {
    // fail-closed: без подтверждённого согласия биометрию не принимаем.
    console.error("[consent] biometric check failed:", error.message);
    return false;
  }
  return !!data;
}

/**
 * Записать согласие на биометрию (record_consent RPC — insert-or-reactivate,
 * идемпотентно). Реальные ip/user_agent из запроса — лучшее доказательство,
 * чем бот-плейсхолдеры 'tg-webhook'/'telegram-bot'.
 */
export async function recordBiometricConsent(opts: {
  userId: string;
  telegramId: number;
  lang: "ru" | "uz";
  ip: string;
  userAgent: string;
}): Promise<{ ok: boolean }> {
  const text = BIOMETRIC_CONSENT_TEXT[opts.lang];
  const { error } = await supabaseAdmin().rpc("record_consent", {
    p_user_id: opts.userId,
    p_telegram_id: opts.telegramId,
    p_types: ["biometric"],
    p_version: LEGAL_VERSION,
    p_language: opts.lang,
    p_sha: shaFor(text),
    p_source: "miniapp",
    p_categories: ["biometric"],
    p_ip: opts.ip,
    p_user_agent: opts.userAgent,
  });
  if (error) {
    console.error("[consent] biometric record failed:", error.message);
    return { ok: false };
  }
  return { ok: true };
}
