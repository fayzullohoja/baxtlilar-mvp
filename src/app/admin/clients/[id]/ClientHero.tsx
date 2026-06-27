"use client";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import type { LoadedClient } from "@/lib/admin/load-client";

export function ClientHero({ client }: { client: LoadedClient }) {
  const id = client.identity;
  const full = id
    ? `${id.last_name} ${id.first_name} ${id.middle_name ?? ""}`.trim()
    : (client.user.display_name ?? client.user.telegram_first_name ?? "—");
  const age = id ? calcAge(id.birth_date) : null;

  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        alignItems: "flex-start",
        paddingBottom: 24,
        borderBottom: `1px solid ${ADMIN.border}`,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 8,
          background: ADMIN.surface2,
          overflow: "hidden",
          flexShrink: 0,
          border: `1px solid ${ADMIN.border}`,
        }}
      >
        {client.user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={client.user.avatar_url}
            alt={full}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: ADMIN.ink300,
              fontSize: 32,
            }}
          >
            {full.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: ADMIN.ink900,
            marginBottom: 6,
          }}
        >
          {full}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {client.user.verification_status === "approved" ? (
            <StatusPill kind="verified">Verified</StatusPill>
          ) : (
            <StatusPill kind="pending">
              {client.user.verification_status}
            </StatusPill>
          )}
          {client.user.lifecycle_state === "active" ? (
            <StatusPill kind="active">Active</StatusPill>
          ) : (
            <StatusPill kind="paused">
              {client.user.lifecycle_state}
            </StatusPill>
          )}
        </div>
        <div
          style={{ fontSize: 13, color: ADMIN.ink700, marginBottom: 6 }}
        >
          {age ? `${age} лет` : "возраст —"}
          {id ? ` · ${id.gender} · ${id.citizenship} · ${id.locality}` : ""}
        </div>
        {id ? (
          <>
            <CopyableRow label="ПИНФЛ" value={id.pinfl} />
            <CopyableRow
              label="Паспорт"
              value={`${id.passport_series}${id.passport_number}`}
            />
          </>
        ) : null}
        {client.user.telegram_username ? (
          <div
            style={{
              fontSize: 12,
              color: ADMIN.ink500,
              marginTop: 6,
            }}
          >
            TG @{client.user.telegram_username}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CopyableRow({ label, value }: { label: string; value: string }) {
  function copy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(value);
    }
  }
  return (
    <div
      style={{
        fontSize: 13,
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginTop: 2,
      }}
    >
      <span style={{ color: ADMIN.ink500, minWidth: 60 }}>{label}</span>
      <span style={{ fontFamily: ADMIN.fontMono }}>{value}</span>
      <button
        onClick={copy}
        style={{
          background: "transparent",
          border: 0,
          cursor: "pointer",
          color: ADMIN.ink500,
          fontSize: 11,
          padding: "2px 6px",
        }}
      >
        copy
      </button>
    </div>
  );
}

function calcAge(isoDate: string): number {
  const bd = new Date(isoDate);
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  if (
    now.getMonth() < bd.getMonth() ||
    (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())
  ) {
    age--;
  }
  return age;
}
