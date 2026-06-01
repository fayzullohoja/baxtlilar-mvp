"use client";

import { useLocale } from "next-intl";
import type { Opt } from "@/lib/profile/options";
import { CITY_GROUPS } from "@/lib/profile/cities";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-baxt-navy mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-baxt-border bg-white px-3 py-2.5 text-baxt-navy outline-none focus:border-baxt-coral";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={inputCls + " min-h-24 resize-y"} />;
}

export function Select({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: Opt[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const locale = useLocale();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">{placeholder ?? "—"}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {locale === "uz" ? o.uz : o.ru}
        </option>
      ))}
    </select>
  );
}

/** Выбор города Узбекистана: один дропдаун, города сгруппированы по областям (optgroup). */
export function CitySelect({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const locale = useLocale();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">{placeholder ?? "—"}</option>
      {CITY_GROUPS.map((g) => (
        <optgroup key={g.region.ru} label={locale === "uz" ? g.region.uz : g.region.ru}>
          {g.cities.map((c) => (
            <option key={c.value} value={c.value}>
              {locale === "uz" ? c.uz : c.ru}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Чипы мультивыбора с лимитом (для ценностей: 1–3). */
export function Chips({
  options,
  selected,
  onToggle,
  max,
}: {
  options: Opt[];
  selected: string[];
  onToggle: (v: string) => void;
  max: number;
}) {
  const locale = useLocale();
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.value);
        const disabled = !on && selected.length >= max;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(o.value)}
            className={
              "px-3 py-1.5 rounded-full text-sm border transition-colors " +
              (on
                ? "bg-baxt-coral text-white border-baxt-coral"
                : disabled
                  ? "bg-white text-baxt-muted border-baxt-border opacity-40"
                  : "bg-white text-baxt-navy border-baxt-border hover:border-baxt-coral")
            }
          >
            {locale === "uz" ? o.uz : o.ru}
          </button>
        );
      })}
    </div>
  );
}
