import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { createFeedback, FEEDBACK_MAX_BODY } from "@/lib/feedback/store";
import { removeFeedbackScreenshot, uploadFeedbackScreenshot } from "@/lib/uploads/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCALES = ["ru", "uz", "en", "tr"];

/**
 * Приём отзыва о приложении.
 *
 * allowPaused: true - экран отзыва висит в настройках рядом с «Пригласить»,
 * и человек на паузе имеет право сказать, что ему не понравилось; отказ
 * ровно тому, у кого больше всего причин написать, был бы издевательством.
 *
 * Порядок «сначала файл, потом запись» намеренный: слишком большой или не тот
 * файл человек должен увидеть как ошибку формы, а не узнать после того, как
 * отзыв уже сохранён без картинки. А вот СБОЙ загрузки (диск, права) - другое
 * дело: терять из-за него оценку и текст нельзя, поэтому пишем отзыв без
 * скриншота и честно говорим об этом ответом screenshot: "failed".
 *
 * Цена этого порядка - файл уже на диске, когда запись может не создаться, а
 * хранилище не транзакционно. Сносим его только там, где ДОКАЗАНО, что путь до
 * базы не доехал: исчерпанный лимит (процедура отвечает limited до всякого
 * insert) и дедуп повторной отправки, у которого скриншот уже был свой
 * (screenshot_stored = false - ответ базы, а не догадка). Сбой базы такого
 * доказательства не даёт, и на нём файл остаётся жить: из двух ошибок лишний
 * файл в бакете дешевле записи, ссылающейся на удалённый скриншот.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadActiveUserApi({ allowPaused: true });
  if (res) return res;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  const ratingRaw = String(form.get("rating") ?? "").trim();
  if (!ratingRaw) return NextResponse.json({ ok: false, error: "no_rating" }, { status: 400 });
  const rating = Number(ratingRaw);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return NextResponse.json({ ok: false, error: "bad_rating" }, { status: 400 });

  const bodyRaw = String(form.get("body") ?? "").trim();
  if (bodyRaw.length > FEEDBACK_MAX_BODY)
    return NextResponse.json({ ok: false, error: "body_too_long" }, { status: 400 });

  const localeRaw = String(form.get("locale") ?? "ru");
  const locale = LOCALES.includes(localeRaw) ? localeRaw : "ru";

  let screenshotPath: string | null = null;
  let screenshot: "saved" | "failed" | "none" = "none";
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    const up = await uploadFeedbackScreenshot(user.id, await file.arrayBuffer());
    if (up.ok) {
      screenshotPath = up.path;
      screenshot = "saved";
    } else if (up.error === "upload_failed") {
      screenshot = "failed";
    } else {
      return NextResponse.json({ ok: false, error: up.error }, { status: 400 });
    }
  }

  const created = await createFeedback({
    userId: user.id,
    rating,
    body: bodyRaw || null,
    screenshotPath,
    locale,
  });
  if (!created.ok) {
    // Сносим ТОЛЬКО на лимите. Лимит - это доказательство, что вставки не было:
    // процедура отдаёт limited до всякого insert, значит указателя на файл в
    // базе нет ни секунды, а файл иначе останется мусором навсегда (обе дороги
    // удаления аккаунта чистят папку целиком, но до тех пор N попыток по 5 МБ
    // просто занимают диск). У db_failed такого доказательства нет: обрыв связи
    // после COMMIT неотличим от несостоявшейся вставки, а он тут штатное дело -
    // DATABASE_URL смотрит на PgBouncer в transaction-mode (src/lib/db/pool.ts),
    // и рестарт пулера рвёт запрос в полёте. Поэтому выбираем осиротевший файл:
    // его подметёт removeUserFeedbackScreenshots обходом папки, а снесённый файл,
    // на который ссылается запись, не вернуть ничем - модератор увидит битую
    // картинку вместо доказательства поломки (та же развилка в store.ts:59-65).
    if (screenshotPath && created.error === "rate_limited")
      await removeFeedbackScreenshot(screenshotPath);
    // Наружу суточный лимит уходит СВОИМ кодом feedback_limit, хотя внутри
    // store.ts он называется rate_limited. Причина: ровно тем же телом
    // {ok:false,error:"rate_limited"} отвечает глобальный лимитер в src/proxy.ts,
    // и отвечает ДО роута - ведро IP_API общее на весь IP, а за одним CGNAT-
    // адресом мобильного оператора сидят десятки человек (см. комментарий в
    // src/lib/http/rate-limit.ts). Пока коды совпадали, форма не могла их
    // отличить - тела байт в байт одинаковы - и показывала первому же соседу по
    // IP «Вы уже оставили три отзыва за сутки», хотя отзывов у него ноль, а
    // повтор через секунду прошёл бы. Отличать по заголовку Retry-After значило
    // бы держать смысл ответа в заголовке, который ставит чужой слой.
    if (created.error === "rate_limited")
      return NextResponse.json({ ok: false, error: "feedback_limit" }, { status: 429 });
    return NextResponse.json({ ok: false, error: created.error }, { status: 500 });
  }

  // Дедуп вернул СТАРУЮ запись (двойной тап, ретрай по таймауту, вторая
  // вкладка). Файл этой отправки процедура либо прикрепила к ней - тогда на него
  // ссылается база и трогать его нельзя, - либо не взяла, потому что скриншот у
  // записи уже свой. Второй файл в этом случае осиротел, сносим. Человеку это не
  // ошибка: скриншот у отзыва есть, просто от первой отправки, поэтому статус не
  // меняем - "failed" сказали бы только про настоящий сбой загрузки выше.
  if (screenshotPath && !created.screenshotStored) await removeFeedbackScreenshot(screenshotPath);

  return NextResponse.json({ ok: true, screenshot });
}
