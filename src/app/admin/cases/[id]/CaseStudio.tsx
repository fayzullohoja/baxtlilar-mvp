"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CaseHeader } from "@/components/admin-ops/case/CaseHeader";
import { PassportViewer, PassportImagePanel } from "@/components/admin-ops/case/PassportViewer";
import { PassportDataEntryForm } from "@/components/admin-ops/case/PassportDataEntryForm";
import { FaceMatchStep, type FaceMatchResult } from "@/components/admin-ops/case/FaceMatchStep";
import { DecisionPanel } from "@/components/admin-ops/case/DecisionPanel";
import { SendBackForRework } from "@/components/admin-ops/case/SendBackForRework";
import { CaseHistory } from "./CaseHistory";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";
import type { LoadedCase } from "@/lib/admin/load-case";
import type { PassportPayload } from "@/lib/admin/passport-validation";

export function CaseStudio({
  loadedCase,
  currentAdminId,
  reasonTemplates,
  selfDeclaredLabels,
}: {
  loadedCase: LoadedCase;
  currentAdminId: string;
  reasonTemplates: { code: string; text: string }[];
  // Лейблы пол/гражданство, уже отрезолвленные сервером через оверлей
  // (конструктор Tier 2). Клиентский компонент их только отображает.
  selfDeclaredLabels: { gender: string | null; citizenship: string | null };
}) {
  const router = useRouter();
  const initialDraft = loadedCase.draft_payload as Partial<PassportPayload>;
  const [step, setStep] = useState<1 | 2 | 3 | 4>(
    initialDraft && Object.keys(initialDraft).length > 0 ? 2 : 1,
  );
  const [enteredPayload, setEnteredPayload] = useState<PassportPayload | null>(
    null,
  );
  // QZ-5: результат ручной сверки лица (шаг 3) → в решение (approve) → case_events.
  const [faceMatch, setFaceMatch] = useState<FaceMatchResult | null>(null);
  const [claiming, setClaiming] = useState(() => !loadedCase.assignee_id);
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
  // H-3: ре-синк токена при перезагрузке кейса (claim → router.refresh меняет
  // updated_at). Делаем ВО ВРЕМЯ РЕНДЕРА (guarded), а не в эффекте — иначе
  // set-state-in-effect триггерит каскадный ре-рендер. Паттерн «adjust state on
  // prop change» из React-доков.
  const [syncedUpdatedAt, setSyncedUpdatedAt] = useState(loadedCase.updated_at);
  if (loadedCase.updated_at !== syncedUpdatedAt) {
    setSyncedUpdatedAt(loadedCase.updated_at);
    advanceUpdatedAt(loadedCase.updated_at);
  }

  useEffect(() => {
    if (loadedCase.assignee_id) return;
    // claiming уже инициализирован true (useState выше), не сетим синхронно.
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

      {loadedCase.assignee_id === currentAdminId ? (
        <ReleaseBar caseId={loadedCase.case_id} />
      ) : null}

      {/* Возврат на доработку с любого шага (шаг 4 уже имеет needs_changes в
          DecisionPanel). Для случая «плохое фото / не тот документ» на шаге 1-3. */}
      {loadedCase.assignee_id === currentAdminId && step < 4 ? (
        <SendBackForRework
          caseId={loadedCase.case_id}
          expectedUpdatedAt={currentUpdatedAt}
          reasonTemplates={reasonTemplates}
        />
      ) : null}

      {step === 1 ? (
        <PassportViewer
          passportUrl={loadedCase.passport_image_url}
          selfieUrl={loadedCase.selfie_image_url}
          onNext={() => setStep(2)}
        />
      ) : null}

      {step === 2 ? (
        // Паспорт (sticky, слева) РЯДОМ с формой ввода (справа) — модератор видит
        // документ, пока заполняет, не возвращаясь на шаг 1.
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(300px, 1fr) minmax(0, 1.35fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div style={{ position: "sticky", top: 12 }}>
            <PassportImagePanel title="Паспорт" url={loadedCase.passport_image_url} />
          </div>
          <div>
            <SelfDeclared sd={loadedCase.self_declared} labels={selfDeclaredLabels} />
            <PassportDataEntryForm
              caseId={loadedCase.case_id}
              initialPayload={initialDraft}
              onDraftSaved={advanceUpdatedAt}
              onProceed={(payload) => {
                setEnteredPayload(payload);
                setStep(3);
              }}
            />
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <FaceMatchStep
          selfieUrl={loadedCase.selfie_image_url}
          passportUrl={loadedCase.passport_image_url}
          onBack={() => setStep(2)}
          onConfirm={(fm) => {
            setFaceMatch(fm);
            setStep(4);
          }}
        />
      ) : null}

      {step === 4 && enteredPayload ? (
        <DecisionPanel
          caseId={loadedCase.case_id}
          payload={enteredPayload}
          faceMatch={faceMatch}
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

      {/* QZ-3/QZ-4: заметки модераторов + append-only таймлайн событий кейса */}
      <CaseHistory
        caseId={loadedCase.case_id}
        notes={loadedCase.notes}
        events={loadedCase.events}
      />
    </div>
  );
}

// QZ-2: освободить кейс обратно в пул (черновик сохраняется). Для случаев
// «взял, но не могу закончить» — без этого кейс висел бы на модераторе до SLA.
function ReleaseBar({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function release() {
    if (!confirm("Освободить кейс? Он вернётся в пул без владельца (черновик сохранится).")) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/cases/${caseId}/release`, { method: "POST" });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (d.ok) router.push("/admin/queue/mine");
      else {
        setErr(d.error ?? "error");
        setBusy(false);
      }
    } catch {
      setErr("network");
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "0 0 16px",
      }}
    >
      <Button variant="ghost" size="sm" disabled={busy} onClick={release}>
        {busy ? "Освобождаю…" : "Освободить кейс"}
      </Button>
      {err ? (
        <span style={{ fontSize: 12, color: ADMIN.danger }}>Ошибка: {err}</span>
      ) : null}
    </div>
  );
}

// QZ-6: то, что юзер сам указал в анкете — рядом с вводом паспорта, чтобы
// поймать расхождение (напр. «в анкете 1995, в паспорте 2005») до approve.
function SelfDeclared({
  sd,
  labels,
}: {
  sd: LoadedCase["self_declared"];
  labels: { gender: string | null; citizenship: string | null };
}) {
  return (
    <div
      style={{
        padding: "10px 14px",
        marginBottom: 16,
        border: `1px solid ${ADMIN.border}`,
        borderRadius: 8,
        background: ADMIN.surface2,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: ADMIN.ink500,
          marginBottom: 6,
        }}
      >
        Самозаявлено — сверьте с паспортом
      </div>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", fontSize: 13, color: ADMIN.ink700 }}
      >
        <span>ДР: {sd.birth_date ?? "—"}</span>
        <span>Пол: {labels.gender ?? "—"}</span>
        <span>Гражданство: {labels.citizenship ?? "—"}</span>
        <span>Место рожд.: {sd.birth_place ?? "—"}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: ADMIN.ink500 }}>
        При подтверждении дата рождения и пол в профиле будут заменены на паспортные
        (self-declared может быть неверным).
      </div>
    </div>
  );
}
