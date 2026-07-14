"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";
import { ReasonPicker } from "@/components/admin-ops/ReasonPicker";

/**
 * Возврат кейса на доработку С ЛЮБОГО шага (не только с шага 4/DecisionPanel).
 * Кейс: модератор на шаге 1 видит плохое фото / не тот документ → сразу вернуть,
 * не проходя фейково шаги ввода паспорта + face-match.
 *
 * Переиспользует существующий needs_changes: RPC admin_reject_verification
 * работает из любого НЕ-closed состояния (проверяет только claimed-by-you +
 * свежий updated_at), поэтому новый роут/RPC не нужен — только UI.
 * Клиент попадёт на /onboarding/needs-changes и перезальёт документ + селфи.
 */
const ERR_RU: Record<string, string> = {
  stale_case: "Кейс изменился — обновите страницу и повторите.",
  not_claimed_by_you: "Кейс не закреплён за вами.",
  case_closed: "Кейс уже закрыт.",
  case_not_found: "Кейс не найден.",
  reason_required: "Укажите причину (мин. 3 символа).",
  bad_payload: "Некорректный запрос.",
  network: "Сеть недоступна.",
};

export function SendBackForRework({
  caseId,
  expectedUpdatedAt,
  reasonTemplates,
}: {
  caseId: string;
  expectedUpdatedAt: string;
  reasonTemplates: { code: string; text: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(reasonTemplates[0]?.code ?? "");
  const [text, setText] = useState(reasonTemplates[0]?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (text.trim().length < 3) {
      setErr(ERR_RU.reason_required);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/cases/${caseId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "needs_changes",
          reason_code: code,
          reason_text: text.trim(),
          expected_updated_at: expectedUpdatedAt,
        }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (d.ok) {
        router.push("/admin/queue/mine");
        return;
      }
      setErr(ERR_RU[d.error ?? ""] ?? d.error ?? "Ошибка");
    } catch {
      setErr(ERR_RU.network);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div style={{ margin: "0 0 16px" }}>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          ↩ Вернуть на доработку
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        margin: "0 0 16px",
        padding: 14,
        border: `1px solid ${ADMIN.warning}`,
        borderRadius: 8,
        background: ADMIN.surface,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
        Вернуть на доработку — напр. плохое фото / не тот документ
      </div>
      <ReasonPicker
        templates={reasonTemplates}
        selectedCode={code}
        customText={text}
        onSelectCode={setCode}
        onCustomTextChange={setText}
      />
      <div style={{ fontSize: 12, color: ADMIN.ink500, margin: "8px 0 12px" }}>
        Клиент увидит эту причину и сможет перезалить документ и селфи.
      </div>
      {err ? <div style={{ fontSize: 12, color: ADMIN.danger, marginBottom: 10 }}>{err}</div> : null}
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
          Отмена
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={submit}
          disabled={busy || text.trim().length < 3}
        >
          {busy ? "Отправляю…" : "Отправить на доработку"}
        </Button>
      </div>
    </div>
  );
}
