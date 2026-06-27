// Discrete state-transition rules for verification_cases.
// Mirrors the legal moves enforced (or that should be enforced) at the DB layer.
// PL/pgSQL RPCs in 20260627100400_admin_case_rpcs.sql check current state before mutating.

import type { CaseState } from "./case-types";

const ALLOWED: Record<CaseState, readonly CaseState[]> = {
  new:              ["assigned"],
  assigned:         ["in_review", "data_entry", "new"], // can unclaim back to new
  in_review:        ["data_entry", "assigned"],
  data_entry:       ["ready_to_decide", "in_review", "closed"], // direct close for approve happy path
  ready_to_decide:  ["closed", "data_entry"],
  closed:           [],
};

export function canTransition(from: CaseState, to: CaseState): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export const terminalStates: ReadonlySet<CaseState> = new Set<CaseState>(["closed"]);
