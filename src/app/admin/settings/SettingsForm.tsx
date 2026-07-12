"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";
import type { AdminSettings } from "@/lib/admin/settings";

export function SettingsForm({ initial }: { initial: AdminSettings }) {
  const router = useRouter();
  const [bannerOn, setBannerOn] = useState(initial.bannerOn);
  const [bannerText, setBannerText] = useState(initial.bannerText);
  const [slaWarnHours, setSlaWarnHours] = useState(String(initial.slaWarnHours));
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setState("idle");
    setError(null);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bannerOn,
          bannerText,
          slaWarnHours: Number(slaWarnHours),
        }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (d.ok) {
        setState("saved");
        router.refresh();
      } else {
        setState("error");
        setError(d.error ?? "error");
      }
    } catch {
      setState("error");
      setError("network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 560 }}>
      <div style={card}>
        <div style={cardLabel}>Баннер-объявление</div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 10 }}>
          <input type="checkbox" checked={bannerOn} onChange={(e) => setBannerOn(e.target.checked)} />
          Показывать баннер всем админам
        </label>
        <textarea
          value={bannerText}
          onChange={(e) => setBannerText(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Текст объявления (напр. «Плановые работы в 22:00»)…"
          style={{ ...input, height: "auto", padding: "8px 10px", resize: "vertical", width: "100%" }}
        />
      </div>

      <div style={card}>
        <div style={cardLabel}>SLA дашборда</div>
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          Подсвечивать «старейший кейс» после
          <input
            type="number"
            min={1}
            max={720}
            value={slaWarnHours}
            onChange={(e) => setSlaWarnHours(e.target.value)}
            style={{ ...input, width: 80 }}
          />
          часов
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button variant="primary" disabled={busy} onClick={save}>
          {busy ? "Сохраняем…" : "Сохранить"}
        </Button>
        {state === "saved" ? (
          <span style={{ fontSize: 13, color: ADMIN.ink500 }}>Сохранено ✓</span>
        ) : null}
        {state === "error" ? (
          <span style={{ fontSize: 13, color: ADMIN.danger }}>Ошибка: {error}</span>
        ) : null}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  padding: 16,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 8,
  background: ADMIN.surface,
};
const cardLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: ADMIN.ink500,
  marginBottom: 12,
};
const input: React.CSSProperties = {
  height: 32,
  padding: "0 10px",
  fontSize: 13,
  fontFamily: ADMIN.fontSans,
  background: ADMIN.surface,
  color: ADMIN.ink900,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 4,
  outline: "none",
};
