"use client";
import { useState } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { FEATURES, type Feature } from "@/lib/features/features";

// C-033: kill-switch панель. Каждая фича выключается независимо, мгновенно, без
// деплоя (POST /api/admin/features). Выключение = «функция недоступна для всех
// пользователей прямо сейчас». Действие логируется в admin_audit_log.
const LABELS: Record<Feature, { title: string; hint: string }> = {
  verification: { title: "Верификация", hint: "Приём документов и селфи на проверку" },
  matching: { title: "Подбор (матчинг)", hint: "Показ «подбора на сегодня» на главном" },
  interests: { title: "Интересы", hint: "Отправка новых интересов (приём уже отправленных не трогается)" },
  chat: { title: "Чат", hint: "Отправка сообщений (чтение остаётся доступным)" },
  payments: { title: "Платежи", hint: "Оплаты (точки входа ещё нет — флаг зарезервирован)" },
};

export function FeatureFlagsPanel({ initial }: { initial: Record<Feature, boolean> }) {
  const [flags, setFlags] = useState<Record<Feature, boolean>>(initial);
  const [busy, setBusy] = useState<Feature | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(feature: Feature, enabled: boolean) {
    setBusy(feature);
    setError(null);
    try {
      const r = await fetch("/api/admin/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, enabled }),
      });
      const d = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        flags?: Record<Feature, boolean>;
      };
      if (d.ok && d.flags) {
        setFlags(d.flags);
      } else {
        setError(d.error ?? "error");
      }
    } catch {
      setError("network");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={card}>
      <div style={cardLabel}>Kill switches — выключение функций без деплоя</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {FEATURES.map((f) => {
          const on = flags[f];
          return (
            <div key={f} style={row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: ADMIN.ink900 }}>
                  {LABELS[f].title}
                </div>
                <div style={{ fontSize: 12, color: ADMIN.ink500 }}>{LABELS[f].hint}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: on ? ADMIN.ink500 : ADMIN.danger,
                  }}
                >
                  {on ? "Включено" : "Выключено"}
                </span>
                <button
                  type="button"
                  disabled={busy === f}
                  onClick={() => toggle(f, !on)}
                  style={{
                    ...toggleBtn,
                    background: on ? ADMIN.surface : ADMIN.danger,
                    color: on ? ADMIN.ink900 : "#fff",
                    borderColor: on ? ADMIN.border : ADMIN.danger,
                    opacity: busy === f ? 0.6 : 1,
                  }}
                >
                  {busy === f ? "…" : on ? "Выключить" : "Включить"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {error ? (
        <div style={{ fontSize: 13, color: ADMIN.danger, marginTop: 12 }}>Ошибка: {error}</div>
      ) : null}
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
  marginBottom: 14,
};
const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  paddingBottom: 12,
  borderBottom: `1px solid ${ADMIN.border}`,
};
const toggleBtn: React.CSSProperties = {
  height: 30,
  padding: "0 12px",
  fontSize: 13,
  fontWeight: 500,
  fontFamily: ADMIN.fontSans,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 6,
  cursor: "pointer",
};
