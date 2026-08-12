import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sha256Bytes } from "@/lib/identity/hashing";
import { detectImageType, extForType, type AllowedImage } from "./mime-check";

export const BUCKET_DOCUMENTS = "user-documents";
export const BUCKET_PHOTOS = "profile-photos";
// Скриншоты отзывов - ОТДЕЛЬНЫЙ приватный бакет, а не profile-photos: на
// скриншоте может оказаться чужая анкета (фото, имя, возраст) - персональные
// данные третьего лица, попавшие к нам без его ведома. Отдельный бакет значит,
// что ни один существующий запрос лент и профилей до них не дотянется даже по
// ошибке в пути.
// Константа заведена раньше самой загрузки намеренно: без неё обе дороги
// удаления аккаунта не могут снести файл, а осиротевший скриншот не находится
// уже ничем - указателя на него в базе не остаётся.
export const BUCKET_FEEDBACK = "feedback-screenshots";

const MAX_BYTES = 12 * 1024 * 1024; // 12 МБ

export type UploadResult =
  | { ok: true; path: string; type: AllowedImage; sha256: string }
  | { ok: false; error: "too_large" | "bad_type" | "upload_failed" };

/**
 * Загрузка изображения в приватный бакет документов.
 * Проверяет размер и реальный тип по magic-байтам.
 * Возвращает sha256 контента для дедупа identity (F-007).
 * @param kind 'passport' | 'selfie' — определяет имя файла.
 */
export async function uploadDocumentImage(
  userId: string,
  kind: "passport" | "selfie",
  file: ArrayBuffer,
): Promise<UploadResult> {
  if (file.byteLength > MAX_BYTES) return { ok: false, error: "too_large" };
  const bytes = new Uint8Array(file);
  const type = detectImageType(bytes);
  if (!type) return { ok: false, error: "bad_type" };

  const path = `${userId}/${kind}.${extForType(type)}`;
  const { error } = await supabaseAdmin()
    .storage.from(BUCKET_DOCUMENTS)
    .upload(path, bytes, { contentType: type, upsert: true });
  if (error) return { ok: false, error: "upload_failed" };
  return { ok: true, path, type, sha256: sha256Bytes(bytes) };
}

export type PhotoUploadResult =
  | { ok: true; path: string; url: string | null; type: AllowedImage }
  | { ok: false; error: "too_large" | "bad_type" | "upload_failed" };

// Фото профиля — ПРИВАТНЫЙ бакет: отдаём только через подписанные URL с коротким TTL.
// Так серверные гейты (published/approved/active/block) реально управляют доступом.
const PHOTO_TTL_SEC = 3600;

/** Подписанный URL одного фото (или null). */
export async function signedPhotoUrl(path: string, ttl = PHOTO_TTL_SEC): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin().storage.from(BUCKET_PHOTOS).createSignedUrl(path, ttl);
  return data?.signedUrl ?? null;
}

/** Подписанные URL пачкой: path → signedUrl (для лент/списков, один round-trip). */
export async function signedPhotoUrls(
  paths: (string | null | undefined)[],
  ttl = PHOTO_TTL_SEC,
): Promise<Record<string, string>> {
  const uniq = [...new Set(paths.filter((p): p is string => !!p))];
  if (!uniq.length) return {};
  const { data } = await supabaseAdmin().storage.from(BUCKET_PHOTOS).createSignedUrls(uniq, ttl);
  const out: Record<string, string> = {};
  for (const it of data ?? []) if (it.path && it.signedUrl) out[it.path] = it.signedUrl;
  return out;
}

/** Подписанные URL пачкой из приватного бакета ДОКУМЕНТОВ (аватар = одобренное
 * селфи лежит здесь, не в profile-photos). path → signedUrl, один round-trip. */
export async function signedDocumentUrls(
  paths: (string | null | undefined)[],
  ttl = 300,
): Promise<Record<string, string>> {
  const uniq = [...new Set(paths.filter((p): p is string => !!p))];
  if (!uniq.length) return {};
  const { data } = await supabaseAdmin()
    .storage.from(BUCKET_DOCUMENTS)
    .createSignedUrls(uniq, ttl);
  const out: Record<string, string> = {};
  for (const it of data ?? []) if (it.path && it.signedUrl) out[it.path] = it.signedUrl;
  return out;
}

/**
 * Загрузка фото профиля в приватный бакет. Возвращает подписанный URL для немедленного показа.
 * @param idx порядковый индекс фото (имя файла), чтобы хранить до 3 фото.
 */
export async function uploadProfilePhoto(
  userId: string,
  idx: number,
  file: ArrayBuffer,
): Promise<PhotoUploadResult> {
  if (file.byteLength > MAX_BYTES) return { ok: false, error: "too_large" };
  const bytes = new Uint8Array(file);
  const type = detectImageType(bytes);
  if (!type) return { ok: false, error: "bad_type" };

  const path = `${userId}/photo_${idx}_${Date.now()}.${extForType(type)}`;
  const { error } = await supabaseAdmin()
    .storage.from(BUCKET_PHOTOS)
    .upload(path, bytes, { contentType: type, upsert: true });
  if (error) return { ok: false, error: "upload_failed" };
  return { ok: true, path, url: await signedPhotoUrl(path), type };
}

// 5 МБ - предел из спеки. Меньше общего MAX_BYTES (12 МБ): скриншот экрана
// телефона столько не весит, а лишний запас - лишний способ занять диск.
export const FEEDBACK_MAX_BYTES = 5 * 1024 * 1024;

/** Загрузка скриншота к отзыву. Тип проверяем по magic-байтам, а не по имени. */
export async function uploadFeedbackScreenshot(
  userId: string,
  file: ArrayBuffer,
): Promise<UploadResult> {
  if (file.byteLength > FEEDBACK_MAX_BYTES) return { ok: false, error: "too_large" };
  const bytes = new Uint8Array(file);
  const type = detectImageType(bytes);
  if (!type) return { ok: false, error: "bad_type" };

  // Date.now() в имени - у одного человека несколько отзывов со скриншотами,
  // и второй не должен затирать первый.
  const path = `${userId}/${Date.now()}.${extForType(type)}`;
  const { error } = await supabaseAdmin()
    .storage.from(BUCKET_FEEDBACK)
    .upload(path, bytes, { contentType: type, upsert: false });
  if (error) return { ok: false, error: "upload_failed" };
  return { ok: true, path, type, sha256: sha256Bytes(bytes) };
}

/**
 * Снос одного скриншота - парная операция к загрузке.
 *
 * Нужна потому, что файл и запись об отзыве уезжают в разные места и не в одной
 * транзакции: файл кладётся ДО create_feedback (чтобы «не тот формат» человек
 * увидел ошибкой формы, а не после сохранения отзыва), а процедура может
 * отказать по суточному лимиту или упасть. Без этого вызова путь теряется в тот
 * же миг: указателя на файл в базе нет ни секунды, и снести его потом нечем.
 */
export async function removeFeedbackScreenshot(path: string): Promise<boolean> {
  if (!path) return false;
  const { error } = await supabaseAdmin().storage.from(BUCKET_FEEDBACK).remove([path]);
  // Адаптер хранилища не бросает, а возвращает {error} - без явной проверки
  // неудачная чистка засчиталась бы успехом и файл остался бы молча.
  if (error) {
    console.error("[feedback] снос осиротевшего скриншота не удался:", path, error.message);
    return false;
  }
  return true;
}

/**
 * Снос всех скриншотов человека - обходом его папки в бакете, а НЕ по ссылкам
 * из базы. Так же устроена чистка документов при удалении аккаунта.
 *
 * Обходом папки, потому что в базе видны не все файлы. Загрузка не
 * транзакционна с записью отзыва, поэтому файл, чья запись не создалась
 * (суточный лимит, дедуп двойного тапа, обрыв запроса), в
 * feedback.screenshot_path не попадает никогда. Список по базе оставил бы такой
 * файл на диске навсегда - а на скриншоте по условиям спеки может оказаться
 * чужая анкета, которая обязана уйти вместе с аккаунтом.
 *
 * Обход безопасен ровно потому, что uploadFeedbackScreenshot кладёт файлы
 * только в `<userId>/`: чужого в этой папке не окажется.
 *
 * Возвращает число снесённых файлов - вызывающему это нужно только для лога:
 * обе дороги удаления идут дальше в любом случае, строки в базе уже не вернуть.
 */
export async function removeUserFeedbackScreenshots(userId: string): Promise<number> {
  const bucket = supabaseAdmin().storage.from(BUCKET_FEEDBACK);
  const { data, error } = await bucket.list(userId);
  if (error) {
    console.error("[feedback] обход папки скриншотов не удался:", userId, error.message);
    return 0;
  }
  const paths = (data ?? []).map((f) => `${userId}/${f.name}`);
  if (!paths.length) return 0;
  const { error: rmErr } = await bucket.remove(paths);
  if (rmErr) {
    console.error("[feedback] снос скриншотов не удался:", userId, rmErr.message);
    return 0;
  }
  return paths.length;
}

/** Подписанные ссылки на скриншоты пачкой - для списка в админке. */
export async function signedFeedbackUrls(
  paths: (string | null | undefined)[],
  ttl = 300,
): Promise<Record<string, string>> {
  const uniq = [...new Set(paths.filter((p): p is string => !!p))];
  if (!uniq.length) return {};
  const { data } = await supabaseAdmin().storage.from(BUCKET_FEEDBACK).createSignedUrls(uniq, ttl);
  const out: Record<string, string> = {};
  for (const it of data ?? []) if (it.path && it.signedUrl) out[it.path] = it.signedUrl;
  return out;
}
