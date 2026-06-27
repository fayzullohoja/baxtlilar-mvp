"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CaseHeader } from "@/components/admin-ops/case/CaseHeader";
import { PassportViewer } from "@/components/admin-ops/case/PassportViewer";
import { PassportDataEntryForm } from "@/components/admin-ops/case/PassportDataEntryForm";
import { FaceMatchStep } from "@/components/admin-ops/case/FaceMatchStep";
import { DecisionPanel } from "@/components/admin-ops/case/DecisionPanel";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";
import type { LoadedCase } from "@/lib/admin/load-case";
import type { PassportPayload } from "@/lib/admin/passport-validation";

export function CaseStudio({
  loadedCase,
  currentAdminId,
  reasonTemplates,
}: {
  loadedCase: LoadedCase;
  currentAdminId: string;
  reasonTemplates: { code: string; text: string }[];
}) {
  const router = useRouter();
  const initialDraft = loadedCase.draft_payload as Partial<PassportPayload>;
  const [step, setStep] = useState<1 | 2 | 3 | 4>(
    initialDraft && Object.keys(initialDraft).length > 0 ? 2 : 1,
  );
  const [enteredPayload, setEnteredPayload] = useState<PassportPayload | null>(
    null,
  );
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  // H-3: живой токен оптимистичной блокировки. Инициализируется значением с
  // сервера и ре-синкается при каждой перезагрузке кейса (claim → router.refresh
  // меняет updated_at), а автосейв черновика двигает его вперёд через onDraftSaved.
  // DecisionPanel шлёт ИМЕННО его, а не замороженный loadedCase.updated_at.
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState(
    loadedCase.updated_at,
  );
  // H-3 (round 2): токен двигается ТОЛЬКО вперёд по времени. Out-of-order ответ
  // автосейва (медленная сеть) или поздний claim-refresh не должны откатить его
  // на более старый instant — иначе decision-RPC снова словит stale_case 409.
  // Сравниваем по epoch: node-pg и jsonb-RPC отдают разные текстовые форматы
  // ("…+00" vs "…T…+00:00"), лексикографическое сравнение мис-ордерит.
  const advanceUpdatedAt = useCallback((next: string) => {
    setCurrentUpdatedAt((prev) =>
      new Date(next).getTime() >= new Date(prev).getTime() ? next : prev,
    );
  }, []);
  useEffect(() => {
    advanceUpdatedAt(loadedCase.updated_at);
  }, [loadedCase.updated_at, advanceUpdatedAt]);

  useEffect(() => {
    if (loadedCase.assignee_id) return;
    setClaiming(true);
    fetch(`/api/admin/cases/${loadedCase.case_id}/claim`, { method: "POST" })
      .then((r) => r.json())
      .then((d: { ok: boolean; error?: string }) => {
        if (!d.ok) setClaimError(d.error ?? "claim_failed");
        else router.refresh();
      })
      .catch(() => setClaimError("network"))
      .finally(() => setClaiming(false));
  }, [loadedCase.assignee_id, loadedCase.case_id, router]);

  if (claimError) {
    return (
      <div
        style={{
          padding: 24,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          background: ADMIN.surface,
        }}
      >
        <div style={{ color: ADMIN.danger, marginBottom: 12 }}>
          Не удалось взять кейс:{" "}
          {claimError === "case_already_claimed"
            ? "обрабатывает другой админ"
            : claimError}
        </div>
        <Button onClick={() => router.push("/admin/queue/mine")}>
          ← К очереди
        </Button>
      </div>
    );
  }

  if (loadedCase.assignee_id && loadedCase.assignee_id !== currentAdminId) {
    return (
      <div
        style={{
          padding: 24,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          background: ADMIN.surface,
        }}
      >
        <div style={{ color: ADMIN.warning, marginBottom: 12 }}>
          Кейс уже обрабатывается другим админом.
        </div>
        <Button onClick={() => router.push("/admin/queue/mine")}>
          ← К очереди
        </Button>
      </div>
    );
  }

  if (claiming) {
    return <div style={{ color: ADMIN.ink500 }}>Закрепляем кейс…</div>;
  }

  const shortId = "VR-" + loadedCase.case_id.slice(0, 8);
  const displayName =
    loadedCase.user.display_name ??
    loadedCase.user.telegram_first_name ??
    "—";

  return (
    <div>
      <CaseHeader
        caseShortId={shortId}
        displayName={displayName}
        telegramUsername={loadedCase.user.telegram_username}
        phoneNumber={loadedCase.user.phone_number}
        state={loadedCase.state}
        createdAt={loadedCase.created_at}
        step={step}
      />

      {step === 1 ? (
        <PassportViewer
          passportUrl={loadedCase.passport_image_url}
          selfieUrl={loadedCase.selfie_image_url}
          onNext={() => setStep(2)}
        />
      ) : null}

      {step === 2 ? (
        <PassportDataEntryForm
          caseId={loadedCase.case_id}
          initialPayload={initialDraft}
          onDraftSaved={advanceUpdatedAt}
          onProceed={(payload) => {
            setEnteredPayload(payload);
            setStep(3);
          }}
        />
      ) : null}

      {step === 3 ? (
        <FaceMatchStep
          selfieUrl={loadedCase.selfie_image_url}
          passportUrl={loadedCase.passport_image_url}
          onBack={() => setStep(2)}
          onConfirm={() => setStep(4)}
        />
      ) : null}

      {step === 4 && enteredPayload ? (
        <DecisionPanel
          caseId={loadedCase.case_id}
          userId={loadedCase.user.id}
          payload={enteredPayload}
          expectedUpdatedAt={currentUpdatedAt}
          reasonTemplates={reasonTemplates}
          onBack={() => setStep(3)}
        />
      ) : null}

      {step === 4 && !enteredPayload ? (
        <div style={{ color: ADMIN.warning, padding: 16 }}>
          Сначала заполните паспортные данные на шаге 2.
          <div style={{ marginTop: 12 }}>
            <Button onClick={() => setStep(2)}>← К шагу 2</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
