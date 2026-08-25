import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { stampExtended } from "@/lib/profile/extended";
import { MARITAL_STATUS_NEEDS_REVIEW } from "@/lib/profile/options";
import { clearFilterSkips } from "@/lib/matching/clear-filter-skips";
import {
  EDIT_SECTIONS,
  isEditSection,
  splitSectionData,
  SECTION_CLEARS_AGE_SKIPS,
  SECTION_RECHECKS_MARITAL,
} from "@/lib/profile/edit-sections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Правка одного раздела собственной анкеты.
 *
 * До сих пор человек не мог изменить в профиле НИЧЕГО: экран настроек прямо
 * писал, что редактирование - это повторный проход онбординга. Переехал,
 * сменил работу - живи с устаревшей анкетой.
 *
 * Отличие от ручек анкеты. Те делают то же самое плюс переход на следующий шаг
 * (tryTransition). Здесь перехода НЕТ: человек уже прошёл онбординг, и правка
 * города не должна двигать его по машине состояний.
 *
 * Проверка данных - те же самые схемы, что в анкете. Значит текст проходит тот
 * же фильтр контактов: телефон, ник, ссылка и мессенджер отбиваются схемой, и
 * ручной модерации текста не требуется.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ section: string }> },
): Promise<NextResponse> {
  // allowPaused: человек на паузе не показывается в подборе, но правит свою
  // анкету свободно - пауза это «отдыхаю», а не «заморожен».
  const { user, res } = await loadActiveUserApi({ allowPaused: true });
  if (res) return res;

  // Раздел берём из адреса, а тело оставляем ровно таким, какое шлют формы
  // анкеты. Благодаря этому редактор переиспользует те же двенадцать форм со
  // всей их валидацией и логикой «покажи поле, если выбрано то-то»: им
  // достаточно указать другой адрес. Своя обёртка вокруг тела означала бы
  // вторую версию каждой формы.
  const { section } = await params;
  if (!isEditSection(section))
    return NextResponse.json({ ok: false, error: "bad_section" }, { status: 400 });

  const def = EDIT_SECTIONS[section];
  const parsed = def.schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "validation", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    );

  const sb = supabaseAdmin();
  const { data: prof } = await sb
    .from("user_profiles")
    .select("extended, marital_status")
    .eq("user_id", user.id)
    .maybeSingle();

  const { columns, extended } = splitSectionData(parsed.data as Record<string, unknown>);

  // Читаем-сливаем-пишем: в extended лежат секции ВСЕХ разделов, и запись
  // целиком затёрла бы чужие. Так же делают ручки анкеты.
  const prevExt = (prof?.extended as Record<string, unknown>) ?? {};
  const prevSection = (prevExt[def.extendedKey] as Record<string, unknown>) ?? {};
  const nextExt = {
    ...prevExt,
    [def.extendedKey]: { ...prevSection, ...extended },
  };

  const patch: Record<string, unknown> = {
    user_id: user.id,
    ...columns,
    extended: stampExtended(nextExt),
  };

  // Семейное положение - не просто поле. Статусы «разводится» и «женат, живём
  // раздельно» выводят человека из подбора до одобрения оператором (гейт F4 в
  // get_recommendations). Флаг пересчитывает СЕРВЕР по значению статуса, а не
  // принимает от клиента: иначе его снимали бы запросом из браузера. Ровно так
  // же это делает админская правка профиля.
  let maritalReview: boolean | null = null;
  const prevMarital = (prof?.marital_status as string | null) ?? null;
  const nextMarital = typeof columns.marital_status === "string" ? columns.marital_status : null;
  // Пересчитываем ТОЛЬКО при настоящей смене статуса.
  //
  // Иначе выходит тихая отмена работы оператора. Человек указывает «разводится»,
  // флаг поднимается, он выпадает из подбора. Оператор смотрит документы и
  // снимает флаг через approve-marital - статус при этом остаётся «разводится»,
  // потому что человек и правда разводится. Если после этого пересчитывать флаг
  // на любое сохранение раздела, то правка соседнего поля (скажем, наличия
  // детей) снова подняла бы флаг из неизменившегося статуса - и одобренный
  // человек молча исчез бы из подбора во второй раз, уже без причины.
  if (section === SECTION_RECHECKS_MARITAL && nextMarital !== null && nextMarital !== prevMarital) {
    maritalReview = (MARITAL_STATUS_NEEDS_REVIEW as readonly string[]).includes(nextMarital);
    patch.needs_marital_review = maritalReview;
  }

  const { error: saveErr } = await sb
    .from("user_profiles")
    .upsert(patch, { onConflict: "user_id" });
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  // Поправил возрастные рамки - значит отказы «не подходит по возрасту» больше
  // не имеют основания. Без этого выходит ловушка: фильтр починил, а лента
  // осталась пустой, потому что отсеянные по старым рамкам скрыты навсегда.
  let returnedToFeed = 0;
  if (section === SECTION_CLEARS_AGE_SKIPS) {
    returnedToFeed = await clearFilterSkips(user.id, ["age"]);
  }

  return NextResponse.json({
    ok: true,
    // Клиент показывает предупреждение: правка увела человека на проверку.
    marital_review: maritalReview,
    // Сколько человек вернулось в ленту после снятия возрастных отказов.
    returned_to_feed: returnedToFeed,
  });
}
