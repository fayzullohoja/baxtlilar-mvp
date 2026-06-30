"use client";

import { useTranslations } from "next-intl";
import type { ReactNode, ChangeEventHandler } from "react";
import { CITY_GROUPS } from "@/lib/profile/cities";
import type { Opt } from "@/lib/profile/options";

/**
 * V2 Anketa Fields — editorial-style form primitives.
 *
 * Visual DNA:
 *   - Без border-box. Только underline под label + content.
 *   - Без яркого фокусного outline — серый underline становится ink-100.
 *   - Минимум контейнеров: label сверху, input — отдельная строка.
 */

// =============================================================================
// Field wrapper
// =============================================================================

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: "32px" }}>
      <label
        style={{
          display: "block",
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--color-v2-ink-400)",
          fontFamily: "var(--font-v2-body)",
          marginBottom: "10px",
        }}
      >
        {label}
        {required ? <span style={{ color: "var(--color-v2-ink-300)", marginLeft: "4px" }}>*</span> : null}
      </label>
      {children}
      {hint ? (
        <div
          style={{
            fontSize: "12px",
            color: "var(--color-v2-ink-400)",
            fontFamily: "var(--font-v2-body)",
            marginTop: "6px",
            lineHeight: "1.45",
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

// =============================================================================
// TextInput / TextArea
// =============================================================================

const inputBaseStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 0 12px",
  fontFamily: "var(--font-v2-body)",
  fontSize: "17px",
  lineHeight: "1.4",
  color: "var(--color-v2-ink-100)",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--color-v2-ink-500)",
  borderRadius: 0,
  outline: "none",
};

export function TextInput({
  value,
  onChange,
  type = "text",
  maxLength,
  placeholder,
}: {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  type?: string;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      maxLength={maxLength}
      placeholder={placeholder}
      style={inputBaseStyle}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 4,
  maxLength,
  placeholder,
}: {
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      rows={rows}
      maxLength={maxLength}
      placeholder={placeholder}
      style={{
        ...inputBaseStyle,
        padding: "10px 0 12px",
        resize: "vertical",
        minHeight: "84px",
      }}
    />
  );
}

// =============================================================================
// Select (radio-style для коротких списков, native select для длинных)
// =============================================================================

export function Select({
  options,
  value,
  onChange,
  locale = "ru",
  placeholder,
}: {
  options: Opt[];
  value: string;
  onChange: (v: string) => void;
  locale?: string;
  placeholder?: string;
}) {
  const useRadio = options.length <= 4;

  if (useRadio) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
        {options.map((opt) => {
          const label = locale === "uz" ? opt.uz : opt.ru;
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                width: "100%",
                padding: "14px 16px",
                textAlign: "left",
                fontFamily: "var(--font-v2-body)",
                fontSize: "15px",
                color: selected ? "var(--color-v2-paper)" : "var(--color-v2-ink-100)",
                background: selected ? "var(--color-v2-ink-100)" : "transparent",
                border: `1px solid ${selected ? "var(--color-v2-ink-100)" : "var(--color-v2-ink-500)"}`,
                borderRadius: "var(--v2-radius-md)",
                cursor: "pointer",
                transition: "all 0.12s ease",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...inputBaseStyle,
        appearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23656468' d='M1 1l5 5 5-5'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0 center",
        paddingRight: "20px",
      }}
    >
      <option value="" disabled>
        {placeholder ?? (locale === "uz" ? "Tanlang…" : "Выбери…")}
      </option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {locale === "uz" ? opt.uz : opt.ru}
        </option>
      ))}
    </select>
  );
}

// =============================================================================
// Chips (multiselect)
// =============================================================================

export function Chips({
  options,
  selected,
  onToggle,
  max,
  locale = "ru",
}: {
  options: Opt[];
  selected: string[];
  onToggle: (v: string) => void;
  max?: number;
  locale?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        marginTop: "8px",
      }}
    >
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        const atMax = max !== undefined && selected.length >= max && !isSelected;
        const label = locale === "uz" ? opt.uz : opt.ru;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => !atMax && onToggle(opt.value)}
            disabled={atMax}
            style={{
              padding: "8px 14px",
              fontFamily: "var(--font-v2-body)",
              fontSize: "13px",
              color: isSelected ? "var(--color-v2-paper)" : "var(--color-v2-ink-200)",
              background: isSelected ? "var(--color-v2-ink-100)" : "transparent",
              border: `1px solid ${isSelected ? "var(--color-v2-ink-100)" : "var(--color-v2-ink-500)"}`,
              borderRadius: "999px",
              cursor: atMax ? "not-allowed" : "pointer",
              opacity: atMax ? 0.3 : 1,
              transition: "all 0.12s ease",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// CitySelect (search-by-typing, native select)
// =============================================================================

export function CitySelect({
  value,
  onChange,
  placeholder,
  locale = "ru",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  locale?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...inputBaseStyle,
        appearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23656468' d='M1 1l5 5 5-5'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0 center",
        paddingRight: "20px",
      }}
    >
      <option value="" disabled>
        {placeholder ?? (locale === "uz" ? "Shahar tanlang…" : "Выбери город…")}
      </option>
      {CITY_GROUPS.map((group) => (
        <optgroup
          key={group.region.ru}
          label={locale === "uz" ? group.region.uz : group.region.ru}
        >
          {group.cities.map((c) => (
            <option key={c.value} value={c.value}>
              {locale === "uz" ? c.uz : c.ru}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// =============================================================================
// Number input (Range select для religion_importance)
// =============================================================================

export function NumberScale({
  min,
  max,
  value,
  onChange,
  labels,
}: {
  min: number;
  max: number;
  value: string;
  onChange: (v: string) => void;
  /** Подпись под каждым числом, например ["не важна", "очень важна"] для min/max. */
  labels?: { min: string; max: string };
}) {
  const items: number[] = [];
  for (let i = min; i <= max; i++) items.push(i);
  return (
    <div style={{ marginTop: "8px" }}>
      <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
        {items.map((n) => {
          const selected = value === String(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              style={{
                flex: 1,
                padding: "12px 0",
                fontFamily: "var(--font-v2-display)",
                fontSize: "18px",
                color: selected ? "var(--color-v2-paper)" : "var(--color-v2-ink-200)",
                background: selected ? "var(--color-v2-ink-100)" : "transparent",
                border: `1px solid ${selected ? "var(--color-v2-ink-100)" : "var(--color-v2-ink-500)"}`,
                borderRadius: "var(--v2-radius-md)",
                cursor: "pointer",
                transition: "all 0.12s ease",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      {labels ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "var(--color-v2-ink-400)",
            fontFamily: "var(--font-v2-body)",
          }}
        >
          <span>{labels.min}</span>
          <span>{labels.max}</span>
        </div>
      ) : null}
    </div>
  );
}
