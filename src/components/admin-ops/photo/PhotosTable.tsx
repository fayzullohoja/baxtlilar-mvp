"use client";
import { useState } from "react";
import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import { Button } from "@/components/admin-ops/Button";
import { photoTypeLabel } from "@/lib/admin/photo-labels";
import type { PhotoCase } from "@/lib/admin/load-photos";
import { thumb } from "@/lib/storage/thumb-url";

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const th = {
  textAlign: "left" as const,
  padding: "10px 12px",
  fontSize: 11,
  color: ADMIN.ink500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  fontWeight: 500,
};

export function PhotosTable({
  rows,
  onOpen,
  onQuickApprove,
  onQuickReject,
  busyIds,
}: {
  rows: PhotoCase[];
  onOpen: (p: PhotoCase) => void;
  onQuickApprove: (p: PhotoCase) => void;
  onQuickReject: (p: PhotoCase) => void;
  busyIds?: Set<string>; // PH-5: id фото с решением «в полёте» → кнопки disabled
}) {
  // Стабильный «сейчас» за рендер — Date.now() прямо в render impure (purity-lint).
  const [now] = useState(() => Date.now());
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: ADMIN.ink500,
          fontSize: 13,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          background: ADMIN.surface,
        }}
      >
        Очередь пуста.
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
          {["Preview", "Клиент", "Слот", "Загружено", "Статус", "Действия"].map(
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
          const name =
            r.client.display_name ?? r.client.telegram_first_name ?? "—";
          const overdue =
            now - new Date(r.created_at).getTime() > 24 * 3600 * 1000;
          return (
            <tr
              key={r.photo_id}
              style={{ borderBottom: `1px solid ${ADMIN.border}` }}
            >
              <td style={{ padding: "8px 12px" }}>
                {r.signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb(r.signed_url, 320) ?? r.signed_url}
                    alt=""
                    onClick={() => onOpen(r)}
                    // Без lazy намеренно: подпись живёт 300 секунд и вморожена
                    // в разметку, а отложенный запрос вернул бы 403. Превью
                    // весит килобайты, откладывать нечего.
                    decoding="async"
                    width={60}
                    height={80}
                    style={{
                      width: 60,
                      height: 80,
                      objectFit: "cover",
                      borderRadius: 4,
                      cursor: "pointer",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 60,
                      height: 80,
                      background: ADMIN.surface2,
                      borderRadius: 4,
                    }}
                  />
                )}
              </td>
              <td style={{ padding: "10px 12px", fontSize: 13 }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  {r.client.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb(r.client.avatar_url, 160) ?? r.client.avatar_url}
                      alt=""
                      decoding="async"
                      width={24}
                      height={24}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: ADMIN.surface2,
                        color: ADMIN.ink300,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                      }}
                    >
                      {name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <Link
                      href={`/admin/clients/${r.user_id}`}
                      style={{ color: ADMIN.ink900, textDecoration: "none" }}
                    >
                      {name}
                    </Link>
                    <div style={{ fontSize: 11, color: ADMIN.ink500 }}>
                      {r.client.age ? `${r.client.age} · ` : ""}
                      {r.client.city ?? ""}
                    </div>
                  </div>
                </div>
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  color: ADMIN.ink700,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  #{r.ord + 1}
                  {r.is_main ? <StatusPill kind="verified">main</StatusPill> : null}
                  <StatusPill kind={r.photo_type === "family" ? "warning" : "new"}>
                    {photoTypeLabel(r.photo_type)}
                  </StatusPill>
                </div>
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  color: overdue ? ADMIN.danger : ADMIN.ink500,
                }}
              >
                {ago(r.created_at)}
                {overdue ? " ⚠" : ""}
              </td>
              <td style={{ padding: "10px 12px" }}>
                <StatusPill
                  kind={r.status === "under_review" ? "pending" : "new"}
                >
                  {r.status}
                </StatusPill>
              </td>
              <td style={{ padding: "10px 12px" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <Button
                    size="sm"
                    disabled={busyIds?.has(r.photo_id)}
                    onClick={() => onQuickApprove(r)}
                  >
                    {busyIds?.has(r.photo_id) ? "…" : "✓"}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busyIds?.has(r.photo_id)}
                    onClick={() => onQuickReject(r)}
                  >
                    ✕
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyIds?.has(r.photo_id)}
                    onClick={() => onOpen(r)}
                  >
                    ⋯
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
