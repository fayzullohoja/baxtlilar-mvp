"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { Field, Select, TextInput } from "./AnketaFields";
import {
  MARITAL_STATUS,
  HAS_CHILDREN,
  FUTURE_CHILDREN_PLAN,
} from "@/lib/profile/options";

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

export function V2AnketaFamilyForm({ locale }: { locale: string }) {
  const router = useRouter();
  const [marital, setMarital] = useState("");
  const [hasChildren, setHasChildren] = useState("");
  const [childrenCount, setChildrenCount] = useState("");
  const [youngestAge, setYoungestAge] = useState("");
  const [plan, setPlan] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const showChildrenDetails = hasChildren === "yes";

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
      <Field label="Семейный статус" required>
        <Select
          options={MARITAL_STATUS}
          value={marital}
          onChange={setMarital}
          locale={locale}
        />
      </Field>

      <Field label="Есть ли дети" required>
        <Select
          options={HAS_CHILDREN}
          value={hasChildren}
          onChange={(v) => {
            setHasChildren(v);
            if (v !== "yes") {
              setChildrenCount("");
              setYoungestAge("");
            }
          }}
          locale={locale}
        />
      </Field>

      {showChildrenDetails ? (
        <>
          <Field
            label="Сколько детей"
            required
            hint="От 1 до 10."
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
            label="Возраст младшего ребёнка"
            required
            hint="В годах, 0-50."
          >
            <TextInput
              maxLength={2}
              value={youngestAge}
              onChange={(e) =>
                setYoungestAge(e.target.value.replace(/\D/g, ""))
              }
              placeholder=""
            />
          </Field>
        </>
      ) : null}

      <Field
        label="Планы на детей в будущем"
        required
        hint="Это важный матчинг-сигнал — алгоритм учитывает совместимость планов."
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
            background: "rgba(180, 50, 50, 0.08)",
            border: "1px solid rgba(180, 50, 50, 0.3)",
            borderRadius: "var(--v2-radius-md)",
            fontSize: "13px",
            color: "var(--color-v2-ink-200)",
            fontFamily: "var(--font-v2-body)",
            marginBottom: "16px",
          }}
        >
          Не получилось сохранить. Попробуй ещё раз.
        </div>
      ) : null}

      <Button onClick={submit} disabled={busy || !valid} variant="primary">
        {busy ? "Сохраняю…" : "Дальше"}
      </Button>
    </div>
  );
}
