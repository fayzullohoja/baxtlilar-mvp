"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";

type Mode = null | "reject" | "needs_changes";
type RejectCategory = "technical" | "blocking";

const cardStyle = {
  borderRadius: 8,
  border: `1px solid ${ADMIN.border}`,
  background: ADMIN.surface,
  padding: 20,
} as const;

const fieldStyle = {
  width: "100%",
  borderRadius: 6,
  border: `1px solid ${ADMIN.border}`,
  background: ADMIN.surface,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: ADMIN.fontSans,
  color: ADMIN.ink900,
} as const;

export function DecisionForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState<"passport" | "selfie" | "both">("both");
  // MAJOR #2: при reject модератор выбирает категорию. По дефолту technical
  // (юзер может ретраить) — escalation до blocking требует осознанного клика.
  const [category, setCategory] = useState<RejectCategory>("technical");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/verifications/${userId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => ({ ok: false }));
    if (data.ok) {
      router.push("/admin/verifications");
      router.refresh();
    } else {
      setError(data.error === "not_pending" ? "Заявка уже обработана" : "Ошибка: " + data.error);
      setBusy(false);
    }
  }

  function onConfirm() {
    if (mode === "reject" && category === "blocking") {
      // R4 verdict: мягкий confirm на необратимое решение.
      const ok = window.confirm(
        "Категория «blocking» блокирует пользователя от повторной верификации в текущей анкете.\n\n" +
          "Используйте только при: подозрение на подделку, лицо не совпадает с документом, виден несовершеннолетний.\n\n" +
          "Продолжить?",
      );
      if (!ok) return;
    }
    if (mode === "needs_changes") {
      send(mode, { reason, target });
    } else if (mode === "reject") {
      send(mode, { reason, reject_category: category });
    }
  }

  if (mode) {
    return (
      <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontWeight: 500, color: ADMIN.ink900, fontSize: 14 }}>
          {mode === "reject" ? "Отклонить заявку" : "Вернуть на исправление"}
        </div>
        {mode === "needs_changes" && (
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as typeof target)}
            style={fieldStyle}
          >
            <option value="passport">Переснять паспорт</option>
            <option value="selfie">Переснять селфи</option>
            <option value="both">Переснять оба</option>
          </select>
        )}
        {mode === "reject" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: ADMIN.ink700 }}>
              Категория отказа
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RejectCategory)}
              style={fieldStyle}
            >
              <option value="technical">Технические причины (плохое фото, блики, размытие)</option>
              <option value="blocking">Подозрение на подделку / возраст / катфиш</option>
            </select>
            <p style={{ fontSize: 12, color: ADMIN.ink500 }}>
              {category === "technical"
                ? "Пользователь сможет переснять и попробовать снова."
                : "Retry будет заблокирован. Пользователь увидит контакт поддержки."}
            </p>
            {category === "blocking" && (
              <div
                style={{
                  borderRadius: 6,
                  border: `1px solid ${ADMIN.danger}`,
                  background: "#fbe7ec",
                  padding: "8px 10px",
                  fontSize: 12,
                  color: ADMIN.danger,
                }}
              >
                Это решение блокирует пользователя от повторной верификации в текущей анкете.
                Основания: фейковый документ, лицо не совпадает с паспортом, виден несовершеннолетний.
              </div>
            )}
          </div>
        )}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Причина (увидит пользователь)"
          rows={3}
          style={{ ...fieldStyle, resize: "vertical" }}
        />
        {error ? <p style={{ fontSize: 13, color: ADMIN.danger }}>{error}</p> : null}
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            variant="primary"
            size="md"
            disabled={busy || !reason.trim()}
            onClick={onConfirm}
          >
            Подтвердить
          </Button>
          <Button variant="secondary" size="md" onClick={() => setMode(null)}>
            Отмена
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontWeight: 500, color: ADMIN.ink900, fontSize: 14, marginBottom: 12 }}>
        Решение модератора
      </div>
      {error ? (
        <p style={{ fontSize: 13, color: ADMIN.danger, marginBottom: 12 }}>{error}</p>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button variant="primary" size="md" disabled={busy} onClick={() => send("approve")}>
          ✓ Одобрить
        </Button>
        <Button variant="secondary" size="md" onClick={() => setMode("needs_changes")}>
          ↩ Вернуть на исправление
        </Button>
        <Button variant="danger" size="md" onClick={() => setMode("reject")}>
          ✕ Отклонить
        </Button>
      </div>
    </div>
  );
}
