"use client";

/**
 * Форма отзыва о приложении (спека 2026-08-11-feedback-design.md).
 *
 * Оценка обязательна, текст и скриншот - нет. Кнопка неактивна, пока звезда не
 * нажата, и рядом стоит подсказка «Поставьте оценку»: неактивная кнопка без
 * объяснения заставляет человека гадать, что он сделал не так.
 *
 * После отправки показываем отдельный экран благодарности, а не молчаливый
 * возврат назад - человеку важно понять, что его услышали. Форму при этом
 * размонтируем намеренно: живая форма поверх уже сохранённой записи - прямая
 * дорога к дублю, как только истечёт минутное окно дедупа в create_feedback.
 * Единственное исключение - неудавшийся скриншот: под него на экране
 * благодарности живёт кнопка повтора, см. SHOT_RETRY_MS ниже.
 *
 * Пределы (1000 символов, 5 МБ) продублированы здесь константами, а не взяты
 * из @/lib/feedback/store и @/lib/uploads/storage: те модули серверные
 * (import "server-only", supabaseAdmin) и в клиентский бандл не тянутся.
 * Настоящая проверка всё равно на сервере и в базе, здесь - только чтобы
 * человек узнал о пределе до отправки, а не после.
 */

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Headline } from "@/components/v2/Headline";
import { Button } from "@/components/v2/Button";

const MAX_BODY = 1000;
// Счётчик показываем только ближе к пределу: с первого символа он давит и
// превращает свободный рассказ в упражнение по укладке в лимит.
const COUNTER_FROM = 800;
const MAX_BYTES = 5 * 1024 * 1024;

// Типы, которые сервер ТОЧНО примет: detectImageType (src/lib/uploads/mime-check.ts)
// узнаёт ровно эти по магическим байтам. Список шире атрибута accept ниже, и это
// не описка: accept сужен до трёх форматов, чтобы iOS сам перекодировал HEIC в
// JPEG, а здесь мы имеем право отбить только заведомо негодное. Отказать в файле,
// который сервер бы взял, - худшая ошибка, чем лишняя загрузка.
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Сколько держим кнопку «приложить скриншот ещё раз». Окно дедупа в
// create_feedback - минута от created_at записи, а этот отсчёт стартует позже:
// ответ уже проделал дорогу обратно. Поэтому 45 с, а не 60: нажатие на 59-й
// секунде дедуп уже не поймает, и вместо картинки к первой записи человек
// создаст ВТОРУЮ запись об одной поломке и сожжёт второй слот из трёх суточных.
const SHOT_RETRY_MS = 45_000;

// Код ошибки от сервера -> ключ текста. Таблицей, а не лесенкой из «?:»:
// кодов пять, и лесенка на пятом уровне вложенности уже не читается.
//
// feedback_limit и rate_limited - РАЗНЫЕ вещи, и путать их нельзя. Первый
// отдаёт роут отзыва на исчерпанном суточном лимите (три отзыва за скользящие
// сутки). Второй приходит от глобального лимитера в src/proxy.ts, который
// отбивает запрос ещё ДО роута: ведро IP_API общее на весь IP, а за одним
// CGNAT-адресом мобильного оператора сидят десятки людей. Пока оба кода
// назывались одинаково, форма встречала первого же соседа по IP словами «Вы уже
// оставили три отзыва за сутки» - при том что отзывов у него ноль, а повтор
// через секунду прошёл бы.
const ERROR_COPY: Record<string, string> = {
  feedback_limit: "err_rate_limited",
  rate_limited: "err_too_fast",
  too_large: "err_too_large",
  bad_type: "err_bad_type",
};

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

/**
 * Звезда оценки - SVG-контур в стиле line-иконок нижней навигации, а не глиф ★.
 *
 * Глиф красили токеном --color-v2-ink-500. Это цвет hairline-борта (#f0ddd0):
 * на белой карточке он даёт контраст 1.3:1 при требуемых WCAG 1.4.11 3:1, и
 * единственный обязательный элемент экрана человек просто не видит - под
 * заголовком «Как Вам приложение?» у него пустая полоса. Незажжённая звезда
 * теперь контур ink-400 (3.99:1), зажжённая - заливка accent.
 */
function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? "var(--color-v2-accent)" : "none"}
      stroke={filled ? "var(--color-v2-accent)" : "var(--color-v2-ink-400)"}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2.6 15 8.7 21.7 9.7 16.9 14.4 18 21 12 17.9 6 21 7.1 14.4 2.3 9.7 9 8.7" />
    </svg>
  );
}

/** Плашка ошибки - вид тот же, что в InviteScreen и ProfileSafetyActions. */
function ErrorBanner({ text }: { text: string }) {
  return (
    <div
      role="alert"
      style={{
        // Розовая плашка с красной полосой слева, а не голый красный текст.
        padding: "10px 14px",
        background: "#FBE7E4",
        borderLeft: "3px solid var(--color-v2-danger)",
        borderRadius: "12px",
        fontSize: "13px",
        fontWeight: 600,
        lineHeight: "1.5",
        color: "#9A4B46",
        fontFamily: "var(--font-v2-body)",
        // Явно слева: на экране благодарности родитель центрирует текст, а
        // ошибка в две строки по центру читается как украшение, а не как сбой.
        textAlign: "left",
      }}
    >
      {text}
    </div>
  );
}

export function V2FeedbackScreen({ locale }: { locale: string }) {
  const t = useTranslations("Feedback");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { shotFailed: boolean }>(null);
  const [shotRetryOpen, setShotRetryOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLButtonElement>(null);
  const thanksRef = useRef<HTMLDivElement>(null);

  // Форма исчезает целиком, и кнопка «Отправить», на которой стоял курсор
  // скринридера, размонтируется - браузер сбрасывает фокус на body, и человек
  // с VoiceOver не слышит ни слова о том, ушёл отзыв или нет. Переводим фокус
  // на заголовок карточки: он и объявляет «Спасибо», и даёт точку, от которой
  // продолжается свайп. Живой области (role="status") здесь нарочно нет - она
  // добавляется в DOM уже с текстом, такое объявляют не все скринридеры, а
  // вместе с фокусом дала бы двойное чтение.
  useEffect(() => {
    if (done) thanksRef.current?.focus();
  }, [done]);

  // Окно повтора закрываем сами - см. SHOT_RETRY_MS. Эффект стартует один раз,
  // на переходе флага в true: повторный setShotRetryOpen(true) тем же значением
  // React проглатывает, и отсчёт остаётся привязан к ПЕРВОМУ ответу, то есть к
  // моменту создания записи, а не к последней неудачной попытке.
  useEffect(() => {
    if (!shotRetryOpen) return;
    const id = setTimeout(() => setShotRetryOpen(false), SHOT_RETRY_MS);
    return () => clearTimeout(id);
  }, [shotRetryOpen]);

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
    // Формат - там же и по той же причине. accept в системном выборщике только
    // подсказка: на Android человек переключается на «все файлы» и берёт .gif,
    // и без этой проверки 4 МБ уезжают на сервер по мобильному интернету, чтобы
    // вернуться ответом «не тот формат». Отбиваем ТОЛЬКО заведомо картинку не
    // из списка: пустой или неизвестный тип (файловые менеджеры отдают
    // application/octet-stream даже на нормальный PNG) отправляем на сервер -
    // там магические байты, они надёжнее строки от пикера.
    if (f.type.startsWith("image/") && !ACCEPTED_TYPES.includes(f.type)) {
      setError(t("err_bad_type"));
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
    // Кнопка «Убрать» сейчас исчезнет вместе с фокусом на ней. Возвращаем фокус
    // туда, откуда человек пришёл, - на кнопку выбора файла.
    pickerRef.current?.focus();
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
        setError(t(ERROR_COPY[code] ?? "err_generic"));
        return;
      }
      // Отзыв сохранён, а картинка не доехала (диск, права). Открываем окно
      // повтора: процедура create_feedback написана ровно под этот случай -
      // в ветке дедупа она ПРИКРЕПЛЯЕТ принесённый скриншот к найденной записи,
      // и повтор в пределах минуты добавляет картинку к тому же отзыву, а не
      // плодит второй.
      if (j.screenshot === "failed") setShotRetryOpen(true);
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
        <div aria-hidden="true" style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
          <Star filled />
        </div>
        {/* tabIndex={-1} - цель программного фокуса, а не элемент управления,
            поэтому рамку фокуса не рисуем: нажать тут нечего. */}
        <div ref={thanksRef} tabIndex={-1} style={{ outline: "none" }}>
          <Headline size="md" as="h2">
            {t("thanks_title")}
          </Headline>
        </div>
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
        {/* Ошибка неудавшегося повтора: без неё нажатие на кнопку ниже выглядит
            как «ничего не произошло». */}
        {error && (
          <div style={{ marginTop: "12px" }}>
            <ErrorBanner text={error} />
          </div>
        )}
        {done.shotFailed && shotRetryOpen && (
          <div style={{ marginTop: "16px" }}>
            <Button onClick={submit} variant="secondary" disabled={busy}>
              {busy ? t("sending") : t("shot_retry")}
            </Button>
          </div>
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 0,
                padding: "6px 0",
              }}
            >
              <Star filled={n <= rating} />
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
        {/* Кнопку выбора файла превью НЕ подменяет - тот же приём, что в
            UploadField: подпись кнопки становится именем файла. Подмена уносила
            фокус в никуда (нажатую кнопку размонтировали), а незрячий человек
            не получал ни слова о том, что скриншот прикреплён: на её месте был
            <img alt="">, для скринридера пустое место. Здесь фокус остаётся на
            кнопке, и скринридер зачитывает её новое имя - имя файла. */}
        <button
          ref={pickerRef}
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
            lineHeight: 1.5,
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          {file ? (
            <span style={{ color: "var(--color-v2-ink-200)" }}>
              {/* anywhere - имя скриншота с телефона длиннее ширины карточки
                  и без переноса растянуло бы кнопку за борт. */}
              <strong style={{ overflowWrap: "anywhere" }}>{file.name}</strong>
              <br />
              <span style={{ fontSize: "12px", color: "var(--color-v2-ink-400)" }}>
                {t("shot_replace")}
              </span>
            </span>
          ) : (
            t("shot_add")
          )}
        </button>
        {preview && (
          /* eslint-disable-next-line @next/next/no-img-element -- локальный blob: превью до отправки, next/image здесь не применим */
          <img
            src={preview}
            alt=""
            style={{
              // maxHeight обязателен: вертикальный скрин телефона 1080x2400 при
              // одной только maxWidth рисуется высотой ~670px и выдавливает
              // «Убрать» и «Отправить» за нижний край экрана - человек видит
              // одну большую картинку без единого органа управления. На скрине
              // с прокруткой (Samsung, Xiaomi) это уже несколько экранов.
              // Превью служит опознанием файла, а не просмотром.
              display: "block",
              marginTop: "10px",
              maxWidth: "100%",
              maxHeight: "240px",
              objectFit: "contain",
              borderRadius: "var(--v2-radius-md)",
            }}
          />
        )}
        {file && (
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
        )}
        {/* heic в accept намеренно нет, хотя и сервер, и ACCEPTED_TYPES его
            принимают: при таком accept iOS сам перекодирует снимок в JPEG, а
            это ровно то, что нам нужно - предпросмотр ниже рисуется тегом img,
            и живой heic в браузерах на Chromium не отобразился бы. Человек
            ничего не теряет: файл всё равно уходит, просто уже картинкой,
            которую видно. */}
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

      {error && <ErrorBanner text={error} />}

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
