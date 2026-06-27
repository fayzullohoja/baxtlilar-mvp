import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, checkInQueueOrSuperPage } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapOne } from "@/lib/db/unwrap";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { RevealDoc } from "@/components/admin/reveal-doc";
import { DecisionForm } from "@/components/admin/decision-form";

export const dynamic = "force-dynamic";

function ipFromHeaders(h: Headers): string | null {
  return (
    h.get("x-envoy-external-address") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",").pop()?.trim() ??
    null
  );
}

/**
 * Admin · Verification Detail.
 *
 * Split layout: passport+selfie слева, decision form справа.
 * F-120 (in-queue scope) и F-119 (two-person rule) сохраняются на бэке.
 *
 * RevealDoc + DecisionForm — client components с complex business
 * logic, оставляем как есть (только wrap-styling меняется).
 */
export default async function VerificationCard({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  const { id } = await params;

  const ipAddr = ipFromHeaders(await headers());
  const scope = await checkInQueueOrSuperPage(session, id, "user_view", ipAddr);
  if ("hide" in scope) notFound();

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const user = unwrapOne(
    await supabaseAdmin()
      .from("users")
      .select(
        "id, telegram_id, telegram_username, telegram_first_name, telegram_last_name, " +
          "phone_number, phone_verified, verification_status, onboarding_step, created_at",
      )
      .eq("id", id)
      .maybeSingle(),
  );
  if (!user) notFound();

  const name =
    [user.telegram_first_name, user.telegram_last_name].filter(Boolean).join(" ") ||
    (user.telegram_username ? "@" + user.telegram_username : (user.id as string).slice(0, 8));
  const pending = user.verification_status === "pending_review";

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <Link
        href="/admin/verifications"
        style={{
          fontSize: 13,
          color: ADMIN.ink500,
          textDecoration: "none",
        }}
      >
        ← К очереди
      </Link>

      <header style={{ marginTop: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>{name}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: ADMIN.ink500, fontSize: 13 }}>Статус</span>
          {pending ? (
            <StatusPill kind="pending">на проверке</StatusPill>
          ) : user.verification_status === "approved" ? (
            <StatusPill kind="verified">{user.verification_status as string}</StatusPill>
          ) : (
            <StatusPill kind="rejected">{user.verification_status as string}</StatusPill>
          )}
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Left: user data + docs */}
        <div
          style={{
            background: ADMIN.surface,
            border: `1px solid ${ADMIN.border}`,
            borderRadius: 8,
            padding: 24,
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: ADMIN.ink500,
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            Данные пользователя
          </div>
          <Row k="Telegram" v={user.telegram_username ? "@" + user.telegram_username : "—"} />
          <Row k="Телефон" v={(user.phone_number as string) ?? "—"} mono />
          <Row k="Подтверждён" v={user.phone_verified ? "да" : "нет"} />
          <Row
            k="Регистрация"
            v={new Date(user.created_at as string).toLocaleString("ru-RU")}
          />
        </div>

        {/* Right: docs reveal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <RevealDoc userId={id} kind="passport" label="Паспорт / ID" />
          <RevealDoc userId={id} kind="selfie" label="Селфи" />
        </div>
      </div>

      {/* Decision form full-width below */}
      <div style={{ marginTop: 24, maxWidth: 640 }}>
        {pending ? (
          <>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: ADMIN.ink500,
                fontWeight: 500,
                marginBottom: 12,
              }}
            >
              Решение модератора
            </div>
            <DecisionForm userId={id} />
          </>
        ) : (
          <p style={{ fontSize: 13, color: ADMIN.ink500 }}>
            Заявка уже обработана ({user.verification_status as string}).
          </p>
        )}
      </div>
    </OpsShell>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "10px 0",
        borderBottom: `1px solid ${ADMIN.border}`,
        fontSize: 13,
      }}
    >
      <span style={{ color: ADMIN.ink500 }}>{k}</span>
      <span
        style={{
          color: ADMIN.ink900,
          textAlign: "right",
          fontFamily: mono ? ADMIN.fontMono : undefined,
        }}
      >
        {v}
      </span>
    </div>
  );
}
