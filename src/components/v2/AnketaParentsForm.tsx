"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Field, Select } from "./AnketaFields";
import { RegionPicker, type RegionValue } from "./RegionPicker";
import {
  FATHER_STATUS,
  MOTHER_STATUS,
  PARENT_AGE_RANGE,
  PARENT_PROFESSION,
  PARENTS_MARITAL,
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
  value,
  onChange,
  statusOptions,
  statusLabel,
}: {
  locale: string;
  value: ParentState;
  onChange: (v: ParentState) => void;
  statusOptions: Opt[];
  statusLabel: string;
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
      <Field label={statusLabel} required>
        <Select options={statusOptions} value={value.status} onChange={(status) => onChange({ ...value, status })} locale={locale} />
      </Field>

      {showAliveOnly ? (
        <Field label={t("parents_age_label")} hint={t("optionalHint")}>
          <Select options={PARENT_AGE_RANGE} value={value.age_range} onChange={(age_range) => onChange({ ...value, age_range })} locale={locale} />
        </Field>
      ) : null}

      {showDetails ? (
        <>
          <Field label={t("parents_profession_label")} hint={t("optionalHint")}>
            <Select options={PARENT_PROFESSION} value={value.profession} onChange={(profession) => onChange({ ...value, profession })} locale={locale} />
          </Field>

          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-v2-ink-300)", fontFamily: "var(--font-v2-body)", margin: "6px 0 2px" }}>
            {t("parents_origin_heading")}
          </div>
          <RegionPicker locale={locale} value={value.origin} onChange={(origin) => onChange({ ...value, origin })} labels={{ ...locLabels, countryHint: t("parents_origin_hint") }} />
        </>
      ) : null}

      {showAliveOnly ? (
        <>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-v2-ink-300)", fontFamily: "var(--font-v2-body)", margin: "6px 0 2px" }}>
            {t("parents_current_heading")}
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
}: {
  locale: string;
  initial?: Record<string, unknown>;
}) {
  const router = useRouter();
  const t = useTranslations("Anketa");
  const [father, setFather] = useState<ParentState>(() => initialParent(initial, "father"));
  const [mother, setMother] = useState<ParentState>(() => initialParent(initial, "mother"));
  const [parentsMarital, setParentsMarital] = useState((initial?.parents_marital as string) ?? "");
  const [familyRelations, setFamilyRelations] = useState((initial?.family_relations as string) ?? "");
  const [familyInvolvement, setFamilyInvolvement] = useState((initial?.family_involvement as string) ?? "");
  const [open, setOpen] = useState<"father" | "mother" | "family" | null>("father");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (s: "father" | "mother" | "family") => setOpen((cur) => (cur === s ? null : s));

  function parentBody(p: ParentState, who: "father" | "mother"): Record<string, unknown> {
    const showDetails = !!p.status && p.status !== "prefer_not";
    const showAliveOnly = showDetails && p.status !== "deceased";
    const b: Record<string, unknown> = { [`${who}_status`]: p.status };
    if (showAliveOnly && p.age_range) b[`${who}_age_range`] = p.age_range;
    if (showDetails) {
      if (p.profession) b[`${who}_profession`] = p.profession;
      if (p.origin.country) {
        b[`${who}_origin_country`] = p.origin.country;
        if (p.origin.region.trim()) b[`${who}_origin_region`] = p.origin.region.trim();
        if (p.origin.city.trim()) b[`${who}_origin_city`] = p.origin.city.trim();
      }
    }
    if (showAliveOnly && p.current.country) {
      b[`${who}_current_country`] = p.current.country;
      if (p.current.region.trim()) b[`${who}_current_region`] = p.current.region.trim();
      if (p.current.city.trim()) b[`${who}_current_city`] = p.current.city.trim();
    }
    return b;
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        ...parentBody(father, "father"),
        ...parentBody(mother, "mother"),
        family_involvement: familyInvolvement,
      };
      if (parentsMarital) body.parents_marital = parentsMarital;
      if (familyRelations) body.family_relations = familyRelations;

      const res = await fetch("/api/onboarding/profile/parents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { ok: boolean; next?: string };
      if (data.ok && data.next) {
        router.replace(data.next);
        return;
      }
      setErr("failed");
    } catch {
      setErr("failed");
    } finally {
      setBusy(false);
    }
  }

  const valid = !!father.status && !!mother.status && !!familyInvolvement;

  return (
    <div>
      <AccordionSection title={t("parents_father_title")} open={open === "father"} complete={!!father.status} onToggle={() => toggle("father")}>
        <ParentSection locale={locale} value={father} onChange={setFather} statusOptions={FATHER_STATUS} statusLabel={t("father_status_label")} />
      </AccordionSection>

      <AccordionSection title={t("parents_mother_title")} open={open === "mother"} complete={!!mother.status} onToggle={() => toggle("mother")}>
        <ParentSection locale={locale} value={mother} onChange={setMother} statusOptions={MOTHER_STATUS} statusLabel={t("mother_status_label")} />
      </AccordionSection>

      <AccordionSection title={t("parents_family_title")} open={open === "family"} complete={!!familyInvolvement} onToggle={() => toggle("family")}>
        <Field label={t("parents_marital_label")} hint={t("optionalHint")}>
          <Select options={PARENTS_MARITAL} value={parentsMarital} onChange={setParentsMarital} locale={locale} />
        </Field>
        <Field label={t("family_relations_label")} hint={t("optionalHint")}>
          <Select options={FAMILY_RELATIONS} value={familyRelations} onChange={setFamilyRelations} locale={locale} />
        </Field>
        <Field label={t("family_involvement_label")} required>
          <Select options={FAMILY_INVOLVEMENT} value={familyInvolvement} onChange={setFamilyInvolvement} locale={locale} />
        </Field>
      </AccordionSection>

      {err ? (
        <div style={{ padding: "10px 14px", background: "#FBE7E4", borderLeft: "3px solid var(--color-v2-danger)", borderRadius: "12px", fontSize: "13px", color: "#9A4B46", fontFamily: "var(--font-v2-body)", marginBottom: "16px" }}>
          {t("err_failed")}
        </div>
      ) : null}

      {!valid ? (
        <div style={{ fontSize: "12px", color: "var(--color-v2-ink-400)", fontFamily: "var(--font-v2-body)", marginBottom: "12px", lineHeight: 1.45 }}>
          {t("parents_required_hint")}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy || !valid} variant="primary" style={{ width: "100%" }}>
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
