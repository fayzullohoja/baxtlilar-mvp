// Чистая валидация body для /api/admin/verifications/[id]/decision.
// Вынесено отдельно от route.ts, чтобы юнит-тестировать матрицу
// (action × reject_category) без БД и без NextRequest.

export type DecisionAction = "approve" | "reject" | "needs_changes";
export type RejectCategory = "technical" | "blocking";

export type DecisionBody = {
  action?: DecisionAction;
  reason?: string;
  target?: "passport" | "selfie" | "both";
  reject_category?: RejectCategory;
};

export type ValidationOk = {
  ok: true;
  action: DecisionAction;
  /** Какое значение пишем в user_documents.reject_category. null для approve/needs_changes. */
  rejectCategory: RejectCategory | null;
};

export type ValidationError = {
  ok: false;
  error:
    | "bad_action"
    | "reason_required"
    | "bad_category"
    | "category_required"
    | "category_not_allowed"
    | "blocking_requires_reject";
};

const ACTIONS: ReadonlySet<DecisionAction> = new Set(["approve", "reject", "needs_changes"]);

export function validateDecisionBody(body: DecisionBody): ValidationOk | ValidationError {
  const action = body.action;
  if (!action || !ACTIONS.has(action)) return { ok: false, error: "bad_action" };

  if ((action === "reject" || action === "needs_changes") && !body.reason?.trim()) {
    return { ok: false, error: "reason_required" };
  }

  // bad value early — до семантических чеков ниже.
  if (
    body.reject_category !== undefined &&
    body.reject_category !== "technical" &&
    body.reject_category !== "blocking"
  ) {
    return { ok: false, error: "bad_category" };
  }

  if (action === "approve") {
    if (body.reject_category) return { ok: false, error: "category_not_allowed" };
    return { ok: true, action, rejectCategory: null };
  }

  if (action === "needs_changes") {
    if (body.reject_category === "blocking") {
      return { ok: false, error: "blocking_requires_reject" };
    }
    // technical-flow всегда без записи категории (инвариант БД: только reject)
    return { ok: true, action, rejectCategory: null };
  }

  // action === 'reject'
  if (!body.reject_category) return { ok: false, error: "category_required" };
  return { ok: true, action, rejectCategory: body.reject_category };
}
