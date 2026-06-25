"use client";

import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";

/**
 * V2 UploadField — file picker для паспорта/селфи в editorial-стилe.
 *
 * Camera-first для mobile (capture="environment" → back camera, "user" → front).
 * После выбора файла кнопка превращается в Submit. Преview не строим
 * (минимализм + privacy — не светим фото в DOM до отправки).
 *
 * Endpoint должен принимать FormData с полем "file" и возвращать
 * { ok, next, error }. На success → router.replace(next) (next-intl wrapped).
 */

type Props = {
  endpoint: string;
  uploadLabel: string;
  submitLabel?: string;
  capture: "user" | "environment";
};

const ERROR_COPY: Record<string, string> = {
  bad_type: "Поддерживаются JPG, PNG, WebP, HEIC. Попробуй ещё раз.",
  too_large: "Файл слишком большой. Уменьши размер или сними иначе.",
  duplicate_identity: "Этот документ уже зарегистрирован на другую анкету.",
  duplicate_passport: "Этот паспорт уже зарегистрирован.",
  duplicate_selfie: "Это селфи уже встречалось.",
  failed: "Не получилось загрузить. Проверь связь и попробуй снова.",
  save_failed: "Не получилось сохранить. Попробуй ещё раз.",
};

export function UploadField({
  endpoint,
  uploadLabel,
  submitLabel = "Отправить",
  capture,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function submit() {
    if (!file || pending) return;
    setPending(true);
    setErrorCode(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        ok: boolean;
        next?: string;
        error?: string;
      };
      if (data.ok && data.next) {
        router.replace(data.next);
        return;
      }
      setErrorCode(data.error ?? "failed");
    } catch {
      setErrorCode("failed");
    } finally {
      setPending(false);
    }
  }

  function pick() {
    inputRef.current?.click();
  }

  return (
    <div>
      <button
        type="button"
        onClick={pick}
        style={{
          width: "100%",
          padding: "48px 24px",
          background: "transparent",
          border: "1px dashed var(--color-v2-ink-500)",
          borderRadius: "var(--v2-radius-lg)",
          fontFamily: "var(--font-v2-body)",
          fontSize: "15px",
          color: "var(--color-v2-ink-300)",
          cursor: "pointer",
          textAlign: "center",
          lineHeight: "1.5",
        }}
      >
        {file ? (
          <span style={{ color: "var(--color-v2-ink-200)" }}>
            <strong>{file.name}</strong>
            <br />
            <span style={{ fontSize: "12px", color: "var(--color-v2-ink-400)" }}>
              Нажми чтобы заменить
            </span>
          </span>
        ) : (
          uploadLabel
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture={capture}
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          setErrorCode(null);
        }}
      />

      {errorCode ? (
        <div
          style={{
            marginTop: "16px",
            padding: "12px 14px",
            background: "rgba(180, 50, 50, 0.08)",
            border: "1px solid rgba(180, 50, 50, 0.3)",
            borderRadius: "var(--v2-radius-md)",
            fontSize: "14px",
            color: "var(--color-v2-ink-200)",
            fontFamily: "var(--font-v2-body)",
            lineHeight: "1.5",
          }}
        >
          {ERROR_COPY[errorCode] ?? ERROR_COPY.failed}
        </div>
      ) : null}

      <div style={{ marginTop: "20px" }}>
        <Button onClick={submit} disabled={!file || pending} variant="primary">
          {pending ? "Отправляю…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
