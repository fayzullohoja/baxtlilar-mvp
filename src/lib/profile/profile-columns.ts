/**
 * Колонки таблицы user_profiles.
 *
 * Нужны, чтобы редактор профиля сам раскладывал поля раздела: то, у чего есть
 * своя колонка, идёт в колонку, остальное - в JSON-блок extended. Ровно так это
 * делают ручки анкеты, но там раскладка записана руками в каждой из девяти
 * штук. Копировать её в редактор десятым разом означало бы завести вторую
 * версию правды: одну поправят, другую забудут, и правка «сохранилась», но не
 * доехала. Такое в этом проекте уже случалось - правка поля дохода была
 * клиентской, а сервер домержывал старое значение обратно.
 *
 * Список сверяется с настоящей таблицей в profile-columns.itest.ts. Если кто-то
 * добавит колонку и забудет строку здесь, поле молча уедет в extended и
 * пропадёт из выдачи - тест это ловит.
 */
export const PROFILE_COLUMNS: ReadonlySet<string> = new Set([
  "user_id",
  "display_name",
  "gender",
  "birth_date",
  "city",
  "bio",
  "marital_status",
  "has_children",
  "religion",
  "education",
  "looking_for_gender",
  "partner_age_min",
  "partner_age_max",
  "geo_preference",
  "languages",
  "status",
  "reject_reason",
  "published_at",
  "created_at",
  "updated_at",
  "citizenship",
  "country_of_residence",
  "region",
  "height_cm",
  "weight_kg",
  "native_language",
  "religion_practice",
  "religion_partner_match",
  "post_marriage_living",
  "birth_country",
  "birth_region",
  "birth_district",
  "birth_city",
  "activity_field",
  "employment_format",
  "children_count",
  "youngest_child_age",
  "future_children_plan",
  "top_life_values",
  "family_role_model",
  "wife_work_after_marriage_view",
  "partner_height_min",
  "partner_height_max",
  "partner_top_qualities",
  "profile_visibility_mode",
  "extended",
  "district",
  "district_visible_public",
  "partner_religion_match",
  "partner_preferred_countries",
  "needs_v4_review",
  "marriage_readiness",
  "relocation_readiness",
  "employment_status",
  "needs_marital_review",
  "schema_version",
]);

/**
 * Колонки, которые редактор НЕ имеет права писать ни при каких условиях.
 *
 * Три группы, и путать их нельзя:
 *
 *   - паспортные (ФИО, дата рождения, пол) - приходят из документа при проверке
 *     личности, и правка через анкету означала бы, что проверка ничего не
 *     значит. Меняются только через поддержку, с переподтверждением;
 *   - служебные (статус анкеты, флаги проверки, отметки времени) - ими
 *     распоряжается машина состояний и модерация, а не человек. Сюда же
 *     needs_marital_review: его пересчитывает сервер по значению статуса, а не
 *     принимает от клиента, иначе флаг снимался бы запросом из браузера;
 *   - ключ строки (user_id) - берётся из сессии.
 */
export const NON_EDITABLE_COLUMNS: ReadonlySet<string> = new Set([
  "user_id",
  "display_name",
  "gender",
  "birth_date",
  "status",
  "reject_reason",
  "published_at",
  "created_at",
  "updated_at",
  "extended",
  "needs_v4_review",
  "needs_marital_review",
  "schema_version",
  "profile_visibility_mode",
]);
