"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { RangeSlider } from "./AnketaFields";

export type ChildInfo = { gender: "boy" | "girl" | null; age: number | null };

const MAX_CHILDREN = 8;
const AGE_MIN = 0;
const AGE_MAX = 18;
const AGE_MID = 8;

const emptyChild = (): ChildInfo => ({ gender: null, age: null });

/** Нормализует массив к длине n (обрезает / дополняет пустыми детьми). */
export function resizeChildren(items: ChildInfo[], n: number): ChildInfo[] {
  const target = Math.min(MAX_CHILDREN, Math.max(1, Math.round(n)));
  if (target === items.length) return items;
  if (target < items.length) return items.slice(0, target);
  return [
    ...items,
    ...Array.from({ length: target - items.length }, emptyChild),
  ];
}

/** Все дети имеют указанный возраст (пол опционален). */
export function childrenComplete(items: ChildInfo[]): boolean {
  return items.length >= 1 && items.every((c) => c.age !== null);
}

/**
 * Экран 5 «Дети»: количество (ползунок) + пол/возраст КАЖДОГО ребёнка.
 * Единственный источник правды — массив items; count = items.length.
 * Возраст — состояние «не указано» до первого касания (RangeSlider isSet).
 */
export function ChildrenDetails({
  items,
  onChange,
}: {
  items: ChildInfo[];
  onChange: (next: ChildInfo[]) => void;
}) {
  const t = useTranslations("Anketa");
  const count = Math.max(1, items.length);

  const setCount = (n: number) => onChange(resizeChildren(items, n));
  const patch = (i: number, p: Partial<ChildInfo>) =>
    onChange(items.map((c, idx) => (idx === i ? { ...c, ...p } : c)));

  const countPct = ((count - 1) / (MAX_CHILDREN - 1)) * 100;

  return (
    <div>
      {/* --- Количество детей (ползунок) --- */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: "14px" }}>
          <span
            style={{
              fontFamily: "var(--font-v2-display)",
              fontSize: "36px",
              fontWeight: 800,
              lineHeight: 1,
              color: "var(--color-v2-ink-100)",
            }}
          >
            {count}
            {count === MAX_CHILDREN ? "+" : ""}
          </span>
        </div>
        <input
          type="range"
          className="v2-range"
          min={1}
          max={MAX_CHILDREN}
          step={1}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          style={{ ["--pct" as string]: `${countPct}%` } as CSSProperties}
          aria-label={t("childrenCountLabel")}
        />
        <div style={endpointsStyle}>
          <span>1</span>
          <span>{MAX_CHILDREN}+</span>
        </div>
      </div>

      {/* --- Карточка на каждого ребёнка --- */}
      {items.map((child, i) => (
        <div key={i} style={childCardStyle}>
          <div
            style={{
              fontFamily: "var(--font-v2-body)",
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--color-v2-ink-300)",
              marginBottom: "10px",
            }}
          >
            {t("childCardTitle", { n: i + 1 })}
          </div>

          {/* Пол — сегментированный переключатель (опционально) */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
            {(["boy", "girl"] as const).map((g) => {
              const selected = child.gender === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => patch(i, { gender: selected ? null : g })}
                  style={pillStyle(selected)}
                >
                  {g === "boy" ? t("childGenderBoy") : t("childGenderGirl")}
                </button>
              );
            })}
          </div>

          {/* Возраст — «не указано» до касания (unset-required) */}
          <RangeSlider
            min={AGE_MIN}
            max={AGE_MAX}
            mid={AGE_MID}
            value={child.age ?? AGE_MID}
            isSet={child.age !== null}
            onChange={(v, set) => patch(i, { age: set ? v : null })}
            unit={t("childAgeUnit")}
            notSetLabel={t("childAgePrompt")}
            clearLabel={t("clearValue")}
          />
        </div>
      ))}
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1.5px solid var(--color-v2-ink-500)",
  borderRadius: "var(--v2-radius-md)",
  padding: "18px 18px 14px",
  marginBottom: "16px",
};

const childCardStyle: CSSProperties = {
  background: "var(--color-v2-chip)",
  border: "1px solid var(--color-v2-ink-500)",
  borderRadius: "var(--v2-radius-md)",
  padding: "14px 14px 12px",
  marginBottom: "12px",
};

const endpointsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: "10px",
  fontFamily: "var(--font-v2-body)",
  fontSize: "12px",
  color: "var(--color-v2-ink-400)",
};

function pillStyle(selected: boolean): CSSProperties {
  return {
    flex: 1,
    padding: "11px 0",
    fontFamily: "var(--font-v2-body)",
    fontSize: "14px",
    fontWeight: 600,
    color: selected ? "#ffffff" : "var(--color-v2-ink-300)",
    background: selected ? "var(--color-v2-accent)" : "#ffffff",
    border: `1.5px solid ${selected ? "var(--color-v2-accent)" : "var(--color-v2-ink-500)"}`,
    borderRadius: "var(--v2-radius-md)",
    cursor: "pointer",
    transition: "all 0.15s ease",
  };
}
