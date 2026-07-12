"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Field, Select } from "./AnketaFields";
import {
  ChildrenDetails,
  childrenComplete,
  resizeChildren,
  type ChildInfo,
} from "./ChildrenDetails";
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
    has_children?: string;
    future_children_plan?: string;
    children_count?: string;
    children?: ChildInfo[];
    children_living?: string;
  };
}) {
  const router = useRouter();
  const t = useTranslations("Anketa");
  const [marital, setMarital] = useState(initial?.marital_status ?? "");
  const [hasChildren, setHasChildren] = useState(initial?.has_children ?? "");
  const [children, setChildren] = useState<ChildInfo[]>(() =>
    initialChildren(initial ?? {}),
  );
  const [childrenLiving, setChildrenLiving] = useState(
    initial?.children_living ?? "",
  );
  const [plan, setPlan] = useState(initial?.future_children_plan ?? "");
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
        body.children_count = children.length; // hot int = длина массива
        body.children = children; // COLD extended.family.children (пол + возраст)
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

  // У каждого ребёнка должен быть указан возраст (пол опционален).
  const childrenDetailsOk = !showChildrenDetails || childrenComplete(children);

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
