"use client";
import { useState } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";

export function PassportViewer({
  passportUrl,
  selfieUrl,
  onNext,
}: {
  passportUrl: string | null;
  selfieUrl: string | null;
  onNext: () => void;
}) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <ImagePanel title="Паспорт" url={passportUrl} />
        <ImagePanel title="Селфи" url={selfieUrl} />
      </div>
      <div
        style={{
          marginTop: 24,
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <Button variant="primary" onClick={onNext}>
          → Шаг 2: ввести паспортные данные
        </Button>
      </div>
    </div>
  );
}

function ImagePanel({ title, url }: { title: string; url: string | null }) {
  const [scale, setScale] = useState(1);
  const [rot, setRot] = useState(0);

  if (!url) {
    return (
      <div
        style={{
          padding: 24,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          color: ADMIN.ink500,
          fontSize: 13,
        }}
      >
        {title}: не загружено
      </div>
    );
  }

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
          display: "flex",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: ADMIN.ink500,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {title}
        </div>
        <div style={{ flex: 1 }} />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setScale((s) => Math.max(0.5, s / 1.2))}
        >
          −
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setScale((s) => Math.min(4, s * 1.2))}
        >
          +
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setRot((r) => (r + 90) % 360)}
        >
          ⟳
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setScale(1);
            setRot(0);
          }}
        >
          1:1
        </Button>
      </div>
      <div
        style={{
          overflow: "auto",
          maxHeight: 460,
          background: "#0d0d0d",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={title}
          style={{
            transform: `scale(${scale}) rotate(${rot}deg)`,
            transformOrigin: "center",
            transition: "transform 0.12s ease",
            maxWidth: "100%",
          }}
        />
      </div>
    </div>
  );
}
