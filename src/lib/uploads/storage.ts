import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { detectImageType, extForType, type AllowedImage } from "./mime-check";

export const BUCKET_DOCUMENTS = "user-documents";
export const BUCKET_PHOTOS = "profile-photos";

const MAX_BYTES = 12 * 1024 * 1024; // 12 МБ

export type UploadResult =
  | { ok: true; path: string; type: AllowedImage }
  | { ok: false; error: "too_large" | "bad_type" | "upload_failed" };

/**
 * Загрузка изображения в приватный бакет документов.
 * Проверяет размер и реальный тип по magic-байтам.
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
  return { ok: true, path, type };
}

export type PhotoUploadResult =
  | { ok: true; path: string; publicUrl: string; type: AllowedImage }
  | { ok: false; error: "too_large" | "bad_type" | "upload_failed" };

/**
 * Загрузка фото профиля в ПУБЛИЧНЫЙ бакет (показывается другим — после одобрения, S5).
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
  const sb = supabaseAdmin();
  const { error } = await sb.storage
    .from(BUCKET_PHOTOS)
    .upload(path, bytes, { contentType: type, upsert: true });
  if (error) return { ok: false, error: "upload_failed" };
  const { data } = sb.storage.from(BUCKET_PHOTOS).getPublicUrl(path);
  return { ok: true, path, publicUrl: data.publicUrl, type };
}
