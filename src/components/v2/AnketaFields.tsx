"use client";

import {
  useId,
  type ReactNode,
  type ChangeEventHandler,
  type CSSProperties,
} from "react";
import { useTranslations } from "next-intl";
import { CITY_GROUPS } from "@/lib/profile/cities";
import type { Opt } from "@/lib/profile/options";
import { useOptLabel } from "./useOptLabel";
import type { Gender } from "@/lib/profile/gender-wording";

/**
 * V2 Anketa Fields — form primitives.
 *
 * V3 Visual DNA (Baxtlilar.dc.html):
 *   - Инпуты — белые боксы с hairline-бортом (#F0DDD0), radius 14.
 *   - Label — 13px / 700 / сливовый secondary (#5A4A5E), sentence case.
 *   - Пилюли выбора — заливка гранатовым при выборе; чипы — градиент.
 */

// =============================================================================
// Field wrapper
// =============================================================================

/**
 * Атрибут-маркер поля с ошибкой — по нему scrollToFirstError() находит первую
 * невалидную секцию (без per-field ref'ов). Ставится на внешний div Field при error.
 */
export const ANKETA_ERROR_ATTR = "data-anketa-error";

/** Прокрутить к первому полю с ошибкой + сфокусировать его контрол. Вызывать
 *  ПОСЛЕ setState (в requestAnimationFrame), чтобы data-атрибут уже отрендерился. */
export function scrollToFirstError(): void {
  if (typeof document === "undefined") return;
  const el = document.querySelector(`[${ANKETA_ERROR_ATTR}="1"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const ctrl = el.querySelector<HTMLElement>("input, textarea, select, button");
  ctrl?.focus({ preventScroll: true });
}

export function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  /** §2 P0: текст ошибки под полем + красная рамка (ring) вокруг контрола. */
  error?: string;
  children: ReactNode;
}) {
  // a11y: раньше htmlFor указывал на <div> — не labelable, связи label↔контрол
  // фактически не было. Дети здесь разнородны (input/textarea/select/пилюли/чипы),
  // поэтому связываем через role="group" + aria-labelledby: работает для любого
  // типа контрола и не требует правок всех 14 форм анкеты.
  const id = useId();
  const labelId = `${id}-label`;
  const msgId = `${id}-msg`;
  const hasError = !!error;
  return (
    <div style={{ marginBottom: "22px" }} {...(hasError ? { [ANKETA_ERROR_ATTR]: "1" } : {})}>
      <label
        id={labelId}
        style={{
          display: "block",
          fontSize: "13px",
          fontWeight: 700,
          color: "var(--color-v2-ink-300)",
          fontFamily: "var(--font-v2-body)",
          marginBottom: "7px",
        }}
      >
        {label}
        {required ? <span style={{ color: "var(--color-v2-accent)", marginLeft: "4px" }}>*</span> : null}
      </label>
      {/* Группа контрола: aria-labelledby связывает с подписью, aria-describedby -
          с ошибкой/подсказкой, aria-invalid помечает невалидное состояние.
          §2 P0: красная рамка = ring вокруг wrapper'а (child-type-agnostic - работает
          для input/textarea/select-пилюль/chips/слайдеров одинаково). */}
      <div
        id={id}
        role="group"
        aria-labelledby={labelId}
        aria-describedby={hasError || hint ? msgId : undefined}
        style={
          hasError
            ? {
                borderRadius: "var(--v2-radius-md)",
                boxShadow: "0 0 0 2px var(--color-v2-danger)",
              }
            : undefined
        }
      >
        {children}
      </div>
      {hasError ? (
        <div
          id={msgId}
          role="alert"
          style={{
            fontSize: "12.5px",
            color: "var(--color-v2-danger)",
            fontWeight: 600,
            fontFamily: "var(--font-v2-body)",
            marginTop: "7px",
            lineHeight: "1.45",
          }}
        >
          {error}
        </div>
      ) : hint ? (
        <div
          id={msgId}
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
  boxSizing: "border-box",
  padding: "14px 16px",
  fontFamily: "var(--font-v2-body)",
  fontSize: "15px",
  lineHeight: "1.4",
  color: "var(--color-v2-ink-100)",
  background: "#ffffff",
  border: "1.5px solid var(--color-v2-ink-500)",
  borderRadius: "var(--v2-radius-md)",
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
  // §2 P0: счётчик символов. Рендерит сама примитива из maxLength — нулевой churn
  // по формам. Краснеет у лимита (осталось ≤10) как мягкий сигнал.
  const near = maxLength !== undefined && maxLength - value.length <= 10;
  return (
    <div>
      <textarea
        value={value}
        onChange={onChange}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        style={{
          ...inputBaseStyle,
          resize: "vertical",
          minHeight: "96px",
          lineHeight: "1.5",
        }}
      />
      {maxLength !== undefined ? (
        <div
          style={{
            fontSize: "11.5px",
            textAlign: "right",
            marginTop: "4px",
            fontVariantNumeric: "tabular-nums",
            color: near ? "var(--color-v2-danger)" : "var(--color-v2-ink-400)",
            fontFamily: "var(--font-v2-body)",
          }}
        >
          {value.length}/{maxLength}
        </div>
      ) : null}
    </div>
  );
}

// =============================================================================
// Select (radio-пилюли для коротких списков, native select для длинных)
// =============================================================================

export function Select({
  options,
  value,
  onChange,
  locale = "ru",
  placeholder,
  gender,
}: {
  options: Opt[];
  value: string;
  onChange: (v: string) => void;
  locale?: string;
  placeholder?: string;
  /** Пол юзера — включает гендерный вариант лейбла (Options.<G>.<v>__m|f). */
  gender?: Gender | null;
}) {
  const { label: optText } = useOptLabel(locale, gender);
  const useRadio = options.length <= 4;

  if (useRadio) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
        {options.map((opt) => {
          const label = optText(opt);
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                width: "100%",
                padding: "13px 16px",
                textAlign: "left",
                fontFamily: "var(--font-v2-body)",
                fontSize: "14px",
                fontWeight: 700,
                color: selected ? "#ffffff" : "var(--color-v2-ink-300)",
                background: selected ? "var(--color-v2-accent)" : "#ffffff",
                border: `1.5px solid ${selected ? "var(--color-v2-accent)" : "var(--color-v2-ink-500)"}`,
                borderRadius: "var(--v2-radius-md)",
                cursor: "pointer",
                transition: "all 0.15s ease",
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
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%238a7a8e' d='M1 1l5 5 5-5'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 16px center",
        paddingRight: "40px",
      }}
    >
      <option value="" disabled>
        {placeholder ?? (locale === "uz" ? "Tanlang…" : "Выберите…")}
      </option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {optText(opt)}
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
  gender,
}: {
  options: Opt[];
  selected: string[];
  onToggle: (v: string) => void;
  max?: number;
  locale?: string;
  /** Пол юзера — включает гендерный вариант лейбла (Options.<G>.<v>__m|f). */
  gender?: Gender | null;
}) {
  const { label: optText } = useOptLabel(locale, gender);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "9px",
        marginTop: "8px",
      }}
    >
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        const atMax = max !== undefined && selected.length >= max && !isSelected;
        const label = optText(opt);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => !atMax && onToggle(opt.value)}
            disabled={atMax}
            style={{
              padding: "10px 16px",
              fontFamily: "var(--font-v2-body)",
              fontSize: "13.5px",
              fontWeight: 600,
              color: isSelected ? "#ffffff" : "var(--color-v2-chip-ink)",
              background: isSelected ? "var(--v2-grad-primary)" : "var(--color-v2-chip)",
              border: `1.5px solid ${isSelected ? "transparent" : "var(--color-v2-ink-500)"}`,
              borderRadius: "999px",
              cursor: atMax ? "not-allowed" : "pointer",
              opacity: atMax ? 0.35 : 1,
              transition: "all 0.15s ease",
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
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%238a7a8e' d='M1 1l5 5 5-5'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 16px center",
        paddingRight: "40px",
      }}
    >
      <option value="" disabled>
        {placeholder ?? (locale === "uz" ? "Shahar tanlang…" : "Выберите город…")}
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
                fontWeight: 800,
                color: selected ? "#ffffff" : "var(--color-v2-ink-300)",
                background: selected ? "var(--color-v2-accent)" : "#ffffff",
                border: `1.5px solid ${selected ? "var(--color-v2-accent)" : "var(--color-v2-ink-500)"}`,
                borderRadius: "var(--v2-radius-md)",
                cursor: "pointer",
                transition: "all 0.15s ease",
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

// =============================================================================
// RangeSlider — интерактивный ползунок (Экран 2: рост / вес)
// =============================================================================

/**
 * Опциональный слайдер: большая крупная цифра + янтарный ползунок.
 * Пока не тронут — состояние «не указано» (приглушённый трек, палец по центру).
 * Первое движение → isSet=true; «Не указывать» → сбрасывает обратно.
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  isSet,
  onChange,
  mid,
  unit,
  notSetLabel,
  clearLabel,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  isSet: boolean;
  onChange: (value: number, isSet: boolean) => void;
  /** Позиция пальца в состоянии «не указано». */
  mid: number;
  unit: string;
  notSetLabel: string;
  clearLabel: string;
}) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1.5px solid var(--color-v2-ink-500)",
        borderRadius: "var(--v2-radius-md)",
        padding: "18px 18px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          minHeight: "38px",
          marginBottom: "14px",
        }}
      >
        {isSet ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span
              style={{
                fontFamily: "var(--font-v2-display)",
                fontSize: "36px",
                fontWeight: 800,
                lineHeight: 1,
                color: "var(--color-v2-ink-100)",
              }}
            >
              {value}
            </span>
            <span
              style={{
                fontFamily: "var(--font-v2-body)",
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--color-v2-ink-400)",
              }}
            >
              {unit}
            </span>
          </div>
        ) : (
          <span
            style={{
              fontFamily: "var(--font-v2-body)",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--color-v2-ink-400)",
            }}
          >
            {notSetLabel}
          </span>
        )}

        {isSet ? (
          <button
            type="button"
            onClick={() => onChange(mid, false)}
            style={{
              background: "none",
              border: "none",
              padding: "4px 0",
              cursor: "pointer",
              fontFamily: "var(--font-v2-body)",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--color-v2-ink-400)",
            }}
          >
            {clearLabel}
          </button>
        ) : null}
      </div>

      <input
        type="range"
        className={isSet ? "v2-range" : "v2-range v2-range-off"}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value), true)}
        style={{ "--pct": `${pct}%` } as CSSProperties}
        aria-valuetext={isSet ? `${value} ${unit}` : notSetLabel}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "10px",
          fontFamily: "var(--font-v2-body)",
          fontSize: "12px",
          color: "var(--color-v2-ink-400)",
        }}
      >
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// =============================================================================
// DualRangeSlider — диапазон «от…до» с двумя пальцами (возраст/рост партнёра)
// =============================================================================

/**
 * Один слайдер, два пальца — диапазон minValue…maxValue. «Не указано» до
 * первого касания (isSet). clearable=false — обязательное поле (без сброса).
 */
export function DualRangeSlider({
  min,
  max,
  step = 1,
  minValue,
  maxValue,
  isSet,
  onChange,
  unit,
  notSetLabel,
  clearLabel,
  clearable = true,
}: {
  min: number;
  max: number;
  step?: number;
  minValue: number;
  maxValue: number;
  isSet: boolean;
  onChange: (minV: number, maxV: number, isSet: boolean) => void;
  unit: string;
  notSetLabel: string;
  clearLabel: string;
  clearable?: boolean;
}) {
  // 2026-07-12 (i18n fix): «от»/«до» в aria-подписях были захардкожены по-русски
  // (uz/en/tr скринридер слышал русский). Берём из namespace Anketa.
  const t = useTranslations("Anketa");
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const lo = clamp(minValue);
  const hi = clamp(maxValue);
  const minPct = ((lo - min) / (max - min)) * 100;
  const maxPct = ((hi - min) / (max - min)) * 100;

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1.5px solid var(--color-v2-ink-500)",
        borderRadius: "var(--v2-radius-md)",
        padding: "18px 18px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          minHeight: "38px",
          marginBottom: "16px",
        }}
      >
        {isSet ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span
              style={{
                fontFamily: "var(--font-v2-display)",
                fontSize: "30px",
                fontWeight: 800,
                lineHeight: 1,
                color: "var(--color-v2-ink-100)",
              }}
            >
              {lo} – {hi}
            </span>
            <span
              style={{
                fontFamily: "var(--font-v2-body)",
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--color-v2-ink-400)",
              }}
            >
              {unit}
            </span>
          </div>
        ) : (
          <span
            style={{
              fontFamily: "var(--font-v2-body)",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--color-v2-ink-400)",
            }}
          >
            {notSetLabel}
          </span>
        )}

        {isSet && clearable ? (
          <button
            type="button"
            onClick={() => onChange(minValue, maxValue, false)}
            style={{
              background: "none",
              border: "none",
              padding: "4px 0",
              cursor: "pointer",
              fontFamily: "var(--font-v2-body)",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--color-v2-ink-400)",
            }}
          >
            {clearLabel}
          </button>
        ) : null}
      </div>

      <div className="v2-dual">
        <div className="v2-dual-track" />
        <div
          className={isSet ? "v2-dual-fill" : "v2-dual-fill v2-dual-fill-off"}
          style={{ left: `${minPct}%`, width: `${Math.max(0, maxPct - minPct)}%` }}
        />
        <input
          type="range"
          className={isSet ? "v2-dual-input" : "v2-dual-input v2-dual-input-off"}
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), hi - step);
            onChange(clamp(v), hi, true);
          }}
          style={{ zIndex: 3 }}
          aria-label={`${notSetLabel} — ${t("rangeFrom")}`}
        />
        <input
          type="range"
          className={isSet ? "v2-dual-input" : "v2-dual-input v2-dual-input-off"}
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), lo + step);
            onChange(lo, clamp(v), true);
          }}
          style={{ zIndex: 2 }}
          aria-label={`${notSetLabel} — ${t("rangeTo")}`}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "10px",
          fontFamily: "var(--font-v2-body)",
          fontSize: "12px",
          color: "var(--color-v2-ink-400)",
        }}
      >
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
