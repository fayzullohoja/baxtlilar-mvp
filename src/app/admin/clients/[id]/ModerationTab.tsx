import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";

export async function ModerationTab({ userId }: { userId: string }) {
  const sb = supabaseAdmin();
  const [casesRes, reportsRes] = await Promise.all([
    sb
      .from("verification_cases")
      .select("id, state, outcome, created_at, decided_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    sb
      .from("reports")
      .select("id, reason_code, comment, status, created_at")
      .eq("target_user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const cases = (casesRes.data ?? []) as Array<{
    id: string;
    state: string;
    outcome: string | null;
    created_at: string;
  }>;
  const reports = (reportsRes.data ?? []) as Array<{
    id: string;
    reason_code: string;
    comment: string | null;
    status: string;
    created_at: string;
  }>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
          Verification cases ({cases.length})
        </h3>
        {cases.length === 0 ? (
          <div style={{ color: ADMIN.ink500, fontSize: 13 }}>—</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {cases.map((c) => (
              <li
                key={c.id}
                style={{
                  padding: "8px 12px",
                  border: `1px solid ${ADMIN.border}`,
                  borderRadius: 4,
                  marginBottom: 6,
                  background: ADMIN.surface,
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <Link
                  href={`/admin/cases/${c.id}`}
                  style={{ color: ADMIN.accent, fontFamily: ADMIN.fontMono }}
                >
                  VR-{c.id.slice(0, 8)}
                </Link>
                <StatusPill kind={c.outcome === "approved" ? "verified" : "pending"}>
                  {c.outcome ?? c.state}
                </StatusPill>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: ADMIN.ink500 }}>
                  {new Date(c.created_at).toLocaleString("ru-RU")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
          Жалобы на клиента ({reports.length})
        </h3>
        {reports.length === 0 ? (
          <div style={{ color: ADMIN.ink500, fontSize: 13 }}>—</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {reports.map((r) => (
              <li
                key={r.id}
                style={{
                  padding: "8px 12px",
                  border: `1px solid ${ADMIN.border}`,
                  borderRadius: 4,
                  marginBottom: 6,
                  background: ADMIN.surface,
                  display: "flex",
                  gap: 12,
                  fontSize: 13,
                }}
              >
                <StatusPill kind={r.status === "resolved" ? "verified" : "pending"}>
                  {r.status}
                </StatusPill>
                <span style={{ flex: 1 }}>
                  {r.reason_code}
                  {r.comment ? ` — ${r.comment}` : ""}
                </span>
                <span style={{ fontSize: 11, color: ADMIN.ink500 }}>
                  {new Date(r.created_at).toLocaleString("ru-RU")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
