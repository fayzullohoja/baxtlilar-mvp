import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Bug #16 from loop pass 3 (2026-06-30): document_sha_blacklist append-only
 * tombstone-таблица заполнялась `admin_blocking_reject` и `erase_user`, но
 * никогда не ПРОВЕРЯЛАСЬ на upload-эндпоинтах. Banned юзер мог re-uploadить
 * те же паспорт/селфи под новым telegram_id и обойти блок.
 *
 * Helper проверяет SHA256 против blacklist. Возвращает true если документ
 * blacklisted (нужно отказать в upload). DB ошибка → fail-open (мы не
 * хотим блокировать всех юзеров на сбое БД), но логируем.
 */
export async function isDocumentBlacklisted(
  sha256: string,
  kind: "passport" | "selfie",
): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("document_sha_blacklist")
    .select("id")
    .eq("sha256", sha256)
    .eq("kind", kind)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[blacklist] check failed:", error.message);
    return false;
  }
  return !!data;
}
