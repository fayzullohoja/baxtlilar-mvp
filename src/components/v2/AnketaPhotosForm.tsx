"use client";

import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";

/**
 * V2 Anketa Photos (Blueprint §3.3 B5 · ревью оунера Экран 13).
 *
 * Три типизированных слота:
 *   • portrait  — обязателен, главное фото (видно ДО взаимного интереса)
 *   • full_body — опционально, видно pre-mutual
 *   • family    — опционально, ЧУВСТВИТЕЛЬНОЕ: показывается только post-mutual
 *                 (исключено из get_recommendations, миграция 20260711020000).
 *                 Требует подтверждения согласия изображённых лиц.
 *
 * API: /api/onboarding/profile/photo (POST upload, form-field photo_type),
 * /api/onboarding/profile/photo/[id] (DELETE), /api/onboarding/profile/photos-done (POST).
 */

type PhotoType = "portrait" | "full_body" | "family";
const SLOTS: PhotoType[] = ["portrait", "full_body", "family"];

export type InitialPhoto = {
  id: string;
  url: string;
  photo_type: string;
  is_main: boolean;
};

type Photo = { id: string; url: string; photo_type: PhotoType; is_main: boolean };

export function V2AnketaPhotosForm({ initial = [] }: { initial?: InitialPhoto[] }) {
  const t = useTranslations("Anketa");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  // Тип слота, для которого открыт файловый диалог.
  const pendingType = useRef<PhotoType>("portrait");
  const [photos, setPhotos] = useState<Photo[]>(
    initial
      .filter((p) => SLOTS.includes(p.photo_type as PhotoType))
      .map((p) => ({
        id: p.id,
        url: p.url,
        photo_type: p.photo_type as PhotoType,
        is_main: p.is_main,
      })),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ERR_COPY: Record<string, string> = {
    max_photos: t("photos_err_max"),
    bad_type: t("photos_err_bad_type"),
    type_exists: t("photos_err_type_exists"),
    too_large: t("photos_err_too_large"),
    photos_need_one: t("photos_err_need_portrait"),
    no_photo: t("photos_err_need_portrait"),
    failed: t("photos_err_failed"),
  };

  const byType = (ty: PhotoType) => photos.find((p) => p.photo_type === ty);
  const hasPortrait = !!byType("portrait");

  function pick(ty: PhotoType) {
    pendingType.current = ty;
    inputRef.current?.click();
  }

  async function add(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("photo_type", pendingType.current);
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
    if (!hasPortrait) {
      setErr("no_photo");
      return;
    }
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
      setErr(data.error ?? "no_photo");
    } catch {
      setErr("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "grid", gap: "14px", marginBottom: "18px" }}>
        {SLOTS.map((ty) => {
          const photo = byType(ty);
          const required = ty === "portrait";
          return (
            <div key={ty}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--color-v2-ink-200)",
                    fontFamily: "var(--font-v2-body)",
                  }}
                >
                  {t(`photos_slot_${ty}_label`)}
                  {required ? (
                    <span style={{ color: "var(--color-v2-danger)" }}> *</span>
                  ) : (
                    <span
                      style={{
                        color: "var(--color-v2-ink-400)",
                        fontWeight: 500,
                      }}
                    >
                      {" "}
                      · {t("optionalHint")}
                    </span>
                  )}
                </span>
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "stretch" }}>
                {/* Слот-превью / кнопка загрузки */}
                {photo ? (
                  <div
                    style={{
                      position: "relative",
                      width: "96px",
                      flexShrink: 0,
                      aspectRatio: "3 / 4",
                      border: "1px solid var(--color-v2-ink-500)",
                      borderRadius: "var(--v2-radius-md)",
                      overflow: "hidden",
                      background: "var(--color-v2-paper-3)",
                      boxShadow: "var(--v2-shadow-card)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                    <button
                      onClick={() => remove(photo.id)}
                      type="button"
                      style={{
                        position: "absolute",
                        top: "6px",
                        right: "6px",
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "rgba(42, 26, 46, 0.6)",
                        color: "#FFF7F0",
                        fontSize: "13px",
                        lineHeight: "1",
                        border: "none",
                        cursor: "pointer",
                      }}
                      aria-label={t("photos_delete_button")}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => pick(ty)}
                    disabled={busy}
                    style={{
                      width: "96px",
                      flexShrink: 0,
                      aspectRatio: "3 / 4",
                      border: "1.5px dashed var(--color-v2-ink-500)",
                      borderRadius: "var(--v2-radius-md)",
                      background: "#ffffff",
                      fontFamily: "var(--font-v2-body)",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--color-v2-ink-400)",
                      cursor: "pointer",
                    }}
                  >
                    + {t("photos_add_button")}
                  </button>
                )}

                {/* Хинт под тип */}
                <div
                  style={{
                    fontSize: "12px",
                    lineHeight: "1.5",
                    color: "var(--color-v2-ink-400)",
                    fontFamily: "var(--font-v2-body)",
                    alignSelf: "center",
                  }}
                >
                  {t(`photos_slot_${ty}_hint`)}
                  {ty === "family" ? (
                    <div
                      style={{
                        marginTop: "6px",
                        color: "var(--color-v2-chip-teal-ink)",
                        fontWeight: 600,
                      }}
                    >
                      {t("photos_family_consent")}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
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
        {t("photos_instructions")}
      </div>

      {err ? (
        <div
          style={{
            padding: "10px 14px",
            background: "#FBE7E4",
            borderLeft: "3px solid var(--color-v2-danger)",
            borderRadius: "12px",
            fontSize: "13px",
            color: "#9A4B46",
            fontFamily: "var(--font-v2-body)",
            marginBottom: "16px",
          }}
        >
          {ERR_COPY[err] ?? ERR_COPY.failed}
        </div>
      ) : null}

      <Button onClick={done} disabled={busy || !hasPortrait} variant="primary">
        {busy ? t("photos_loading") : t("photos_continue")}
      </Button>
    </div>
  );
}
