// Mirrors DB enum verification_case_state + check constraint on outcome.
// See supabase/migrations/20260627100100_verification_cases.sql.

export type CaseState =
  | "new"
  | "assigned"
  | "in_review"
  | "data_entry"
  | "ready_to_decide"
  | "closed";

export type CaseOutcome =
  | "approved"
  | "needs_changes"
  | "rejected_technical"
  | "rejected_blocking";
