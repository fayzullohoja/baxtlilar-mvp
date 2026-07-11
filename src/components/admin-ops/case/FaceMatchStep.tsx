"use client";
import { useState } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";

// QZ-5/SG-08: результат ручной сверки лица — персистится в case_events как
// аудит-доказательство «сверка проводилась» (KVKK/спор). Раньше испарялся.
export type FaceMatchResult = {
  face_selfie_matches: boolean;
  liveness_ok: boolean;
  age_matches: boolean;
};

export function FaceMatchStep({
  selfieUrl,
  passportUrl,
  onBack,
  onConfirm,
}: {
  selfieUrl: string | null;
  passportUrl: string | null;
  onBack: () => void;
  onConfirm: (result: FaceMatchResult) => void;
}) {
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [c3, setC3] = useState(false);
  const all = c1 && c2 && c3;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="Селфи" url={selfieUrl} />
        <Panel title="Фото в паспорте" url={passportUrl} />
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 16,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          background: ADMIN.surface,
        }}
      >
        <div
          style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}
        >
          Подтверди вручную:
        </div>
        <CheckRow checked={c1} onChange={setC1}>
          Лицо на селфи совпадает с фото в паспорте
        </CheckRow>
        <CheckRow checked={c2} onChange={setC2}>
          Это живой человек (не фото фотографии, не дипфейк)
        </CheckRow>
        <CheckRow checked={c3} onChange={setC3}>
          Возраст визуально соответствует дате рождения
        </CheckRow>
      </div>

      <div
        style={{
          marginTop: 24,
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <Button onClick={onBack}>← Назад</Button>
        <Button
          variant="primary"
          disabled={!all}
          onClick={() =>
            onConfirm({ face_selfie_matches: c1, liveness_ok: c2, age_matches: c3 })
          }
        >
          → Решение
        </Button>
      </div>
    </div>
  );
}

function Panel({ title, url }: { title: string; url: string | null }) {
  return (
    <div
      style={{
        border: `1px solid ${ADMIN.border}`,
        borderRadius: 8,
        background: ADMIN.surface,
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: ADMIN.ink500,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={title}
          style={{ width: "100%", borderRadius: 4 }}
        />
      ) : (
        <div style={{ color: ADMIN.ink500 }}>нет</div>
      )}
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 0",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}
