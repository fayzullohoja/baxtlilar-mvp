import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import {
  loadMyQueue,
  loadUnassignedQueue,
  loadAllOpenQueue,
  type QueueCase,
} from "@/lib/admin/load-queue";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";

export const dynamic = "force-dynamic";

const PAGE = 50;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; cursor?: string }>;
}) {
  const session = await requireAdmin();
  const sp = await searchParams;
  const isSuper = session.role === "superadmin";
  const view = sp.view === "all" && isSuper ? "all" : "mine";
  const cursor = sp.cursor || undefined;

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      {isSuper ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <Tab href="/admin/queue/mine" active={view === "mine"}>
            Моя очередь
          </Tab>
          <Tab href="/admin/queue/mine?view=all" active={view === "all"}>
            Все открытые
          </Tab>
        </div>
      ) : null}

      {view === "all" ? (
        <AllOpenView cursor={cursor} />
      ) : (
        <MineView adminId={session.adminId} />
      )}
    </OpsShell>
  );
}

async function MineView({ adminId }: { adminId: string }) {
  const [mine, unassigned] = await Promise.all([
    loadMyQueue(adminId),
    loadUnassignedQueue(),
  ]);

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8, color: ADMIN.ink900 }}>
        Моя очередь
      </h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 24 }}>
        {mine.length} в работе · {unassigned.length} без владельца
      </p>

      {mine.length === 0 ? (
        <EmptyState unassignedCount={unassigned.length} />
      ) : (
        <CaseTable rows={mine} />
      )}

      {unassigned.length > 0 ? (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 12, color: ADMIN.ink700 }}>
            Без владельца ({unassigned.length})
          </h2>
          <CaseTable rows={unassigned} unassigned />
        </div>
      ) : null}
    </>
  );
}

async function AllOpenView({ cursor }: { cursor?: string }) {
  const { rows, next_cursor } = await loadAllOpenQueue(PAGE, cursor);

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8, color: ADMIN.ink900 }}>
        Все открытые кейсы
      </h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 24 }}>
        Надзорный вид всех модераторов{cursor ? " · продолжение" : ""}.
      </p>

      {rows.length === 0 ? (
        <div
          style={{
            padding: 24,
            border: `1px solid ${ADMIN.border}`,
            borderRadius: 8,
            background: ADMIN.surface,
            color: ADMIN.ink500,
            fontSize: 13,
          }}
        >
          Открытых кейсов нет.
        </div>
      ) : (
        <CaseTable rows={rows} showAssignee />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        {cursor ? (
          <Link href="/admin/queue/mine?view=all" style={pagerLink}>
            ↑ В начало
          </Link>
        ) : (
          <span />
        )}
        {next_cursor ? (
          <Link
            href={`/admin/queue/mine?view=all&cursor=${encodeURIComponent(next_cursor)}`}
            style={pagerLink}
          >
            Дальше →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </>
  );
}

const pagerLink: React.CSSProperties = {
  fontSize: 13,
  color: ADMIN.accent,
  textDecoration: "none",
  padding: "6px 12px",
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 6,
  background: ADMIN.surface,
};

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "6px 14px",
        fontSize: 13,
        color: active ? "#fff" : ADMIN.ink700,
        background: active ? ADMIN.accent : ADMIN.surface,
        border: `1px solid ${active ? ADMIN.accent : ADMIN.border}`,
        borderRadius: 6,
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

function EmptyState({ unassignedCount }: { unassignedCount: number }) {
  return (
    <div
      style={{
        padding: 24,
        border: `1px solid ${ADMIN.border}`,
        borderRadius: 8,
        background: ADMIN.surface,
        color: ADMIN.ink500,
        fontSize: 13,
      }}
    >
      {unassignedCount === 0
        ? "Очередь пуста. Новых заявок нет."
        : "Очередь пуста. Возьми из «Без владельца» ниже."}
    </div>
  );
}

function CaseTable({
  rows,
  unassigned = false,
  showAssignee = false,
}: {
  rows: QueueCase[];
  unassigned?: boolean;
  showAssignee?: boolean;
}) {
  const headers = showAssignee
    ? ["ID", "Клиент", "TG", "Состояние", "Владелец", "Поступило"]
    : ["ID", "Клиент", "TG", "Состояние", "Поступило"];
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        background: ADMIN.surface,
        border: `1px solid ${ADMIN.border}`,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <thead>
        <tr style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
          {headers.map((h) => (
            <th
              key={h}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                fontSize: 11,
                color: ADMIN.ink500,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                fontWeight: 500,
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => {
          const fallbackName = c.display_name ?? c.telegram_first_name ?? "—";
          return (
            <tr key={c.case_id} style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
              <td style={{ padding: "10px 12px", fontFamily: ADMIN.fontMono, fontSize: 12, color: ADMIN.ink700 }}>
                <Link href={`/admin/cases/${c.case_id}`} style={{ color: ADMIN.accent, textDecoration: "none" }}>
                  VR-{c.case_id.slice(0, 8)}
                </Link>
              </td>
              <td style={{ padding: "10px 12px", fontSize: 13 }}>{fallbackName}</td>
              <td style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink500 }}>
                {c.telegram_username ? `@${c.telegram_username}` : "—"}
              </td>
              <td style={{ padding: "10px 12px" }}>
                <StatusPill
                  kind={
                    c.state === "data_entry" ? "warning" : unassigned ? "new" : "pending"
                  }
                >
                  {c.state}
                </StatusPill>
              </td>
              {showAssignee ? (
                <td style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink500 }}>
                  {c.assignee_login ? c.assignee_login : <span style={{ color: ADMIN.accent }}>— свободен</span>}
                </td>
              ) : null}
              <td style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink500 }}>
                {new Date(c.created_at).toLocaleString("ru-RU")}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
