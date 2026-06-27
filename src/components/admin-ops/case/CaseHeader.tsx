"use client";
import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";

export type CaseHeaderProps = {
  caseShortId: string;
  displayName: string;
  telegramUsername: string | null;
  phoneNumber: string | null;
  state: string;
  createdAt: string;
  step: 1 | 2 | 3 | 4;
};

const STEP_LABELS = [
  "Документы",
  "Паспортные данные",
  "Сверка лица",
  "Решение",
];

export function CaseHeader(p: CaseHeaderProps) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingBottom: 12,
          borderBottom: `1px solid ${ADMIN.border}`,
        }}
      >
        <Link
          href="/admin/queue/mine"
          style={{
            color: ADMIN.ink500,
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          ← Очередь
        </Link>
        <span style={{ color: ADMIN.ink300 }}>·</span>
        <span
          style={{
            fontFamily: ADMIN.fontMono,
            fontSize: 13,
            color: ADMIN.ink900,
          }}
        >
          {p.caseShortId}
        </span>
        <span style={{ color: ADMIN.ink500, fontSize: 13 }}>
          {p.displayName}
        </span>
        <StatusPill
          kind={p.state === "data_entry" ? "warning" : "new"}
        >
          {p.state}
        </StatusPill>
      </div>

      <div
        style={{
          marginTop: 12,
          marginBottom: 16,
          display: "flex",
          gap: 16,
          fontSize: 12,
          color: ADMIN.ink500,
        }}
      >
        <span>
          Submitted {new Date(p.createdAt).toLocaleString("ru-RU")}
        </span>
        {p.telegramUsername ? <span>· TG @{p.telegramUsername}</span> : null}
        {p.phoneNumber ? <span>· phone {maskPhone(p.phoneNumber)}</span> : null}
      </div>

      <div
        style={{
          display: "flex",
          gap: 0,
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4;
          const done = n < p.step;
          const active = n === p.step;
          return (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                flex: i === STEP_LABELS.length - 1 ? 0 : 1,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: active
                    ? ADMIN.ink900
                    : done
                      ? ADMIN.ink700
                      : ADMIN.ink500,
                  fontSize: 12,
                  fontWeight: active ? 500 : 400,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `1px solid ${active ? ADMIN.accent : ADMIN.border}`,
                    background: done ? ADMIN.accent : "transparent",
                    color: done
                      ? "#fff"
                      : active
                        ? ADMIN.accent
                        : ADMIN.ink500,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                  }}
                >
                  {done ? "✓" : n}
                </span>
                {label}
              </div>
              {i < STEP_LABELS.length - 1 ? (
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: done ? ADMIN.accent : ADMIN.border,
                    margin: "0 12px",
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

function maskPhone(p: string): string {
  if (p.length < 6) return p;
  return p.slice(0, 4) + " *** " + p.slice(-4);
}
