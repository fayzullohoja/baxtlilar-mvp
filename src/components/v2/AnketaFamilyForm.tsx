"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Field, Select, TextInput } from "./AnketaFields";
import {
  MARITAL_STATUS,
  HAS_CHILDREN,
  FUTURE_CHILDREN_PLAN,
  CHILDREN_LIVING,
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
 * - + children_count (conditional: если has_children=yes)
 * - + youngest_child_age (conditional: если has_children=yes)
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
  const [youngestAge, setYoungestAge] = useState("");
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
        const count = parseInt(childrenCount, 10);
        const age = parseInt(youngestAge, 10);
        if (!isNaN(count)) body.children_count = count;
        if (!isNaN(age)) body.youngest_child_age = age;
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

  const childrenDetailsOk =
    !showChildrenDetails ||
    (childrenCount !== "" &&
      Number(childrenCount) >= 1 &&
      Number(childrenCount) <= 10 &&
      youngestAge !== "" &&
      Number(youngestAge) >= 0 &&
      Number(youngestAge) <= 50);

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
              setYoungestAge("");
              setChildrenLiving("");
            }
          }}
          locale={locale}
        />
      </Field>

      {showChildrenDetails ? (
        <>
          <Field
            label={t("childrenCountLabel")}
            required
            hint={t("childrenCountHint")}
          >
            <TextInput
              maxLength={2}
              value={childrenCount}
              onChange={(e) =>
                setChildrenCount(e.target.value.replace(/\D/g, ""))
              }
              placeholder="1"
            />
          </Field>

          <Field
            label={t("youngestChildAgeLabel")}
            required
            hint={t("ageRangeHint")}
          >
            <TextInput
              maxLength={2}
              value={youngestAge}
              onChange={(e) =>
                setYoungestAge(e.target.value.replace(/\D/g, ""))
              }
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
