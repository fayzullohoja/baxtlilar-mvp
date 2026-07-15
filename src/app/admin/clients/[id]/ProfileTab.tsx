import "server-only";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import { ageFromDate } from "@/lib/profile/schemas";
import { loadFullProfile } from "@/lib/admin/load-profile-full";
import { districtLabel } from "@/lib/profile/uz-districts";
import { cityLabel } from "@/lib/profile/cities";
import { MaritalReviewAction } from "./MaritalReviewAction";
import { PROFILE_EDIT_SECTIONS } from "@/lib/admin/profile-edit-schema";
import { ProfileEditGate } from "./ProfileEditGate";
import { getMergedMessages } from "@/lib/i18n/overrides";
import { optLabelOf, optTranslatorFromMessages } from "@/lib/profile/option-label";
import {
  GENDER,
  CITIZENSHIP,
  COUNTRY_OF_RESIDENCE,
  UZ_REGIONS,
  MARITAL_STATUS,
  HAS_CHILDREN,
  CHILDREN_AGE_RANGE,
  FUTURE_CHILDREN_PLAN,
  RELIGION,
  RELIGION_PRACTICE,
  EDUCATION,
  ACTIVITY_FIELDS,
  EMPLOYMENT_FORMAT,
  EMPLOYMENT_STATUS,
  MARRIAGE_READINESS,
  RELOCATION_READINESS,
  LANGUAGES_LIST,
  FAMILY_ROLE_MODEL,
  WIFE_WORK_VIEW,
  POST_MARRIAGE_LIVING,
  PROFILE_VISIBILITY_MODE,
  LIFE_VALUES_V3,
  PARTNER_QUALITIES,
  RELIGION_PARTNER_MATCH,
  PARTNER_PREFERRED_COUNTRIES,
  GEO_PREFERENCE,
  INCOME_SOURCE_STABILITY,
  FAMILY_FINANCE_MANAGEMENT,
  FINANCIAL_PRIORITIES,
  MONTHLY_INCOME_RANGE,
  FINANCIAL_OBLIGATIONS,
  HOUSING_STATUS,
  LIFESTYLE_PACE,
  FREE_TIME_ACTIVITIES,
  DAILY_ROUTINE,
  BAD_HABITS_LEVEL,
  NUTRITION_STYLE,
  ALCOHOL_LEVEL,
  DRUGS_USE,
  FAMILY_DECISION_MODEL,
  HOUSEHOLD_RESPONSIBILITY_MODEL,
  SEPARATE_FROM_PARENTS_IMPORTANCE,
} from "@/lib/profile/options";

type Opt = { value: string; ru: string; uz: string };

const BIG_FIVE: { key: string; label: string }[] = [
  { key: "O", label: "Открытость" },
  { key: "C", label: "Добросовестность" },
  { key: "E", label: "Экстраверсия" },
  { key: "A", label: "Доброжелательность" },
  { key: "ES", label: "Эмоц. устойчивость" },
];

export async function ProfileTab({ userId, canEdit = false }: { userId: string; canEdit?: boolean }) {
  const full = await loadFullProfile(userId);
  if (!full) {
    return (
      <div style={emptyBox}>Анкета не заполнена.</div>
    );
  }
  const p = full.profile;
  const ext = full.extended;
  const fin = ext.finance ?? {};
  const life = ext.lifestyle ?? {};
  const fam = ext.family ?? {};
  const living = ext.living ?? {};
  const bio = ext.bio ?? {};
  const partner = (ext.partner ?? {}) as { location_preference?: { scope?: string } };

  // Текущие значения редактируемых полей для формы редактора
  // (hot → p.<key>, cold → ext.<section>.<key>).
  const pRec = p as unknown as Record<string, unknown>;
  const extRec = ext as unknown as Record<string, Record<string, unknown> | undefined>;
  const editableValues: Record<string, unknown> = {};
  for (const sec of PROFILE_EDIT_SECTIONS)
    for (const f of sec.fields)
      editableValues[f.key] = f.cold ? (extRec[f.cold]?.[f.key] ?? null) : (pRec[f.key] ?? null);

  // Лейблы опций — через тот же оверлей, что и мини-апп (конструктор текстовок
  // Tier 2), иначе карточка показывала бы БАЗУ, игнорируя правки оунера. Админка
  // вне [locale]/next-intl → строим OptTranslator из merged-словаря "ru" вручную.
  // Гендерный вариант не запрашиваем: карточка показывает КАНОНИЧЕСКИЙ (нейтральный)
  // лейбл (как и раньше через labelOf), теперь просто с учётом правок.
  const tOpt = optTranslatorFromMessages((await getMergedMessages("ru")).Options);

  // v — значение из анкеты; L — по словарю опций; raw — как есть; scale — «N/5».
  const L = (group: Opt[], v: unknown) =>
    v != null && v !== "" ? optLabelOf(tOpt, group, String(v), "ru") : "—";
  const raw = (v: unknown) => (v != null && v !== "" ? String(v) : "—");
  const num = (v: unknown) => (typeof v === "number" ? String(v) : "—");
  const chips = (group: Opt[], v: unknown) =>
    Array.isArray(v) && v.length ? (v as string[]).map((x) => optLabelOf(tOpt, group, x, "ru")) : [];

  const age = p.birth_date ? ageFromDate(String(p.birth_date)) : null;
  const status = p.status as string | null;

  // Дети: пол+возраст каждого (extended.family.children). Легаси-фолбэк — диапазон.
  const childKids = (Array.isArray(fam.children) ? fam.children : []) as Array<{
    gender?: string | null;
    age?: number | null;
  }>;
  const childrenSummary = childKids.length
    ? childKids
        .map((c) => {
          const g =
            c?.gender === "boy" ? "мальчик" : c?.gender === "girl" ? "девочка" : "";
          const a = typeof c?.age === "number" ? `${c.age} л.` : "?";
          return [g, a].filter(Boolean).join(" ");
        })
        .join(", ")
    : fam.children_age_range
      ? L(CHILDREN_AGE_RANGE, fam.children_age_range)
      : "";

  const districtLine =
    p.district != null && p.district !== ""
      ? `${raw(p.district)}${p.district_visible_public ? " · публично" : " · скрыт"}`
      : "—";

  return (
    <ProfileEditGate userId={userId} canEdit={canEdit} values={editableValues}>
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* F4: контент-ревью семейного положения — профиль скрыт из мэтчинга до одобрения */}
      {p.needs_marital_review === true ? (
        <MaritalReviewAction userId={userId} maritalLabel={L(MARITAL_STATUS, p.marital_status)} />
      ) : null}

      {/* Шапка */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 500 }}>{raw(p.display_name)}</span>
        {status === "published" ? (
          <StatusPill kind="active">опубликована</StatusPill>
        ) : (
          <StatusPill kind="pending">{status ?? "черновик"}</StatusPill>
        )}
      </div>

      {p.bio ? <div style={bioBox}>{String(p.bio)}</div> : null}

      <Section title="Основное">
        <Field label="Пол" value={L(GENDER, p.gender)} />
        <Field
          label="Возраст / дата рождения"
          value={age != null ? `${age} · ${raw(p.birth_date)}` : raw(p.birth_date)}
        />
        <Field label="Гражданство" value={L(CITIZENSHIP, p.citizenship)} />
        <Field label="Страна проживания" value={L(COUNTRY_OF_RESIDENCE, p.country_of_residence)} />
        <Field label="Регион" value={L(UZ_REGIONS, p.region)} />
        <Field label="Район" value={districtLine} />
        <Field label="Семейный статус" value={L(MARITAL_STATUS, p.marital_status)} />
        <Field
          label="Дети"
          value={
            p.has_children
              ? `${L(HAS_CHILDREN, p.has_children)}${
                  typeof p.children_count === "number" ? ` · ${p.children_count} дет.` : ""
                }${childrenSummary ? ` · ${childrenSummary}` : ""}`
              : "—"
          }
        />
        <Field label="Планы на детей" value={L(FUTURE_CHILDREN_PLAN, p.future_children_plan)} />
        <Field label="Религия" value={L(RELIGION, p.religion)} />
        <Field label="Практика веры" value={L(RELIGION_PRACTICE, p.religion_practice)} />
        <Field label="Готовность к браку" value={L(MARRIAGE_READINESS, p.marriage_readiness)} />
        <Field label="Готовность к переезду" value={L(RELOCATION_READINESS, p.relocation_readiness)} />
        <Field label="Видимость профиля" value={L(PROFILE_VISIBILITY_MODE, p.profile_visibility_mode)} />
      </Section>

      <Section title="Образование и работа">
        <Field label="Образование" value={L(EDUCATION, p.education)} />
        <Field label="Сфера деятельности" value={L(ACTIVITY_FIELDS, p.activity_field)} />
        <Field label="Формат занятости" value={L(EMPLOYMENT_FORMAT, p.employment_format)} />
        <Field label="Статус занятости" value={L(EMPLOYMENT_STATUS, p.employment_status)} />
      </Section>

      <Section title="Внешность">
        <Field label="Рост" value={typeof p.height_cm === "number" ? `${p.height_cm} см` : "—"} />
        <Field label="Вес" value={typeof p.weight_kg === "number" ? `${p.weight_kg} кг` : "—"} />
        <Field label="Родной язык" value={L(LANGUAGES_LIST, p.native_language)} />
        <Field label="Языки" value={chips(LANGUAGES_LIST, p.languages).join(", ") || "—"} />
      </Section>

      <Section title="Место рождения">
        <Field label="Страна" value={raw(p.birth_country)} />
        <Field label="Регион" value={L(UZ_REGIONS, p.birth_region)} />
        <Field label="Район" value={districtLabel(p.birth_district as string | null, "ru") || "—"} />
        <Field label="Город" value={cityLabel(p.birth_city as string | null, "ru") || "—"} />
      </Section>

      <ChipSection title="Ценности" items={chips(LIFE_VALUES_V3, p.top_life_values)} />

      <Section title="Семейная модель">
        <Field label="Модель семьи" value={L(FAMILY_ROLE_MODEL, p.family_role_model)} />
        <Field label="Работа жены после брака" value={L(WIFE_WORK_VIEW, p.wife_work_after_marriage_view)} />
        <Field label="Проживание после брака" value={L(POST_MARRIAGE_LIVING, p.post_marriage_living)} />
        <Field label="Принятие решений" value={L(FAMILY_DECISION_MODEL, fam.decision_model)} />
        <Field label="Быт / обязанности" value={L(HOUSEHOLD_RESPONSIBILITY_MODEL, fam.household_responsibility_model)} />
        <Field label="Жить отдельно от родителей" value={L(SEPARATE_FROM_PARENTS_IMPORTANCE, living.separate_from_parents_importance)} />
      </Section>

      <Section title="Финансы" sensitive>
        <Field label="Стабильность дохода" value={L(INCOME_SOURCE_STABILITY, fin.income_source_stability)} />
        <Field
          label="Важность фин. стабильности"
          value={typeof fin.financial_stability_importance === "number" ? `${fin.financial_stability_importance}/5` : "—"}
        />
        <Field label="Управление бюджетом" value={L(FAMILY_FINANCE_MANAGEMENT, fin.family_finance_management)} />
        <Field label="Диапазон дохода" value={L(MONTHLY_INCOME_RANGE, fin.monthly_income_range)} />
        <Field label="Фин. обязательства" value={L(FINANCIAL_OBLIGATIONS, fin.financial_obligations)} />
        <Field label="Жильё" value={L(HOUSING_STATUS, fin.housing_status)} />
        <Field label="Фин. приоритеты" value={chips(FINANCIAL_PRIORITIES, fin.financial_priorities).join(", ") || "—"} />
      </Section>

      <Section title="Образ жизни" sensitive>
        <Field label="Темп жизни" value={L(LIFESTYLE_PACE, life.lifestyle_pace)} />
        <Field label="Распорядок дня" value={L(DAILY_ROUTINE, life.daily_routine)} />
        <Field label="Вредные привычки" value={L(BAD_HABITS_LEVEL, life.bad_habits_level)} />
        <Field label="Питание" value={L(NUTRITION_STYLE, life.nutrition_style)} />
        <Field label="Алкоголь" value={L(ALCOHOL_LEVEL, life.alcohol_level)} />
        <Field label="Наркотики" value={L(DRUGS_USE, life.drugs_use)} />
        <Field label="Досуг" value={chips(FREE_TIME_ACTIVITIES, life.free_time_activities).join(", ") || "—"} />
      </Section>

      <Section title="Кого ищет">
        <Field label="Пол партнёра" value={L(GENDER, p.looking_for_gender)} />
        <Field
          label="Возраст партнёра"
          value={
            p.partner_age_min || p.partner_age_max
              ? `${num(p.partner_age_min)}–${num(p.partner_age_max)} лет`
              : "—"
          }
        />
        <Field
          label="Рост партнёра"
          value={
            p.partner_height_min || p.partner_height_max
              ? `${num(p.partner_height_min)}–${num(p.partner_height_max)} см`
              : "—"
          }
        />
        <Field label="Религия партнёра" value={L(RELIGION_PARTNER_MATCH, p.partner_religion_match)} />
        <Field label="География (legacy)" value={L(GEO_PREFERENCE, p.geo_preference)} />
        <Field label="Предпочтение локации" value={raw(partner.location_preference?.scope)} />
        <Field label="Качества партнёра" value={chips(PARTNER_QUALITIES, p.partner_top_qualities).join(", ") || "—"} />
        <Field label="Страны партнёра" value={chips(PARTNER_PREFERRED_COUNTRIES, p.partner_preferred_countries).join(", ") || "—"} />
      </Section>

      {(bio.hobbies || bio.about_family) ? (
        <Section title="Дополнительно">
          <Field label="Хобби" value={raw(bio.hobbies)} />
          <Field label="О семье" value={raw(bio.about_family)} />
        </Section>
      ) : null}

      {/* Психотест */}
      <div style={sectionBox}>
        <SectionTitle>Психотест «Семейный компас»</SectionTitle>
        {full.quizVector ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {BIG_FIVE.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                value={typeof full.quizVector?.[f.key] === "number" ? `${Math.round(full.quizVector[f.key])}/100` : "—"}
              />
            ))}
            <Field label="Пройден" value={full.quizCompletedAt ? String(full.quizCompletedAt).slice(0, 10) : "—"} />
            <Field label="Ответов" value={String(full.quizAnswers.length)} />
          </div>
        ) : (
          <div style={{ fontSize: 13, color: ADMIN.ink500 }}>Не пройден.</div>
        )}
      </div>
    </div>
    </ProfileEditGate>
  );
}

// ─── примитивы ────────────────────────────────────────────────────────────

function Section({
  title,
  sensitive,
  children,
}: {
  title: string;
  sensitive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={sectionBox}>
      <SectionTitle sensitive={sensitive}>{title}</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>{children}</div>
    </div>
  );
}

function SectionTitle({
  children,
  sensitive,
}: {
  children: React.ReactNode;
  sensitive?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 14,
        fontSize: 11,
        fontWeight: 600,
        color: ADMIN.ink500,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {children}
      {sensitive ? (
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            padding: "1px 6px",
            borderRadius: 4,
            background: ADMIN.surface2,
            border: `1px solid ${ADMIN.border}`,
            color: ADMIN.ink500,
            letterSpacing: 0,
          }}
        >
          приватно · после мэтча
        </span>
      ) : null}
    </div>
  );
}

function ChipSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.length ? (
          items.map((v) => (
            <span
              key={v}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: ADMIN.surface2,
                border: `1px solid ${ADMIN.border}`,
                fontSize: 12,
                color: ADMIN.ink700,
              }}
            >
              {v}
            </span>
          ))
        ) : (
          <span style={{ fontSize: 13, color: ADMIN.ink500 }}>—</span>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: ADMIN.ink500,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

const sectionBox: React.CSSProperties = {
  padding: 20,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 8,
  background: ADMIN.surface,
};

const bioBox: React.CSSProperties = {
  padding: 16,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 8,
  background: ADMIN.surface,
  fontSize: 14,
  lineHeight: 1.5,
  color: ADMIN.ink900,
  whiteSpace: "pre-wrap",
};

const emptyBox: React.CSSProperties = {
  padding: 24,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 8,
  background: ADMIN.surface,
  color: ADMIN.ink500,
  fontSize: 13,
};
