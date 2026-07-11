"use client";
import { ADMIN } from "@/lib/admin/admin-tokens";

// Контролируемый инпут: дебаунс/фетч владеет ClientsScreen (ему нужны q+offset
// для «показать ещё» и он же тянет активные фильтры директории в запрос).
export function SearchBar({
  value,
  onChange,
  busy,
}: {
  value: string;
  onChange: (q: string) => void;
  busy: boolean;
}) {
  return (
    <div style={{ position: "relative", maxWidth: 480 }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ФИО, ПИНФЛ, паспорт, телефон, @username…"
        autoFocus
        style={{
          width: "100%",
          height: 36,
          padding: "0 12px",
          fontSize: 14,
          fontFamily: ADMIN.fontSans,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 6,
          background: ADMIN.surface,
          outline: "none",
        }}
      />
      {busy ? (
        <div
          style={{
            position: "absolute",
            right: 12,
            top: 11,
            fontSize: 11,
            color: ADMIN.ink500,
          }}
        >
          …
        </div>
      ) : null}
    </div>
  );
}
