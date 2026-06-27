"use client";
import type { ReactNode } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";

export interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  help?: string;
  error?: string | null;
  warning?: string | null;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  required,
  help,
  error,
  warning,
  children,
}: FieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: ADMIN.ink500,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
        {required ? (
          <span style={{ color: ADMIN.danger, marginLeft: 4 }}>*</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <div style={{ fontSize: 12, color: ADMIN.danger }}>{error}</div>
      ) : warning ? (
        <div style={{ fontSize: 12, color: ADMIN.warning }}>{warning}</div>
      ) : help ? (
        <div style={{ fontSize: 12, color: ADMIN.ink500 }}>{help}</div>
      ) : null}
    </div>
  );
}
