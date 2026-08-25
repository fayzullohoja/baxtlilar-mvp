import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * Native файловое хранилище (Railway Volume) взамен Supabase Storage.
 * Приватность (инвариант 1): файлы НЕ публичны — отдаются только через
 * app-роут /api/storage/o/... по короткоживущей HMAC-подписи (как signed URL).
 *
 * Совместимо по форме с supabase-js storage: from(bucket).upload/remove/list/
 * createSignedUrl/createSignedUrls.
 */

export type StorageError = { message: string };

function root(): string {
  return env().STORAGE_DIR;
}

// путь без traversal: внутри bucket-каталога
function resolveSafe(bucket: string, rel: string): string {
  if (!/^[a-z0-9-]+$/i.test(bucket)) throw new Error(`bad bucket: ${bucket}`);
  const base = path.resolve(root(), bucket);
  const full = path.resolve(base, rel);
  if (full !== base && !full.startsWith(base + path.sep)) throw new Error("path traversal");
  return full;
}

function sigFor(bucket: string, objectPath: string, exp: number): string {
  return crypto
    .createHmac("sha256", env().SESSION_SECRET)
    .update(`storage:v1:${bucket}/${objectPath}:${exp}`)
    .digest("base64url");
}

/**
 * Момент истечения, округлённый до сетки — чтобы ссылка на один и тот же файл
 * не менялась при каждом рендере.
 *
 * Зачем. Раньше было `exp = now + ttl`, то есть при каждой отрисовке страницы
 * рождался новый exp, новая подпись и новый URL. Для браузера URL — это ключ
 * кеша, поэтому заголовок `Cache-Control` на отдаче не срабатывал НИ РАЗУ:
 * каждый заход в админку заново тянул все картинки целиком. На списке клиентов
 * это десятки оригиналов с телефонов по несколько мегабайт — при каждом
 * открытии страницы.
 *
 * Теперь exp привязан к сетке шага `step`: все рендеры внутри одного окна дают
 * побайтово одинаковый URL, и кеш работает. Остаток жизни ссылки при этом не
 * меньше `ttl - step` (для фото это 45 минут из часа), так что она не успевает
 * протухнуть у человека под руками.
 *
 * Безопасность не меняется: подпись по-прежнему HMAC по (bucket, path, exp), а
 * срок по-прежнему проверяется. Округление лишь делает URL повторяемым внутри
 * окна — угадать его без ключа всё так же нельзя.
 */
export function stableExp(ttlSec: number, nowMs: number = Date.now()): number {
  const now = Math.floor(nowMs / 1000);
  // Шаг - четверть срока. Пол именно 1, а НЕ 60: при поле в 60 секунд любой
  // ttl <= 60 давал бы step >= ttl, множитель ниже схлопывался бы в единицу, и
  // ссылка на хвосте окна выдавалась бы с остатком жизни в одну секунду. В
  // боевом коде таких сроков сейчас нет (только 300, 600 и 3600), но запас
  // в три четверти ttl должен держаться при любом значении, а не при удачном.
  const step = Math.max(1, Math.floor(ttlSec / 4));
  // Начало текущего окна + столько шагов, чтобы покрыть ttl. Внутри окна
  // значение постоянное — это и даёт одинаковый URL.
  return (Math.floor(now / step) + Math.ceil(ttlSec / step)) * step;
}

/** Проверка подписи + срока (для serving-роута). */
export function verifyStorageSig(bucket: string, objectPath: string, exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = sigFor(bucket, objectPath, exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  // HEIC/HEIF принимаются на загрузке (accept + extForType) — раздаём с
  // корректным типом, а не application/octet-stream (иначе браузер скачивает).
  ".heic": "image/heic",
  ".heif": "image/heif",
};
export function mimeForPath(p: string): string {
  return MIME[path.extname(p).toLowerCase()] ?? "application/octet-stream";
}

/** Абсолютный путь объекта на диске (для serving-роута). */
export function objectFsPath(bucket: string, objectPath: string): string {
  return resolveSafe(bucket, objectPath);
}

type SignedUrl = { signedUrl: string };

function bucketApi(bucket: string) {
  return {
    async upload(
      objectPath: string,
      body: Uint8Array | Buffer,
      opts?: { contentType?: string; upsert?: boolean },
    ): Promise<{ data: { path: string } | null; error: StorageError | null }> {
      try {
        const full = resolveSafe(bucket, objectPath);
        if (!opts?.upsert) {
          const exists = await fs.stat(full).then(() => true).catch(() => false);
          if (exists) return { data: null, error: { message: "already exists" } };
        }
        await fs.mkdir(path.dirname(full), { recursive: true });
        await fs.writeFile(full, body);
        return { data: { path: objectPath }, error: null };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
      }
    },

    async remove(paths: string[]): Promise<{ data: unknown; error: StorageError | null }> {
      try {
        await Promise.all(
          paths.map((p) => fs.rm(resolveSafe(bucket, p), { force: true }).catch(() => {})),
        );
        return { data: paths, error: null };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
      }
    },

    async list(prefix = ""): Promise<{ data: { name: string }[] | null; error: StorageError | null }> {
      try {
        const dir = resolveSafe(bucket, prefix);
        const names = await fs.readdir(dir).catch(() => [] as string[]);
        return { data: names.map((name) => ({ name })), error: null };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
      }
    },

    async createSignedUrl(
      objectPath: string,
      ttlSec: number,
    ): Promise<{ data: SignedUrl | null; error: StorageError | null }> {
      const exp = stableExp(ttlSec);
      const sig = sigFor(bucket, objectPath, exp);
      const url = `/api/storage/o/${bucket}/${objectPath}?exp=${exp}&sig=${sig}`;
      return { data: { signedUrl: url }, error: null };
    },

    async createSignedUrls(
      paths: string[],
      ttlSec: number,
    ): Promise<{
      data: { path: string; signedUrl: string; error: string | null }[] | null;
      error: StorageError | null;
    }> {
      const exp = stableExp(ttlSec);
      const data = paths.map((objectPath) => ({
        path: objectPath,
        signedUrl: `/api/storage/o/${bucket}/${objectPath}?exp=${exp}&sig=${sigFor(bucket, objectPath, exp)}`,
        error: null,
      }));
      return { data, error: null };
    },
  };
}

export function createStorage() {
  return { from: bucketApi };
}

export type StorageClient = ReturnType<typeof createStorage>;
