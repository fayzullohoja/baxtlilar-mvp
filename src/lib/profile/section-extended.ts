/**
 * Как раздел анкеты укладывается в JSON-блок extended - в ОДНОМ месте.
 *
 * Зачем этот модуль появился. Раскладка была написана руками внутри каждой ручки
 * анкеты, а потом продублирована в редакторе профиля. Копии немедленно
 * разъехались, и разъехались ТИХО: сохранение отвечает ok, а прочитать значение
 * потом неоткуда. Конкретно:
 *
 *   - «модель семьи» кладёт поле схемы family_decision_model под именем
 *     decision_model. Редактор писал имя из схемы - и админка, которая читает
 *     decision_model (profile-edit-schema.ts), правку не видела вовсе;
 *   - «здоровье» и «родители» дописывают служебные метки приватности
 *     (_visibility, substance_visibility, later_safety_review). Редактор их не
 *     ставил, поэтому раздел, впервые заполненный через правку, выглядел иначе,
 *     чем такой же раздел из анкеты.
 *
 * Тест-страж, который я написал раньше, эту болезнь НЕ ловил: он сверял имя
 * секции extended, но не имена полей внутри неё. Поэтому здесь не очередная
 * копия правил, а их единственный дом: ручка анкеты и редактор зовут одно и то
 * же, и разъезжаться больше нечему.
 *
 * Разделы, у которых раскладка тривиальна (поле схемы = поле extended),
 * строителя не имеют: для них работает общая раскладка по колонкам в
 * edit-sections.ts. Строитель заводится только там, где есть ПРАВИЛО -
 * переименование, служебная метка, условие.
 */

/** Значение по умолчанию для видимости полей о родителях. Перенесено из ручки
 *  анкеты parents: дефолты пишутся метаданными под будущий granular-контроль
 *  (сам энфорсмент отложен, как и per-block privacy в целом). */
const PARENTS_VISIBILITY_DEFAULTS: Record<string, "matching_only" | "hidden"> = {
  father_status: "matching_only",
  mother_status: "matching_only",
  father_age_range: "hidden",
  mother_age_range: "hidden",
  father_profession: "matching_only",
  mother_profession: "matching_only",
  father_origin_region: "matching_only",
  mother_origin_region: "matching_only",
  father_current_location: "hidden",
  mother_current_location: "hidden",
  family_involvement: "matching_only",
};

type Data = Record<string, unknown>;

/**
 * Строитель секции extended: получает проверенные данные раздела и прежнее
 * содержимое секции, возвращает новое содержимое целиком.
 */
export type ExtendedBuilder = (data: Data, prev: Data) => Data;

const familyModel: ExtendedBuilder = (data, prev) => ({
  ...prev,
  // ПЕРЕИМЕНОВАНИЕ. Поле схемы называется family_decision_model, а хранится и
  // читается как decision_model - см. profile-edit-schema.ts в админке. Ровно
  // на этом разъехался редактор.
  ...(data.family_decision_model ? { decision_model: data.family_decision_model } : {}),
  ...(data.household_responsibility_model
    ? { household_responsibility_model: data.household_responsibility_model }
    : {}),
});

const health: ExtendedBuilder = (data, prev) => ({
  ...prev,
  _visibility: "matching_only",
  ...(data.health_openness ? { health_openness: data.health_openness } : {}),
  ...(data.medical_check_willingness
    ? { medical_check_willingness: data.medical_check_willingness }
    : {}),
  // Ревью оунера 1.10 (substance): safety_only - НЕ показывается другим юзерам,
  // не в публичной анкете (в progressive-view whitelist не входит). Флаг
  // ready_to_discuss помечает на будущий внутренний safety-review.
  ...(data.substance_dependency_status
    ? {
        substance_dependency_status: data.substance_dependency_status,
        substance_visibility: "safety_only",
        ...(data.substance_dependency_status === "ready_to_discuss"
          ? { later_safety_review: true }
          : {}),
      }
    : {}),
});

const parents: ExtendedBuilder = (data, prev) => ({
  ...prev,
  ...data,
  _visibility: PARENTS_VISIBILITY_DEFAULTS,
  // IF/THEN оунера: «хочу советоваться с семьёй» -> позже мягко предложить
  // семейный аддон (флаг для будущей фичи, самой фичи ещё нет).
  later_offer_family_addon: data.family_involvement === "family_consultation",
});

/**
 * Разделы, у которых укладка в extended - не простое копирование полей.
 * Остальные обходятся общей раскладкой (поле без своей колонки едет в extended
 * под тем же именем).
 */
export const EXTENDED_BUILDERS: Record<string, ExtendedBuilder> = {
  family_model: familyModel,
  health,
  parents,
};

export function extendedBuilderFor(section: string): ExtendedBuilder | null {
  return EXTENDED_BUILDERS[section] ?? null;
}
