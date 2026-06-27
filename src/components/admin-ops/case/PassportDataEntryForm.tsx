"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Field } from "@/components/admin-ops/Field";
import { Button } from "@/components/admin-ops/Button";
import { ADMIN } from "@/lib/admin/admin-tokens";
import {
  validatePassportPayload,
  type PassportPayload,
  type FieldError,
} from "@/lib/admin/passport-validation";

const inputStyle = {
  height: 32,
  width: "100%",
  padding: "0 10px",
  fontFamily: ADMIN.fontSans,
  fontSize: 13,
  background: ADMIN.surface,
  color: ADMIN.ink900,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 4,
  outline: "none",
} as const;

const inputMonoStyle = { ...inputStyle, fontFamily: ADMIN.fontMono };

export type PassportFormProps = {
  caseId: string;
  initialPayload: Partial<PassportPayload>;
  onProceed: (payload: PassportPayload) => void;
};

export function PassportDataEntryForm({
  caseId,
  initialPayload,
  onProceed,
}: PassportFormProps) {
  const [p, setP] = useState<Partial<PassportPayload>>(initialPayload);
  const [savingState, setSavingState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const errors = useMemo(() => validatePassportPayload(p), [p]);
  const errorByField = useMemo(() => {
    const m = new Map<string, FieldError>();
    for (const e of errors) m.set(String(e.field), e);
    return m;
  }, [errors]);
  const blockerCount = errors.filter((e) => e.severity === "block").length;

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (Object.keys(p).length === 0) return;
    saveTimer.current = setTimeout(async () => {
      setSavingState("saving");
      try {
        const r = await fetch(`/api/admin/cases/${caseId}/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: p }),
        });
        const d = await r.json();
        setSavingState(d.ok ? "saved" : "error");
      } catch {
        setSavingState("error");
      }
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [p, caseId]);

  function set<K extends keyof PassportPayload>(
    k: K,
    v: PassportPayload[K] | undefined,
  ) {
    setP((prev) => ({ ...prev, [k]: v }));
  }

  function fieldOf(k: keyof PassportPayload) {
    const e = errorByField.get(String(k));
    return {
      error: e?.severity === "block" ? e.message : null,
      warning: e?.severity === "warn" ? e.message : null,
    };
  }

  return (
    <div>
      <SectionTitle>ФИО</SectionTitle>
      <FormGrid>
        <Field label="Фамилия" required {...fieldOf("last_name")}>
          <input
            style={inputStyle}
            value={p.last_name ?? ""}
            onChange={(e) => set("last_name", e.target.value)}
          />
        </Field>
        <Field label="Имя" required {...fieldOf("first_name")}>
          <input
            style={inputStyle}
            value={p.first_name ?? ""}
            onChange={(e) => set("first_name", e.target.value)}
          />
        </Field>
        <Field label="Отчество" {...fieldOf("middle_name")}>
          <input
            style={inputStyle}
            value={p.middle_name ?? ""}
            onChange={(e) =>
              set("middle_name", e.target.value || undefined)
            }
          />
        </Field>
      </FormGrid>

      <SectionTitle>Документ</SectionTitle>
      <FormGrid>
        <Field label="Серия" required {...fieldOf("passport_series")}>
          <input
            style={inputMonoStyle}
            maxLength={2}
            value={p.passport_series ?? ""}
            onChange={(e) =>
              set("passport_series", e.target.value.toUpperCase())
            }
            placeholder="AA"
          />
        </Field>
        <Field label="Номер" required {...fieldOf("passport_number")}>
          <input
            style={inputMonoStyle}
            maxLength={7}
            value={p.passport_number ?? ""}
            onChange={(e) =>
              set("passport_number", e.target.value.replace(/\D/g, ""))
            }
            placeholder="1234567"
          />
        </Field>
        <Field label="ПИНФЛ" required {...fieldOf("pinfl")}>
          <input
            style={inputMonoStyle}
            maxLength={14}
            value={p.pinfl ?? ""}
            onChange={(e) =>
              set("pinfl", e.target.value.replace(/\D/g, ""))
            }
            placeholder="14 цифр"
          />
        </Field>
        <Field label="Кем выдан" required {...fieldOf("issued_by")}>
          <input
            style={inputStyle}
            value={p.issued_by ?? ""}
            onChange={(e) => set("issued_by", e.target.value)}
          />
        </Field>
        <Field label="Дата выдачи" required {...fieldOf("issued_at")}>
          <input
            type="date"
            style={inputStyle}
            value={p.issued_at ?? ""}
            onChange={(e) => set("issued_at", e.target.value)}
          />
        </Field>
        <Field label="Срок действия" required {...fieldOf("expires_at")}>
          <input
            type="date"
            style={inputStyle}
            value={p.expires_at ?? ""}
            onChange={(e) => set("expires_at", e.target.value)}
          />
        </Field>
      </FormGrid>

      <SectionTitle>Личные данные</SectionTitle>
      <FormGrid>
        <Field label="Дата рождения" required {...fieldOf("birth_date")}>
          <input
            type="date"
            style={inputStyle}
            value={p.birth_date ?? ""}
            onChange={(e) => set("birth_date", e.target.value)}
          />
        </Field>
        <Field label="Пол" required {...fieldOf("gender")}>
          <div
            style={{
              display: "flex",
              gap: 12,
              height: 32,
              alignItems: "center",
            }}
          >
            <label style={{ fontSize: 13 }}>
              <input
                type="radio"
                name="gender"
                checked={p.gender === "M"}
                onChange={() => set("gender", "M")}
              />{" "}
              М
            </label>
            <label style={{ fontSize: 13 }}>
              <input
                type="radio"
                name="gender"
                checked={p.gender === "F"}
                onChange={() => set("gender", "F")}
              />{" "}
              Ж
            </label>
          </div>
        </Field>
        <Field label="Гражданство" required {...fieldOf("citizenship")}>
          <select
            style={inputStyle}
            value={p.citizenship ?? "UZ"}
            onChange={(e) => set("citizenship", e.target.value)}
          >
            <option value="UZ">UZ</option>
            <option value="RU">RU</option>
            <option value="KZ">KZ</option>
            <option value="OTHER">Другое</option>
          </select>
        </Field>
        <Field label="Место рождения" required {...fieldOf("birth_place")}>
          <input
            style={inputStyle}
            value={p.birth_place ?? ""}
            onChange={(e) => set("birth_place", e.target.value)}
          />
        </Field>
      </FormGrid>

      <SectionTitle>Адрес прописки</SectionTitle>
      <FormGrid>
        <Field label="Код области" required {...fieldOf("region_code")}>
          <input
            style={inputStyle}
            value={p.region_code ?? ""}
            onChange={(e) => set("region_code", e.target.value)}
            placeholder="UZ-TAS"
          />
        </Field>
        <Field label="Код района" required {...fieldOf("district_code")}>
          <input
            style={inputStyle}
            value={p.district_code ?? ""}
            onChange={(e) => set("district_code", e.target.value)}
            placeholder="UZ-TAS-YN"
          />
        </Field>
        <Field
          label="Населённый пункт"
          required
          {...fieldOf("locality")}
        >
          <input
            style={inputStyle}
            value={p.locality ?? ""}
            onChange={(e) => set("locality", e.target.value)}
          />
        </Field>
        <Field
          label="Улица + дом"
          required
          {...fieldOf("street_address")}
        >
          <input
            style={inputStyle}
            value={p.street_address ?? ""}
            onChange={(e) => set("street_address", e.target.value)}
          />
        </Field>
      </FormGrid>

      <div
        style={{
          marginTop: 24,
          padding: "12px 16px",
          background: ADMIN.surface,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 16,
          position: "sticky",
          bottom: 0,
        }}
      >
        <div style={{ fontSize: 12, color: ADMIN.ink500 }}>
          {blockerCount === 0
            ? "Все обязательные поля валидны"
            : `${blockerCount} ошибок`}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: ADMIN.ink300 }}>
          {savingState === "saving"
            ? "сохраняем…"
            : savingState === "saved"
              ? "автосохранено"
              : savingState === "error"
                ? "ошибка сохранения"
                : ""}
        </div>
        <Button
          variant="primary"
          disabled={blockerCount > 0}
          onClick={() => onProceed(p as PassportPayload)}
        >
          → Шаг 3: сверка лица
        </Button>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: ADMIN.ink500,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginTop: 20,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}
