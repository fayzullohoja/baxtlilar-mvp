"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Field, Select } from "./AnketaFields";
import {
  MARITAL_STATUS,
  HAS_CHILDREN,
  FUTURE_CHILDREN_PLAN,
  CHILDREN_LIVING,
  CHILDREN_COUNT,
  CHILDREN_AGE_RANGE,
} from "@/lib/profile/options";
import {
  getGenderedOptionLabel,
  type Gender,
} from "@/lib/profile/gender-wording";

/**
 * V3 Sprint 2 — Экран 5 «О семье и детях» (extended).
 *
 * Изменения относительно V2:
 * - children_plan (5 опций) → future_children_plan (5 новых опций V3)
 * - + children_count (Select 1/2/3/4+/«не уточнять», conditional: has_children=yes)
 * - + children_age_range (Select-диапазон, COLD extended.family, опц.)
 * - + children_living (COLD extended.family, опц.)
 *
 * API: /api/onboarding/profile/family.
 */

export function V2AnketaFamilyForm({
  locale,
  gender,
}: {
  locale: string;
  gender: Gender | null;
}) {
  const router = useRouter();
  const t = useTranslations("Anketa");
  const [marital, setMarital] = useState("");
  const [hasChildren, setHasChildren] = useState("");
  const [childrenCount, setChildrenCount] = useState("");
  const [childrenAgeRange, setChildrenAgeRange] = useState("");
  const [childrenLiving, setChildrenLiving] = useState("");
  const [plan, setPlan] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const showChildrenDetails = hasChildren === "yes";

  // Ревью оунера Экран 5: семейное положение звучит по-разному для М/Ж.
  const maritalOptions = MARITAL_STATUS.map((opt) => ({
    value: opt.value,
    ru: getGenderedOptionLabel("MARITAL_STATUS", opt.value, gender, "ru"),
    uz: getGenderedOptionLabel("MARITAL_STATUS", opt.value, gender, "uz"),
  }));

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        marital_status: marital,
        has_children: hasChildren,
        future_children_plan: plan,
      };
      if (showChildrenDetails) {
        // Количество (hot int): 1/2/3 → int; «4 и более» → 4; «не уточнять» → null.
        if (childrenCount === "4plus") body.children_count = 4;
        else if (childrenCount && childrenCount !== "na")
          body.children_count = Number(childrenCount);
        else body.children_count = null;
        // Возраст-диапазон (COLD) и «с кем живут» (COLD) — enum, «na» валидна.
        if (childrenAgeRange) body.children_age_range = childrenAgeRange;
        if (childrenLiving) body.children_living = childrenLiving;
      }
      const res = await fetch("/api/onboarding/profile/family", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok: boolean;
        next?: string;
        error?: string;
      };
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

  // Количество детей — обязателен выбор (включая «Предпочитаю не уточнять»);
  // возраст-диапазон и «с кем живут» — опциональны.
  const childrenDetailsOk = !showChildrenDetails || childrenCount !== "";

  const valid = !!marital && !!hasChildren && !!plan && childrenDetailsOk;

  return (
    <div>
      <Field label={t("marital_label")} required>
        <Select
          options={maritalOptions}
          value={marital}
          onChange={setMarital}
          locale={locale}
        />
      </Field>

      <Field label={t("children_label")} required>
        <Select
          options={HAS_CHILDREN}
          value={hasChildren}
          onChange={(v) => {
            setHasChildren(v);
            if (v !== "yes") {
              setChildrenCount("");
              setChildrenAgeRange("");
              setChildrenLiving("");
            }
          }}
          locale={locale}
        />
      </Field>

      {showChildrenDetails ? (
        <>
          <Field label={t("childrenCountLabel")} required>
            <Select
              options={CHILDREN_COUNT}
              value={childrenCount}
              onChange={setChildrenCount}
              locale={locale}
            />
          </Field>

          <Field label={t("childrenAgeRangeLabel")} hint={t("optionalHint")}>
            <Select
              options={CHILDREN_AGE_RANGE}
              value={childrenAgeRange}
              onChange={setChildrenAgeRange}
              locale={locale}
            />
          </Field>

          {/* Ревью оунера Экран 5: с кем проживают дети (опционально). */}
          <Field label={t("childrenLivingLabel")} hint={t("optionalHint")}>
            <Select
              options={CHILDREN_LIVING}
              value={childrenLiving}
              onChange={setChildrenLiving}
              locale={locale}
            />
          </Field>
        </>
      ) : null}

      <Field
        label={t("futureChildrenPlansLabel")}
        required
        hint={t("futureChildrenPlansHint")}
      >
        <Select
          options={FUTURE_CHILDREN_PLAN}
          value={plan}
          onChange={setPlan}
          locale={locale}
        />
      </Field>

      {err ? (
        <div
          style={{
            padding: "10px 14px",
            background: "#FBE7E4",
            borderLeft: "3px solid var(--color-v2-danger)",
            borderRadius: "12px",
            fontSize: "13px",
            color: "#9A4B46",
            fontFamily: "var(--font-v2-body)",
            marginBottom: "16px",
          }}
        >
          {t("err_failed")}
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy || !valid} variant="primary">
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
