"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { uploadErrorKey } from "@/lib/uploads/error-copy";

/**
 * V2 UploadField — file picker для паспорта/селфи в editorial-стилe.
 *
 * capture НЕ задан → нативный пикер (галерея / файлы / камера — выбор юзера).
 * capture="user" → фронт-камера (селфи, liveness — нужен живой снимок).
 * Документ загружаем БЕЗ capture — чтобы можно было выбрать из галереи/файлов.
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
  capture?: "user" | "environment";
};



export function UploadField({
  endpoint,
  uploadLabel,
  submitLabel,
  capture,
}: Props) {
  const t = useTranslations('Upload');
  const tButtons = useTranslations('Buttons');
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
        className="v2-rise"
        style={{
          width: "100%",
          padding: "36px 24px",
          background: "#fff",
          border: "1.5px dashed #E0A9A3",
          borderRadius: "20px",
          boxShadow: "var(--v2-shadow-card)",
          fontFamily: "var(--font-v2-body)",
          fontSize: "15px",
          fontWeight: 600,
          color: "var(--color-v2-ink-300)",
          cursor: "pointer",
          textAlign: "center",
          lineHeight: "1.5",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "54px",
            height: "54px",
            margin: "0 auto 14px",
            borderRadius: "999px",
            background:
              "linear-gradient(135deg, var(--color-v2-paper-2), #F7D9D0)",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-v2-accent)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 8.5h3.2l1.8-2.7h6l1.8 2.7H20a0.5 0.5 0 0 1 .5.5v9.5a0.5 0.5 0 0 1-.5.5H4a0.5 0.5 0 0 1-.5-.5V9a0.5 0.5 0 0 1 .5-.5Z" />
            <circle cx="12" cy="13.5" r="3.2" />
          </svg>
        </span>
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
            background: "#FBE7E4",
            borderLeft: "3px solid var(--color-v2-danger)",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#9A4B46",
            fontFamily: "var(--font-v2-body)",
            lineHeight: "1.5",
          }}
        >
          {t(`errors.${uploadErrorKey(errorCode)}`)}
        </div>
      ) : null}

      <div style={{ marginTop: "20px" }}>
        <Button onClick={submit} disabled={!file || pending} variant="primary">
          {pending ? tButtons('sending.send') : (submitLabel || tButtons('send'))}
        </Button>
      </div>
    </div>
  );
}
