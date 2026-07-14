"use client";
import { useState } from "react";
import { Button } from "@/components/admin-ops/Button";
import { ProfileEditor } from "./ProfileEditor";

/**
 * Клиент-обёртка над read-only ProfileTab: кнопка «Редактировать анкету»
 * (только при canEdit) переключает на форму ProfileEditor. Серверный
 * read-only рендер приходит как children.
 */
export function ProfileEditGate({
  userId,
  canEdit,
  values,
  children,
}: {
  userId: string;
  canEdit: boolean;
  values: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <ProfileEditor userId={userId} initial={values} onDone={() => setEditing(false)} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {canEdit ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Редактировать анкету
          </Button>
        </div>
      ) : null}
      {children}
    </div>
  );
}
