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
