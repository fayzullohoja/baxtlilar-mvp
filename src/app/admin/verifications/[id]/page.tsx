import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, checkInQueueOrSuperPage } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapOne } from "@/lib/db/unwrap";
import { V2AdminShell } from "@/components/v2/AdminShell";
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
 * V2 Admin · Verification Detail (Blueprint §4.3.2).
 *
 * Split layout: passport+selfie слева, decision form справа.
 * F-120 (in-queue scope) и F-119 (two-person rule) сохраняются на бэке.
 *
 * RevealDoc + DecisionForm — V1 client components с complex business
 * logic, оставляем как есть (только wrap-styling меняется).
 */
export default async function VerificationCard({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  const { id } = await params;

  const ipAddr = ipFromHeaders(await headers());
  const scope = await checkInQueueOrSuperPage(session, id, "user_view", ipAddr);
  if ("hide" in scope) notFound();

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
    <V2AdminShell active="/admin/verifications" role={session.role}>
      <Link
        href="/admin/verifications"
        style={{
          fontSize: "13px",
          color: "var(--color-v2-ink-400)",
          textDecoration: "none",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        ← К очереди
      </Link>

      <header style={{ marginTop: "12px", marginBottom: "32px" }}>
        <h1
          style={{
            fontFamily: "var(--font-v2-display)",
            fontSize: "32px",
            lineHeight: "1.15",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "var(--color-v2-ink-100)",
            margin: 0,
          }}
        >
          {name}
        </h1>
        <div
          style={{
            marginTop: "10px",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--color-v2-ink-400)",
            fontFamily: "var(--font-v2-body)",
          }}
        >
          Статус · {pending ? "на проверке" : (user.verification_status as string)}
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Left: user data + docs */}
        <div
          style={{
            background: "var(--color-v2-paper)",
            border: "1px solid var(--color-v2-ink-500)",
            borderRadius: "var(--v2-radius-md)",
            padding: "24px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--color-v2-ink-400)",
              marginBottom: "16px",
              fontFamily: "var(--font-v2-body)",
            }}
          >
            Данные пользователя
          </div>
          <Row k="Telegram" v={user.telegram_username ? "@" + user.telegram_username : "—"} />
          <Row k="Телефон" v={(user.phone_number as string) ?? "—"} />
          <Row k="Подтверждён" v={user.phone_verified ? "да" : "нет"} />
          <Row
            k="Регистрация"
            v={new Date(user.created_at as string).toLocaleString("ru-RU")}
          />
        </div>

        {/* Right: docs reveal */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <RevealDoc userId={id} kind="passport" label="Паспорт / ID" />
          <RevealDoc userId={id} kind="selfie" label="Селфи" />
        </div>
      </div>

      {/* Decision form full-width below */}
      <div style={{ marginTop: "32px", maxWidth: "640px" }}>
        {pending ? (
          <>
            <div
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--color-v2-ink-400)",
                marginBottom: "12px",
                fontFamily: "var(--font-v2-body)",
              }}
            >
              Решение модератора
            </div>
            <DecisionForm userId={id} />
          </>
        ) : (
          <p
            style={{
              fontSize: "14px",
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-body)",
            }}
          >
            Заявка уже обработана ({user.verification_status as string}).
          </p>
        )}
      </div>
    </V2AdminShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "16px",
        padding: "12px 0",
        borderBottom: "1px solid var(--color-v2-ink-600)",
        fontSize: "14px",
        fontFamily: "var(--font-v2-body)",
      }}
    >
      <span style={{ color: "var(--color-v2-ink-400)" }}>{k}</span>
      <span style={{ color: "var(--color-v2-ink-100)", textAlign: "right" }}>{v}</span>
    </div>
  );
}
