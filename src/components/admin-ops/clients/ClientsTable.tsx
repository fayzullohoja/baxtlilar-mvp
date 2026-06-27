"use client";
import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import type { ClientRow } from "@/lib/admin/load-clients-search";

const th = {
  textAlign: "left" as const,
  padding: "10px 12px",
  fontSize: 11,
  color: ADMIN.ink500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  fontWeight: 500,
};

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          color: ADMIN.ink500,
          fontSize: 13,
          textAlign: "center",
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          background: ADMIN.surface,
        }}
      >
        Ничего не найдено
      </div>
    );
  }

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
          {["", "ФИО", "Возраст", "Город", "Телефон", "TG", "Статус", "Создан"].map(
            (h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const name = r.full_name ?? r.display_name ?? "—";
          return (
            <tr
              key={r.user_id}
              style={{ borderBottom: `1px solid ${ADMIN.border}` }}
            >
              <td style={{ padding: "8px 12px" }}>
                {r.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.avatar_url}
                    alt=""
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: ADMIN.surface2,
                      color: ADMIN.ink300,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                    }}
                  >
                    {name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </td>
              <td style={{ padding: "10px 12px", fontSize: 13 }}>
                <Link
                  href={`/admin/clients/${r.user_id}`}
                  style={{ color: ADMIN.ink900, textDecoration: "none" }}
                >
                  {name}
                </Link>
                {r.pinfl ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: ADMIN.ink500,
                      fontFamily: ADMIN.fontMono,
                    }}
                  >
                    {r.pinfl}
                  </div>
                ) : null}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  color: ADMIN.ink700,
                }}
              >
                {r.age ?? "—"}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  color: ADMIN.ink700,
                }}
              >
                {r.city ?? "—"}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  fontFamily: ADMIN.fontMono,
                  color: ADMIN.ink500,
                }}
              >
                {r.phone_number_masked ?? "—"}
              </td>
              <td
                style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink500 }}
              >
                {r.telegram_username ? `@${r.telegram_username}` : "—"}
              </td>
              <td style={{ padding: "10px 12px" }}>
                {r.verification_status === "approved" ? (
                  <StatusPill kind="verified">approved</StatusPill>
                ) : (
                  <StatusPill kind="pending">{r.verification_status}</StatusPill>
                )}
              </td>
              <td
                style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink500 }}
              >
                {new Date(r.created_at).toLocaleDateString("ru-RU")}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
