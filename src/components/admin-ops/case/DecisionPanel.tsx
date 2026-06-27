"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";
import { Dialog } from "@/components/admin-ops/Dialog";
import { ReasonPicker } from "@/components/admin-ops/ReasonPicker";
import type { PassportPayload } from "@/lib/admin/passport-validation";

type DecisionMode = null | "approve" | "needs_changes" | "reject_technical";

export function DecisionPanel({
  caseId,
  userId,
  payload,
  expectedUpdatedAt,
  reasonTemplates,
  onBack,
}: {
  caseId: string;
  userId: string;
  payload: PassportPayload;
  expectedUpdatedAt: string;
  reasonTemplates: { code: string; text: string }[];
  onBack: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<DecisionMode>(null);
  const [reasonCode, setReasonCode] = useState<string>(
    reasonTemplates[0]?.code ?? "",
  );
  const [reasonText, setReasonText] = useState<string>(
    reasonTemplates[0]?.text ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: NonNullable<DecisionMode>) {
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      action,
      expected_updated_at: expectedUpdatedAt,
    };
    if (action === "approve") {
      body.payload = payload;
    } else {
      body.reason_code = reasonCode;
      body.reason_text = reasonText;
    }
    try {
      const r = await fetch(`/api/admin/cases/${caseId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error ?? "unknown_error");
        setBusy(false);
        return;
      }
      if (action === "approve") {
        router.push(`/admin/clients/${userId}`);
      } else {
        router.push("/admin/queue/mine");
      }
      router.refresh();
    } catch {
      setError("network");
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        style={{
          padding: 16,
          marginBottom: 24,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          background: ADMIN.surface,
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
          Сводка ввода
        </div>
        <div style={{ fontSize: 15, fontWeight: 500 }}>
          {payload.last_name} {payload.first_name} {payload.middle_name ?? ""}
        </div>
        <div
          style={{ fontSize: 13, color: ADMIN.ink700, marginTop: 4 }}
        >
          {payload.gender} · {payload.citizenship} ·{" "}
          {new Date(payload.birth_date).toLocaleDateString("ru-RU")}
        </div>
        <div
          style={{
            fontSize: 13,
            fontFamily: ADMIN.fontMono,
            marginTop: 6,
          }}
        >
          {payload.passport_series}
          {payload.passport_number} · ПИНФЛ {payload.pinfl}
        </div>
        <div
          style={{ fontSize: 12, color: ADMIN.ink500, marginTop: 6 }}
        >
          {payload.locality}, {payload.street_address}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Button
          variant="primary"
          onClick={() => setMode("approve")}
          disabled={busy}
        >
          ✓ Approve — создать клиента
        </Button>
        <Button onClick={() => setMode("needs_changes")} disabled={busy}>
          ↩ Needs changes — переснять документы
        </Button>
        <Button
          onClick={() => setMode("reject_technical")}
          disabled={busy}
        >
          ✕ Reject technical — можно повторить
        </Button>

        <div style={{ marginTop: 12, color: ADMIN.ink500, fontSize: 12 }}>
          Blocking-reject (fake/minor/catfish) — добавлен в Sprint 3
          (требует second-admin подтверждения по F-119).
        </div>

        <div style={{ marginTop: 20 }}>
          <Button variant="ghost" onClick={onBack} disabled={busy}>
            ← Назад к сверке лица
          </Button>
        </div>

        {error ? (
          <div
            style={{
              color: ADMIN.danger,
              fontSize: 13,
              marginTop: 12,
            }}
          >
            Ошибка: {error}
          </div>
        ) : null}
      </div>

      <Dialog
        open={mode === "approve"}
        onClose={() => !busy && setMode(null)}
        title="Подтвердите создание клиента"
        actions={
          <>
            <Button onClick={() => setMode(null)} disabled={busy}>
              Отмена
            </Button>
            <Button
              variant="primary"
              onClick={() => submit("approve")}
              disabled={busy}
            >
              {busy ? "Создаём…" : "Подтвердить"}
            </Button>
          </>
        }
      >
        Будет создана новая карточка клиента:{" "}
        <strong>
          {payload.last_name} {payload.first_name}
        </strong>{" "}
        (ПИНФЛ {payload.pinfl}). Селфи станет аватаркой клиента, юзер
        получит push «Анкета одобрена», кейс будет закрыт.
      </Dialog>

      <Dialog
        open={mode === "needs_changes" || mode === "reject_technical"}
        onClose={() => !busy && setMode(null)}
        title={
          mode === "needs_changes"
            ? "Запросить переснять документы"
            : "Отклонить (technical)"
        }
        actions={
          <>
            <Button onClick={() => setMode(null)} disabled={busy}>
              Отмена
            </Button>
            <Button
              variant="primary"
              onClick={() => mode && submit(mode)}
              disabled={busy || reasonText.length < 3}
            >
              {busy ? "Отправляем…" : "Подтвердить"}
            </Button>
          </>
        }
      >
        <div
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <ReasonPicker
            templates={reasonTemplates}
            selectedCode={reasonCode}
            customText={reasonText}
            onSelectCode={setReasonCode}
            onCustomTextChange={setReasonText}
          />
          <div style={{ fontSize: 12, color: ADMIN.ink500 }}>
            Этот текст увидит юзер. Минимум 3 символа.
          </div>
        </div>
      </Dialog>
    </div>
  );
}
