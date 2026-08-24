"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { AnketaSubmitNotice } from "./AnketaSubmitNotice";
import { useAnketaSubmit } from "./useAnketaSubmit";
import { Field, Select, TextInput, scrollToFirstError } from "./AnketaFields";
import {
  ChildrenDetails,
  childrenComplete,
  resizeChildren,
  type ChildInfo,
} from "./ChildrenDetails";
import {
  MARITAL_STATUS_SELECTABLE,
  PREVIOUS_MARRIAGES,
  HAS_CHILDREN,
  FUTURE_CHILDREN_PLAN,
  CHILDREN_LIVING,
} from "@/lib/profile/options";
import {
  type Gender,
} from "@/lib/profile/gender-wording";

/**
 * V3 Sprint 2 — Экран 5 «О семье и детях».
 *
 * 2026-07-12 (ревью оунера): дети переработаны — количество ползунком (точное
 * число) + пол/возраст КАЖДОГО ребёнка (ChildrenDetails), вместо «4 и более»
 * и одного диапазона возраста на всех. children[] хранится в extended.family.
 *
 * API: /api/onboarding/profile/family.
 */

function initialChildren(initial: {
  children?: ChildInfo[];
  children_count?: string;
  has_children?: string;
}): ChildInfo[] {
  if (initial.children && initial.children.length > 0) return initial.children;
  // Легаси: был только children_count (int) без пер-детей → N детей без возраста.
  const legacy = Number(initial.children_count);
  if (Number.isFinite(legacy) && legacy >= 1) return resizeChildren([], legacy);
  if (initial.has_children === "yes") return [{ gender: null, age: null }];
  return [];
}

export function V2AnketaFamilyForm({
  locale,
  gender,
  initial,
}: {
  locale: string;
  gender: Gender | null;
  initial?: {
    marital_status?: string;
    previous_marriages?: string;
    marital_other?: string;
    has_children?: string;
    future_children_plan?: string;
    children_count?: string;
    children?: ChildInfo[];
    children_living?: string;
  };
}) {
  const { busy, errorCode, stepMoved, submit: submitStep } = useAnketaSubmit(
    "/api/onboarding/profile/family",
  );
  const t = useTranslations("Anketa");
  const [marital, setMarital] = useState(initial?.marital_status ?? "");
  const [prevMarriages, setPrevMarriages] = useState(
    initial?.previous_marriages ?? "",
  );
  const [maritalOther, setMaritalOther] = useState(
    initial?.marital_other ?? "",
  );
  const [hasChildren, setHasChildren] = useState(initial?.has_children ?? "");
  const [children, setChildren] = useState<ChildInfo[]>(() =>
    initialChildren(initial ?? {}),
  );
  const [childrenLiving, setChildrenLiving] = useState(
    initial?.children_living ?? "",
  );
  const [plan, setPlan] = useState(initial?.future_children_plan ?? "");
  const [showErrors, setShowErrors] = useState(false);

  const showChildrenDetails = hasChildren === "yes";
  // T-101: при «В разводе» — обязательный вопрос о числе прошлых браков.
  const showPrevMarriages = marital === "divorced";
  // T-102: при «Другое» — обязательное поле пояснения.
  const showMaritalOther = marital === "other";

  // §2 P0: эквивалент прежнего valid (marital + hasChildren + plan; при «есть дети» —
  // у каждого указан возраст через childrenComplete).
  const errors: Record<string, string> = {};
  if (!marital) errors.marital_status = t("err_select_required");
  if (showPrevMarriages && !prevMarriages)
    errors.previous_marriages = t("err_select_required");
  if (showMaritalOther && !maritalOther.trim())
    errors.marital_other = t("err_field_required");
  if (!hasChildren) errors.has_children = t("err_select_required");
  if (showChildrenDetails && !childrenComplete(children))
    errors.children = t("err_field_required");
  if (!plan) errors.future_children_plan = t("err_select_required");

  async function submit() {
    if (busy) return;
    if (Object.keys(errors).length) {
      setShowErrors(true);
      requestAnimationFrame(scrollToFirstError);
      return;
    }
    const body: Record<string, unknown> = {
      marital_status: marital,
      has_children: hasChildren,
      future_children_plan: plan,
    };
    if (showPrevMarriages && prevMarriages)
      body.previous_marriages = prevMarriages;
    if (showMaritalOther && maritalOther.trim())
      body.marital_other = maritalOther.trim();
    if (showChildrenDetails) {
      body.children_count = children.length; // hot int = длина массива
      body.children = children; // COLD extended.family.children (пол + возраст)
      if (childrenLiving) body.children_living = childrenLiving;
    }
    await submitStep(body);
  }

  return (
    <div>
      <Field label={t("marital_label")} required error={showErrors ? errors.marital_status : undefined}>
        {/* Ревью оунера Экран 5: семейное положение звучит по-разному для М/Ж.
            Гендерный вариант берётся по ключу Options.MARITAL_STATUS.<v>__<m|f>
            (редактируется в админке), с откатом на код-оверрайд. */}
        <Select
          options={MARITAL_STATUS_SELECTABLE}
          value={marital}
          onChange={(v) => {
            setMarital(v);
            // T-101/T-102: при смене статуса скрытые поля очищаются.
            if (v !== "divorced") setPrevMarriages("");
            if (v !== "other") setMaritalOther("");
          }}
          locale={locale}
          gender={gender}
        />
      </Field>

      {showPrevMarriages ? (
        <Field
          label={t("prevMarriagesLabel")}
          required
          error={showErrors ? errors.previous_marriages : undefined}
        >
          <Select
            options={PREVIOUS_MARRIAGES}
            value={prevMarriages}
            onChange={setPrevMarriages}
            locale={locale}
          />
        </Field>
      ) : null}

      {showMaritalOther ? (
        <Field
          label={t("maritalOtherLabel")}
          required
          error={showErrors ? errors.marital_other : undefined}
        >
          <TextInput
            value={maritalOther}
            onChange={(e) => setMaritalOther(e.target.value)}
            maxLength={120}
            placeholder={t("maritalOtherPlaceholder")}
          />
        </Field>
      ) : null}

      <Field label={t("children_label")} required error={showErrors ? errors.has_children : undefined}>
        <Select
          options={HAS_CHILDREN}
          value={hasChildren}
          onChange={(v) => {
            setHasChildren(v);
            if (v === "yes") {
              if (children.length === 0)
                setChildren([{ gender: null, age: null }]);
            } else {
              setChildren([]);
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
            error={showErrors ? errors.children : undefined}
          >
            <ChildrenDetails items={children} onChange={setChildren} />
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
        error={showErrors ? errors.future_children_plan : undefined}
      >
        <Select
          options={FUTURE_CHILDREN_PLAN}
          value={plan}
          onChange={setPlan}
          locale={locale}
        />
      </Field>

      <AnketaSubmitNotice errorCode={errorCode} stepMoved={stepMoved} />

      <Button onClick={submit} disabled={busy} variant="primary">
        {busy ? t("btn_saving") : t("btn_next")}
      </Button>
    </div>
  );
}
