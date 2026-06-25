import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { V2AdminShell, AdminH1 } from "@/components/v2/AdminShell";

export const dynamic = "force-dynamic";

const OVERDUE_MS = 24 * 60 * 60 * 1000;

function overdueInfo(iso: string): { overdue: boolean; label: string } {
  const waited = Date.now() - new Date(iso).getTime();
  return { overdue: waited > OVERDUE_MS, label: new Date(iso).toLocaleString("ru-RU") };
}

/**
 * V2 Admin · Verifications Queue (Blueprint §4.3.1).
 * Editorial list table: serif column headers, ink borders, no zebra.
 */
export default async function VerificationsQueue() {
  const session = await requireAdmin();
  const list = unwrapRows(
    await supabaseAdmin()
      .from("users")
      .select("id, telegram_username, telegram_first_name, phone_number, updated_at")
      .eq("verification_status", "pending_review")
      .order("updated_at", { ascending: true })
      .limit(100),
  );

  return (
    <V2AdminShell active="/admin/verifications" role={session.role}>
      <AdminH1 subtitle={`${list.length} ${pluralize(list.length, "заявка", "заявки", "заявок")} на проверке`}>
        Очередь верификации
      </AdminH1>

      {list.length === 0 ? (
        <p
          style={{
            fontSize: "15px",
            color: "var(--color-v2-ink-400)",
            fontFamily: "var(--font-v2-body)",
            padding: "60px 0",
            textAlign: "center",
          }}
        >
          Очередь пуста. Возвращайся когда новые заявки прилетят.
        </p>
      ) : (
        <div
          style={{
            border: "1px solid var(--color-v2-ink-500)",
            borderRadius: "var(--v2-radius-md)",
            overflow: "hidden",
            background: "var(--color-v2-paper)",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "var(--font-v2-body)",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-v2-ink-500)" }}>
                <Th>Пользователь</Th>
                <Th>Ожидает с</Th>
                <Th>Статус</Th>
                <Th align="right">{""}</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const { overdue, label } = overdueInfo(u.updated_at as string);
                const name =
                  (u.telegram_first_name as string) ||
                  (u.telegram_username ? "@" + u.telegram_username : null) ||
                  (u.id as string).slice(0, 8);
                return (
                  <tr
                    key={u.id as string}
                    style={{ borderTop: "1px solid var(--color-v2-ink-600)" }}
                  >
                    <Td>{name}</Td>
                    <Td>
                      <span style={{ color: "var(--color-v2-ink-400)" }}>{label}</span>
                    </Td>
                    <Td>
                      {overdue ? (
                        <span style={{ color: "#b8475e", fontWeight: 500 }}>
                          Просрочено &gt; 24ч
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-v2-ink-400)" }}>В норме</span>
                      )}
                    </Td>
                    <Td align="right">
                      <Link
                        href={`/admin/verifications/${u.id}`}
                        style={{
                          color: "var(--color-v2-ink-100)",
                          textDecoration: "none",
                          fontWeight: 500,
                          borderBottom: "1px solid var(--color-v2-ink-300)",
                          paddingBottom: "1px",
                        }}
                      >
                        Открыть →
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </V2AdminShell>
  );
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const m = n % 100;
  if (m >= 11 && m <= 19) return many;
  const u = n % 10;
  if (u === 1) return one;
  if (u >= 2 && u <= 4) return few;
  return many;
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        padding: "14px 20px",
        textAlign: align,
        fontSize: "11px",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "var(--color-v2-ink-400)",
        fontWeight: 500,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td
      style={{
        padding: "16px 20px",
        textAlign: align,
        color: "var(--color-v2-ink-100)",
      }}
    >
      {children}
    </td>
  );
}
