import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { signedFeedbackUrls } from "@/lib/uploads/storage";

export type FeedbackRow = {
  id: string;
  user_id: string;
  // Человекочитаемое имя автора: имя из Telegram -> @username -> «—».
  user_label: string | null;
  rating: number;
  body: string | null;
  // Уже подписанная ссылка, а не путь: путь без подписи бесполезен, а
  // подписывать в разметке - значит тащить ключи бакета в компонент.
  screenshot_url: string | null;
  locale: string;
  created_at: string;
};

/**
 * Потолок строк в одной выдаче. Нужен потому, что каждая строка тянет за собой
 * не запись, а до 5 МБ картинки: сжатия у нас нет (sharp в проекте нет), и
 * миниатюра 84x84 - это тот же оригинал, что лежит в бакете. Без потолка список
 * рос бы вместе с таблицей и упирался бы в память одного Node-процесса на боксе
 * 2 vCPU / 2-4 ГБ: сорок отзывов со скриншотами - это уже ~200 МБ отдачи.
 *
 * Ровно тем же приёмом ограничены жалобы (/admin/reports, .limit(100)) - курсор
 * не заводим, спека пагинации не просит.
 *
 * ⚠️ Страница сравнивает с этой константой длину выдачи (rows.length ===
 * FEEDBACK_LIST_LIMIT) и по этому признаку предупреждает про обрезку. Появится
 * второе ограничение выборки - фильтр, окно по датам, свой лимит у вызывающего -
 * признак начнёт врать, и предупреждение придётся считать иначе.
 */
export const FEEDBACK_LIST_LIMIT = 50;

/**
 * Список отзывов для /admin/feedback.
 *
 * Батч вместо N+1: одним select тянем авторов по всем user_id сразу и одним
 * вызовом подписываем все скриншоты - по образцу loadInviteRows.
 *
 * TTL подписи короткий (5 минут по умолчанию signedFeedbackUrls): на
 * скриншоте может оказаться чужая анкета, и ссылка не должна жить дольше
 * просмотра страницы.
 */
export async function loadFeedbackRows(): Promise<FeedbackRow[]> {
  const sb = supabaseAdmin();
  const rows = unwrapRows(
    await sb
      .from("feedback")
      .select("id, user_id, rating, body, screenshot_path, locale, created_at")
      // Потолок только вместе с сортировкой: сам по себе LIMIT отрезал бы не
      // самые свежие отзывы, а произвольные - порядок строк в таблице не задан.
      .order("created_at", { ascending: false })
      .limit(FEEDBACK_LIST_LIMIT),
  );
  if (!rows.length) return [];

  const userIds = [...new Set(rows.map((r) => String(r.user_id)))];
  const users = unwrapRows(
    await sb
      .from("users")
      .select("id, telegram_username, telegram_first_name")
      .in("id", userIds),
  );
  const label = new Map<string, string | null>();
  for (const u of users) {
    const name = (u.telegram_first_name as string | null) ?? null;
    const uname = (u.telegram_username as string | null) ?? null;
    label.set(String(u.id), name ?? (uname ? `@${uname}` : null));
  }

  const urls = await signedFeedbackUrls(rows.map((r) => r.screenshot_path as string | null));

  return rows.map((r) => ({
    id: String(r.id),
    user_id: String(r.user_id),
    user_label: label.get(String(r.user_id)) ?? null,
    rating: Number(r.rating),
    body: (r.body as string | null) ?? null,
    screenshot_url: r.screenshot_path ? (urls[String(r.screenshot_path)] ?? null) : null,
    locale: String(r.locale ?? "ru"),
    created_at: String(r.created_at),
  }));
}
