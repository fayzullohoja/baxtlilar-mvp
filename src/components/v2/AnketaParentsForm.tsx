"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { AnketaSubmitNotice } from "./AnketaSubmitNotice";
import { useAnketaSubmit } from "./useAnketaSubmit";
import { Field, Select, scrollToFirstError } from "./AnketaFields";
import { RegionPicker, type RegionValue } from "./RegionPicker";
import {
  FATHER_STATUS,
  MOTHER_STATUS,
  PARENT_AGE_RANGE,
  PARENT_PROFESSION,
  PARENTS_MARITAL,
  PARENTS_YEARS_TOGETHER,
  FAMILY_RELATIONS,
  FAMILY_INVOLVEMENT,
  type Opt,
} from "@/lib/profile/options";

/**
 * Экран 6 «Родители и участие семьи» (2026-07-12) — 3 аккордеона (Отец / Мать /
 * Семья). Обязательны только статус отца, статус матери, участие семьи (каждый с
 * «предпочитаю не отвечать»). IF/THEN: умерший → скрыть возраст + текущее место;
 * «не отвечать» → скрыть детали. Всё COLD → extended.parents.
 * API: /api/onboarding/profile/parents.
 */

type ParentState = {
  status: string;
  age_range: string;
  profession: string;
  origin: RegionValue;
  current: RegionValue;
};

function initialParent(
  initial: Record<string, unknown> | undefined,
  who: "father" | "mother",
): ParentState {
  const g = (k: string) => (initial?.[`${who}_${k}`] as string) ?? "";
  return {
    status: g("status"),
    age_range: g("age_range"),
    profession: g("profession"),
    origin: { country: g("origin_country"), region: g("origin_region"), city: g("origin_city") },
    current: { country: g("current_country"), region: g("current_region"), city: g("current_city") },
  };
}

function AccordionSection({
  title,
  open,
  complete,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  complete: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        border: "1.5px solid var(--color-v2-ink-500)",
        borderRadius: "var(--v2-radius-md)",
        marginBottom: "14px",
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "15px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-v2-body)",
          fontSize: "15px",
          fontWeight: 800,
          color: "var(--color-v2-ink-100)",
        }}
        aria-expanded={open}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "9px" }}>
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              fontSize: "12px",
              fontWeight: 900,
              color: "#ffffff",
              background: complete ? "var(--color-v2-accent)" : "var(--color-v2-ink-500)",
            }}
          >
            {complete ? "✓" : ""}
          </span>
          {title}
        </span>
        <span
          aria-hidden
          style={{
            fontSize: "13px",
            color: "var(--color-v2-ink-400)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
          }}
        >
          ▾
        </span>
      </button>
      {open ? <div style={{ padding: "4px 16px 18px" }}>{children}</div> : null}
    </div>
  );
}

function ParentSection({
  locale,
  who,
  value,
  onChange,
  statusOptions,
  statusLabel,
  statusError,
}: {
  locale: string;
  /** Family launch, замечания 4-5: заголовки внутри секции обязаны называть
   *  конкретного родителя. Раньше обе секции делили ключи
   *  `parents_origin_heading` / `parents_current_heading`, и оунер переопределил
   *  их в админке на «Ota yoki ona qayerlik?» - вопрос стал выглядеть общим для
   *  отца и матери, хотя данные всегда писались раздельно
   *  (father_origin_* / mother_origin_*). Ключ с суффиксом убирает саму
   *  возможность такой двусмысленности. */
  who: "father" | "mother";
  value: ParentState;
  onChange: (v: ParentState) => void;
  statusOptions: Opt[];
  statusLabel: string;
  statusError?: string;
}) {
  const t = useTranslations("Anketa");
  const showDetails = !!value.status && value.status !== "prefer_not";
  const showAliveOnly = showDetails && value.status !== "deceased";

  const locLabels = {
    country: t("parents_loc_country"),
    region: t("parents_loc_region"),
    city: t("parents_loc_city"),
  };

  return (
    <div>
      <Field label={statusLabel} required error={statusError}>
        <Select options={statusOptions} value={value.status} onChange={(status) => onChange({ ...value, status })} locale={locale} />
      </Field>

      {/* «Текущие» поля — возраст и профессия («где работает», наст. время):
          не спрашиваем для умершего родителя (ревью оунера 2026-07-13) — только
          живой / на связи. Для умершего оставляем лишь статус + родной регион. */}
      {showAliveOnly ? (
        <>
          <Field label={t("parents_age_label")} hint={t("optionalHint")}>
            <Select options={PARENT_AGE_RANGE} value={value.age_range} onChange={(age_range) => onChange({ ...value, age_range })} locale={locale} />
          </Field>
          <Field label={t("parents_profession_label")} hint={t("optionalHint")}>
            <Select options={PARENT_PROFESSION} value={value.profession} onChange={(profession) => onChange({ ...value, profession })} locale={locale} />
          </Field>
        </>
      ) : null}

      {/* Родной регион — исторический факт, показываем и для умершего
          (оунер: «где родился — можем сказать»). Скрыт только при «не отвечать». */}
      {showDetails ? (
        <>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-v2-ink-300)", fontFamily: "var(--font-v2-body)", margin: "6px 0 2px" }}>
            {t(`parents_origin_heading_${who}`)}
          </div>
          <RegionPicker locale={locale} value={value.origin} onChange={(origin) => onChange({ ...value, origin })} labels={{ ...locLabels, countryHint: t("parents_origin_hint") }} />
        </>
      ) : null}

      {showAliveOnly ? (
        <>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-v2-ink-300)", fontFamily: "var(--font-v2-body)", margin: "6px 0 2px" }}>
            {t(`parents_current_heading_${who}`)}
          </div>
          <RegionPicker locale={locale} value={value.current} onChange={(current) => onChange({ ...value, current })} labels={{ ...locLabels, countryHint: t("parents_current_hint") }} />
        </>
      ) : null}
    </div>
  );
}

export function V2AnketaParentsForm({
  locale,
  initial,
  endpoint,
  submitLabel,
}: {
  locale: string;
  initial?: Record<string, unknown>;
  /** Куда слать. Пусто - обычный шаг анкеты. */
  endpoint?: string;
  /** Подпись кнопки. Пусто - «Далее», как в анкете. */
  submitLabel?: string;
}) {
  const { busy, errorCode, stepMoved, submit: submitStep } = useAnketaSubmit(endpoint ?? "/api/onboarding/profile/parents");
  const t = useTranslations("Anketa");
  const [father, setFather] = useState<ParentState>(() => initialParent(initial, "father"));
  const [mother, setMother] = useState<ParentState>(() => initialParent(initial, "mother"));
  const [parentsMarital, setParentsMarital] = useState((initial?.parents_marital as string) ?? "");
  const [yearsTogether, setYearsTogether] = useState((initial?.parents_years_together as string) ?? "");
  const [familyRelations, setFamilyRelations] = useState((initial?.family_relations as string) ?? "");
  const [familyInvolvement, setFamilyInvolvement] = useState((initial?.family_involvement as string) ?? "");
  const [open, setOpen] = useState<"father" | "mother" | "family" | null>("father");
  const [showErrors, setShowErrors] = useState(false);

  // §2 P0: эквивалент прежнего valid (статус отца/матери + участие семьи).
  const errors: Record<string, string> = {};
  if (!father.status) errors.father_status = t("err_select_required");
  if (!mother.status) errors.mother_status = t("err_select_required");
  if (!familyInvolvement) errors.family_involvement = t("err_select_required");

  const toggle = (s: "father" | "mother" | "family") => setOpen((cur) => (cur === s ? null : s));

  function parentBody(p: ParentState, who: "father" | "mother"): Record<string, unknown> {
    const showDetails = !!p.status && p.status !== "prefer_not";
    const showAliveOnly = showDetails && p.status !== "deceased";
    // Явно шлём null для неприменимых полей (умерший / «не отвечать») — иначе
    // read-merge-write на бэке оставил бы прошлое значение (напр. профессию,
    // введённую до смены статуса на «ушёл из жизни»).
    const loc = (prefix: "origin" | "current", rv: RegionValue, show: boolean) => ({
      [`${who}_${prefix}_country`]: show && rv.country ? rv.country : null,
      [`${who}_${prefix}_region`]: show && rv.region.trim() ? rv.region.trim() : null,
      [`${who}_${prefix}_city`]: show && rv.city.trim() ? rv.city.trim() : null,
    });
    return {
      [`${who}_status`]: p.status,
      // возраст + профессия («где работает») — только живой/на связи, не умерший
      [`${who}_age_range`]: showAliveOnly && p.age_range ? p.age_range : null,
      [`${who}_profession`]: showAliveOnly && p.profession ? p.profession : null,
      // родной регион — и для умершего; текущее место — только живой/на связи
      ...loc("origin", p.origin, showDetails),
      ...loc("current", p.current, showAliveOnly),
    };
  }

  async function submit() {
    if (busy) return;
    if (Object.keys(errors).length) {
      setShowErrors(true);
      // Раскрываем аккордеон с первой ошибкой, иначе поле не отрендерено и
      // scrollToFirstError не найдёт маркер.
      setOpen(errors.father_status ? "father" : errors.mother_status ? "mother" : "family");
      requestAnimationFrame(scrollToFirstError);
      return;
    }
    const body: Record<string, unknown> = {
      ...parentBody(father, "father"),
      ...parentBody(mother, "mother"),
      family_involvement: familyInvolvement,
    };
    if (parentsMarital) body.parents_marital = parentsMarital;
    // Ревью оунера 1.5: «сколько лет вместе» шлём, только если родители вместе.
    if (parentsMarital === "together" && yearsTogether) body.parents_years_together = yearsTogether;
    if (familyRelations) body.family_relations = familyRelations;

    await submitStep(body);
  }

  return (
    <div>
      <AccordionSection title={t("parents_father_title")} open={open === "father"} complete={!!father.status} onToggle={() => toggle("father")}>
        <ParentSection locale={locale} who="father" value={father} onChange={setFather} statusOptions={FATHER_STATUS} statusLabel={t("father_status_label")} statusError={showErrors ? errors.father_status : undefined} />
      </AccordionSection>

      <AccordionSection title={t("parents_mother_title")} open={open === "mother"} complete={!!mother.status} onToggle={() => toggle("mother")}>
        <ParentSection locale={locale} who="mother" value={mother} onChange={setMother} statusOptions={MOTHER_STATUS} statusLabel={t("mother_status_label")} statusError={showErrors ? errors.mother_status : undefined} />
      </AccordionSection>

      <AccordionSection title={t("parents_family_title")} open={open === "family"} complete={!!familyInvolvement} onToggle={() => toggle("family")}>
        <Field label={t("parents_marital_label")} hint={t("optionalHint")}>
          <Select options={PARENTS_MARITAL} value={parentsMarital} onChange={setParentsMarital} locale={locale} />
        </Field>
        {parentsMarital === "together" ? (
          <Field label={t("parents_years_together_label")} hint={t("optionalHint")}>
            <Select options={PARENTS_YEARS_TOGETHER} value={yearsTogether} onChange={setYearsTogether} locale={locale} />
          </Field>
        ) : null}
        <Field label={t("family_relations_label")} hint={t("optionalHint")}>
          <Select options={FAMILY_RELATIONS} value={familyRelations} onChange={setFamilyRelations} locale={locale} />
        </Field>
        <Field label={t("family_involvement_label")} required error={showErrors ? errors.family_involvement : undefined}>
          <Select options={FAMILY_INVOLVEMENT} value={familyInvolvement} onChange={setFamilyInvolvement} locale={locale} />
        </Field>
      </AccordionSection>

      <AnketaSubmitNotice errorCode={errorCode} stepMoved={stepMoved} />

      {Object.keys(errors).length ? (
        <div style={{ fontSize: "12px", color: "var(--color-v2-ink-400)", fontFamily: "var(--font-v2-body)", marginBottom: "12px", lineHeight: 1.45 }}>
          {t("parents_required_hint")}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy} variant="primary" style={{ width: "100%" }}>
        {busy ? t("btn_saving") : (submitLabel ?? t("btn_next"))}
      </Button>
    </div>
  );
}
