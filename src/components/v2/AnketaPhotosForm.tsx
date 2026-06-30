"use client";

import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";

/**
 * V2 Anketa Photos (Blueprint §3.3 B5).
 *
 * Загружаем 1-3 фото. Первое всегда main. Editorial-сетка: квадратные
 * слоты с тонкой границей, без яркого badge — просто текст «Основная».
 *
 * API: /api/onboarding/profile/photo (POST upload), /api/onboarding/profile/photo/[id] (DELETE),
 * /api/onboarding/profile/photos-done (POST publish).
 */

type Photo = { id: string; url: string; is_main: boolean };

export function V2AnketaPhotosForm() {
  const t = useTranslations('Anketa');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ERR_COPY: Record<string, string> = {
    max_photos: t('photos_err_max'),
    bad_type: t('photos_err_bad_type'),
    too_large: t('photos_err_too_large'),
    photos_need_one: t('photos_err_need_one'),
    failed: t('photos_err_failed'),
  };



  async function add(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/onboarding/profile/photo", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok: boolean;
        photo?: Photo;
        error?: string;
      };
      if (data.ok && data.photo) {
        setPhotos((p) => [...p, data.photo as Photo]);
        return;
      }
      setErr(data.error ?? "failed");
    } catch {
      setErr("failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/onboarding/profile/photo/${id}`, { method: "DELETE" });
    setPhotos((p) => p.filter((x) => x.id !== id));
  }

  async function done() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/profile/photos-done", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok: boolean;
        next?: string;
        error?: string;
      };
      if (data.ok && data.next) {
        router.replace(data.next);
        return;
      }
      setErr(data.error ?? "photos_need_one");
    } catch {
      setErr("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        {photos.map((p, i) => (
          <div
            key={p.id}
            style={{
              position: "relative",
              aspectRatio: "3 / 4",
              border: "1px solid var(--color-v2-ink-500)",
              borderRadius: "var(--v2-radius-md)",
              overflow: "hidden",
              background: "var(--color-v2-ink-600)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            {i === 0 ? (
              <div
                style={{
                  position: "absolute",
                  top: "6px",
                  left: "6px",
                  padding: "3px 8px",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  background: "var(--color-v2-ink-100)",
                  color: "var(--color-v2-paper)",
                  fontFamily: "var(--font-v2-body)",
                  borderRadius: "999px",
                }}
              >
                {t('photos_main_badge')}
              </div>
            ) : null}
            <button
              onClick={() => remove(p.id)}
              type="button"
              style={{
                position: "absolute",
                top: "6px",
                right: "6px",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: "rgba(10, 9, 8, 0.6)",
                color: "var(--color-v2-paper)",
                fontSize: "13px",
                lineHeight: "1",
                border: "none",
                cursor: "pointer",
              }}
              aria-label={t('photos_delete_button')}
            >
              ×
            </button>
          </div>
        ))}
        {photos.length < 3 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            style={{
              aspectRatio: "3 / 4",
              border: "1px dashed var(--color-v2-ink-500)",
              borderRadius: "var(--v2-radius-md)",
              background: "transparent",
              fontFamily: "var(--font-v2-body)",
              fontSize: "13px",
              color: "var(--color-v2-ink-400)",
              cursor: "pointer",
            }}
          >
            + {t('photos_add_button')}
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void add(f);
          e.target.value = "";
        }}
      />

      <div
        style={{
          fontSize: "12px",
          color: "var(--color-v2-ink-400)",
          fontFamily: "var(--font-v2-body)",
          lineHeight: "1.5",
          marginBottom: "20px",
        }}
      >
        {t('photos_instructions')}
      </div>

      {err ? (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(180, 50, 50, 0.08)",
            border: "1px solid rgba(180, 50, 50, 0.3)",
            borderRadius: "var(--v2-radius-md)",
            fontSize: "13px",
            color: "var(--color-v2-ink-200)",
            fontFamily: "var(--font-v2-body)",
            marginBottom: "16px",
          }}
        >
          {ERR_COPY[err] ?? ERR_COPY.failed}
        </div>
      ) : null}

      <Button onClick={done} disabled={busy || photos.length === 0} variant="primary">
        {busy ? t('photos_loading') : t('photos_continue')}
      </Button>
    </div>
  );
}
