import type { ReactNode } from "react";
import { ADMIN } from "@/lib/admin/admin-tokens";

type Kind =
  | "verified"
  | "pending"
  | "rejected"
  | "banned"
  | "paused"
  | "active"
  | "new"
  | "warning";

const COLORS: Record<Kind, { bg: string; fg: string }> = {
  verified: { bg: "#e7f3ec", fg: ADMIN.success },
  active: { bg: "#e7f3ec", fg: ADMIN.success },
  pending: { bg: "#fbf1e0", fg: ADMIN.warning },
  warning: { bg: "#fbf1e0", fg: ADMIN.warning },
  rejected: { bg: "#fbe7ec", fg: ADMIN.danger },
  banned: { bg: "#fbe7ec", fg: ADMIN.danger },
  paused: { bg: ADMIN.surface2, fg: ADMIN.ink500 },
  new: { bg: "#e8eef3", fg: ADMIN.info },
};

export function StatusPill({
  kind,
  children,
}: {
  kind: Kind;
  children: ReactNode;
}) {
  const c = COLORS[kind];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 4,
        background: c.bg,
        color: c.fg,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </span>
  );
}
