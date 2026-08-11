"use client";

/**
 * Форма отзыва о приложении (спека 2026-08-11-feedback-design.md).
 *
 * Оценка обязательна, текст и скриншот - нет. Кнопка неактивна, пока звезда не
 * нажата, и рядом стоит подсказка «Поставьте оценку»: неактивная кнопка без
 * объяснения заставляет человека гадать, что он сделал не так.
 *
 * После отправки показываем отдельный экран благодарности, а не молчаливый
 * возврат назад - человеку важно понять, что его услышали.
 *
 * Пределы (1000 символов, 5 МБ) продублированы здесь константами, а не взяты
 * из @/lib/feedback/store и @/lib/uploads/storage: те модули серверные
 * (import "server-only", supabaseAdmin) и в клиентский бандл не тянутся.
 * Настоящая проверка всё равно на сервере и в базе, здесь - только чтобы
 * человек узнал о пределе до отправки, а не после.
 */

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Headline } from "@/components/v2/Headline";
import { Button } from "@/components/v2/Button";

const MAX_BODY = 1000;
// Счётчик показываем только ближе к пределу: с первого символа он давит и
// превращает свободный рассказ в упражнение по укладке в лимит.
const COUNTER_FROM = 800;
const MAX_BYTES = 5 * 1024 * 1024;

// Карточка v2 - те же токены, что у соседних экранов мини-аппа
// (InviteNotVerifiedCard, VerificationPlashka): белый лист, hairline-борт,
// радиус карточки и мягкая тень. Отдельной константой, потому что на экране
// четыре таких блока и разъехаться они не должны.
const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--color-v2-border)",
  borderRadius: "var(--v2-radius-card)",
  boxShadow: "var(--v2-shadow-card)",
  padding: "22px 20px",
  fontFamily: "var(--font-v2-body)",
};

// Подпись блока внутри карточки - один стиль на все три блока.
const blockLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "14px",
  fontWeight: 700,
  color: "var(--color-v2-ink-200)",
  fontFamily: "var(--font-v2-body)",
};

export function V2FeedbackScreen({ locale }: { locale: string }) {
  const t = useTranslations("Feedback");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { shotFailed: boolean }>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    // Размер проверяем ДО отправки: молчаливый обрыв на десятой секунде
    // загрузки выглядит как поломка приложения, а не как слишком большой файл.
    if (f.size > MAX_BYTES) {
      setError(t("err_too_large"));
      e.target.value = "";
      return;
    }
    setError(null);
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  }

  function removeFile() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    if (!rating || busy) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("rating", String(rating));
      fd.append("body", body);
      fd.append("locale", locale);
      if (file) fd.append("file", file);
      const r = await fetch("/api/feedback", { method: "POST", body: fd });
      const j = (await r.json().catch(() => null)) as
        | { ok: true; screenshot: "saved" | "failed" | "none" }
        | { ok: false; error: string }
        | null;

      if (!j || !j.ok) {
        const code = j && !j.ok ? j.error : "";
        // Введённое НЕ стираем: заставлять человека набирать отзыв заново
        // из-за нашего сбоя - верный способ больше отзывов не получить.
        setError(
          code === "rate_limited"
            ? t("err_rate_limited")
            : code === "too_large"
              ? t("err_too_large")
              : code === "bad_type"
                ? t("err_bad_type")
                : t("err_generic"),
        );
        return;
      }
      setDone({ shotFailed: j.screenshot === "failed" });
    } catch {
      setError(t("err_generic"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="v2-rise" style={{ ...cardStyle, padding: "28px 22px", textAlign: "center" }}>
        <div
          aria-hidden="true"
          style={{
            fontSize: "40px",
            lineHeight: 1,
            marginBottom: "12px",
            color: "var(--color-v2-accent)",
          }}
        >
          ★
        </div>
        <Headline size="md" as="h2">
          {t("thanks_title")}
        </Headline>
        <p
          style={{
            marginTop: "10px",
            fontSize: "14px",
            lineHeight: 1.55,
            color: "var(--color-v2-ink-300)",
            fontFamily: "var(--font-v2-body)",
          }}
        >
          {t("thanks_body")}
        </p>
        {done.shotFailed && (
          <p
            style={{
              marginTop: "10px",
              fontSize: "13px",
              lineHeight: 1.5,
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-body)",
            }}
          >
            {t("shot_failed")}
          </p>
        )}
        <div style={{ marginTop: "20px" }}>
          <Link
            href="/v2/settings"
            style={{
              display: "inline-block",
              padding: "17px 24px",
              borderRadius: "var(--v2-radius-lg)",
              border: "1.5px solid var(--color-v2-ink-500)",
              background: "#ffffff",
              color: "var(--color-v2-ink-400)",
              textDecoration: "none",
              fontFamily: "var(--font-v2-body)",
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            {t("thanks_back")}
          </Link>
        </div>
      </div>
    );
  }

  const counterVisible = body.length >= COUNTER_FROM;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="v2-rise" style={cardStyle}>
        <p style={{ ...blockLabelStyle, marginBottom: "12px" }}>{t("rating_label")}</p>
        <div role="radiogroup" aria-label={t("rating_label")} style={{ display: "flex", gap: "6px" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={String(n)}
              onClick={() => setRating(n)}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "34px",
                lineHeight: 1.1,
                padding: "4px 0",
                color: n <= rating ? "var(--color-v2-accent)" : "var(--color-v2-ink-500)",
              }}
            >
              ★
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p
            style={{
              marginTop: "8px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-body)",
            }}
          >
            {t(`rating_${rating}`)}
          </p>
        )}
      </div>

      <div className="v2-rise" style={cardStyle}>
        <label htmlFor="fb-body" style={{ ...blockLabelStyle, marginBottom: "8px" }}>
          {t("body_label")}
        </label>
        <textarea
          id="fb-body"
          value={body}
          maxLength={MAX_BODY}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("body_placeholder")}
          rows={5}
          style={{
            // Те же значения, что у инпутов анкеты (inputBaseStyle в
            // AnketaFields): поле ввода на всех экранах должно выглядеть
            // одинаково. boxSizing обязателен - иначе padding с border
            // добавляются к 100% ширины и поле вылезает за борт карточки.
            width: "100%",
            boxSizing: "border-box",
            resize: "vertical",
            padding: "14px 16px",
            fontFamily: "var(--font-v2-body)",
            fontSize: "15px",
            lineHeight: "1.5",
            color: "var(--color-v2-ink-100)",
            background: "#ffffff",
            border: "1.5px solid var(--color-v2-ink-500)",
            borderRadius: "var(--v2-radius-md)",
            outline: "none",
          }}
        />
        {counterVisible && (
          <p
            aria-live="polite"
            style={{
              marginTop: "6px",
              textAlign: "right",
              fontSize: "11.5px",
              fontVariantNumeric: "tabular-nums",
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-body)",
            }}
          >
            {t("body_counter", { n: body.length, max: MAX_BODY })}
          </p>
        )}
      </div>

      <div className="v2-rise" style={cardStyle}>
        <p style={{ ...blockLabelStyle, marginBottom: "8px" }}>{t("shot_label")}</p>
        {preview ? (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- локальный blob: превью до отправки, next/image здесь не применим */}
            <img
              src={preview}
              alt=""
              style={{
                maxWidth: "100%",
                borderRadius: "var(--v2-radius-md)",
                display: "block",
              }}
            />
            <button
              type="button"
              onClick={removeFile}
              style={{
                marginTop: "8px",
                border: "none",
                background: "transparent",
                color: "var(--color-v2-ink-400)",
                fontFamily: "var(--font-v2-body)",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                padding: "6px 0",
              }}
            >
              {t("shot_remove")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              // Пунктир того же цвета, что у загрузки паспорта (UploadField):
              // это одна и та же вещь «приложить файл», и выглядеть она должна
              // одинаково. Радиус - карточный md, а не 20px как у UploadField:
              // там кнопка сама себе экран, здесь она лежит внутри карточки.
              width: "100%",
              padding: "14px",
              borderRadius: "var(--v2-radius-md)",
              border: "1.5px dashed #E0A9A3",
              background: "#fff",
              color: "var(--color-v2-ink-300)",
              fontFamily: "var(--font-v2-body)",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("shot_add")}
          </button>
        )}
        {/* heic в accept намеренно нет, хотя сервер его принимает: текст ошибки
            обещает JPG, PNG и WEBP, а iOS при таком accept сам перекодирует
            снимок в JPEG - человек этого даже не замечает. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={pickFile}
          style={{ display: "none" }}
        />
        <p
          style={{
            marginTop: "10px",
            fontSize: "12px",
            lineHeight: 1.5,
            color: "var(--color-v2-ink-400)",
            fontFamily: "var(--font-v2-body)",
          }}
        >
          {t("shot_note")}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            // Тот же вид ошибки, что в InviteScreen и ProfileSafetyActions:
            // розовая плашка с красной полосой слева, а не голый красный текст.
            padding: "10px 14px",
            background: "#FBE7E4",
            borderLeft: "3px solid var(--color-v2-danger)",
            borderRadius: "12px",
            fontSize: "13px",
            fontWeight: 600,
            lineHeight: "1.5",
            color: "#9A4B46",
            fontFamily: "var(--font-v2-body)",
          }}
        >
          {error}
        </div>
      )}

      <div>
        <Button onClick={submit} disabled={!rating || busy}>
          {busy ? t("sending") : t("submit")}
        </Button>
        {!rating && (
          <p
            style={{
              marginTop: "8px",
              textAlign: "center",
              fontSize: "13px",
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-body)",
            }}
          >
            {t("rating_hint")}
          </p>
        )}
      </div>
    </div>
  );
}
