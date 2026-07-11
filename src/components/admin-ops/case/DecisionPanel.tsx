"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";
import { Dialog } from "@/components/admin-ops/Dialog";
import { ReasonPicker } from "@/components/admin-ops/ReasonPicker";
import type { PassportPayload } from "@/lib/admin/passport-validation";
import type { FaceMatchResult } from "@/components/admin-ops/case/FaceMatchStep";

type DecisionMode =
  | null
  | "approve"
  | "needs_changes"
  | "reject_technical"
  | "blocking";

const BLOCK_CATEGORIES: { value: "fake" | "minor" | "catfish"; label: string }[] = [
  { value: "fake", label: "Фейковый документ" },
  { value: "minor", label: "Несовершеннолетний" },
  { value: "catfish", label: "Catfish — чужие фото/личность" },
];

export function DecisionPanel({
  caseId,
  userId,
  payload,
  faceMatch,
  expectedUpdatedAt,
  reasonTemplates,
  onBack,
}: {
  caseId: string;
  userId: string;
  payload: PassportPayload;
  faceMatch: FaceMatchResult | null;
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
  const [blockCategory, setBlockCategory] = useState<
    "fake" | "minor" | "catfish"
  >("fake");
  const [blockReason, setBlockReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitBlocking() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/cases/${caseId}/blocking-reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: blockReason, category: blockCategory }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error ?? "unknown_error");
        setBusy(false);
        return;
      }
      router.push("/admin/queue/mine");
      router.refresh();
    } catch {
      setError("network");
      setBusy(false);
    }
  }

  async function submit(action: "approve" | "needs_changes" | "reject_technical") {
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      action,
      expected_updated_at: expectedUpdatedAt,
    };
    if (action === "approve") {
      body.payload = payload;
      body.face_match = faceMatch; // QZ-5: аудит ручной сверки лица
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

        <Button
          variant="danger"
          onClick={() => setMode("blocking")}
          disabled={busy}
        >
          ⛔ Blocking-reject — фейк / несовершеннолетний / catfish
        </Button>
        <div style={{ marginTop: 4, color: ADMIN.ink500, fontSize: 12 }}>
          Перманентная блокировка + телефон в чёрный список на 10 лет.
          Не снимается обычным разблоком.
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
              onClick={() =>
                (mode === "needs_changes" || mode === "reject_technical") &&
                submit(mode)
              }
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

      <Dialog
        open={mode === "blocking"}
        onClose={() => !busy && setMode(null)}
        title="⛔ Blocking-reject (необратимо)"
        actions={
          <>
            <Button onClick={() => setMode(null)} disabled={busy}>
              Отмена
            </Button>
            <Button
              variant="danger"
              onClick={submitBlocking}
              disabled={busy || blockReason.trim().length < 3}
            >
              {busy ? "Блокируем…" : "Заблокировать навсегда"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              padding: "10px 14px",
              background: "#fcf0f3",
              border: `1px solid ${ADMIN.danger}`,
              borderRadius: 6,
              fontSize: 12,
              color: ADMIN.danger,
            }}
          >
            Юзер будет заблокирован навсегда, телефон попадёт в чёрный список на
            10 лет (повторная регистрация с тем же номером закрыта). Применять
            только для фейка / несовершеннолетних / catfish.
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                color: ADMIN.ink500,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              Категория
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {BLOCK_CATEGORIES.map((c) => (
                <label
                  key={c.value}
                  style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input
                    type="radio"
                    name="block-category"
                    checked={blockCategory === c.value}
                    onChange={() => setBlockCategory(c.value)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
          <textarea
            rows={3}
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Причина (внутренняя, для аудита) — минимум 3 символа"
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
      </Dialog>
    </div>
  );
}
