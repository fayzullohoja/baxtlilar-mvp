"use client";
import { ADMIN } from "@/lib/admin/admin-tokens";

export function ReasonPicker({
  templates,
  selectedCode,
  customText,
  onSelectCode,
  onCustomTextChange,
}: {
  templates: { code: string; text: string }[];
  selectedCode: string;
  customText: string;
  onSelectCode: (code: string) => void;
  onCustomTextChange: (text: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {templates.length > 0 ? (
        <select
          style={{
            height: 32,
            padding: "0 10px",
            borderRadius: 4,
            border: `1px solid ${ADMIN.border}`,
            fontFamily: ADMIN.fontSans,
            fontSize: 13,
          }}
          value={selectedCode}
          onChange={(e) => {
            const code = e.target.value;
            onSelectCode(code);
            const tpl = templates.find((t) => t.code === code);
            if (tpl) onCustomTextChange(tpl.text);
          }}
        >
          {templates.map((t) => (
            <option key={t.code} value={t.code}>
              {t.text}
            </option>
          ))}
        </select>
      ) : null}
      <textarea
        rows={2}
        value={customText}
        onChange={(e) => onCustomTextChange(e.target.value)}
        placeholder="Причина (увидит клиент)"
        style={{
          padding: 10,
          borderRadius: 4,
          border: `1px solid ${ADMIN.border}`,
          fontFamily: ADMIN.fontSans,
          fontSize: 13,
          resize: "vertical",
        }}
      />
    </div>
  );
}
