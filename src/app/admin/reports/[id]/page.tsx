import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { ReportTriageActions } from "./ReportTriageActions";

export const dynamic = "force-dynamic";

const REASON_RU: Record<string, string> = {
  fake: "Фейковый профиль",
  offensive: "Оскорбления",
  contacts: "Навязывает контакты",
  spam: "Спам",
  inappropriate: "Неприемлемо",
  other: "Другое",
};
const STATUS_RU: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  requires_clarification: "Нужны уточнения",
  escalated: "Эскалация",
  action_taken: "Меры приняты",
  not_confirmed: "Отклонена",
  confirmed: "Подтверждена",
  closed: "Закрыта",
};

// REP-1/SG-05: детальная triage-карточка жалобы. Отправитель СКРЫТ (privacy);
// в транскрипте участники обезличены (Нарушитель / Собеседник). Superadmin-only.
export default async function ReportDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin();
  if (session.role !== "superadmin") notFound();
  const { id } = await params;
  const sb = supabaseAdmin();

  const { data: admin } = await sb
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const { data: report } = await sb
    .from("reports")
    .select("id, target_user_id, chat_id, reason_code, comment, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!report) notFound();

  const targetId = report.target_user_id as string;

  const { data: target } = await sb
    .from("users")
    .select("telegram_first_name, telegram_username, lifecycle_state, verification_status")
    .eq("id", targetId)
    .maybeSingle();
  const { data: tp } = await sb
    .from("user_profiles")
    .select("display_name")
    .eq("user_id", targetId)
    .maybeSingle();
  const targetName =
    (tp?.display_name as string) ||
    (target?.telegram_first_name as string) ||
    (target?.telegram_username ? "@" + target.telegram_username : targetId.slice(0, 8));

  const { data: history } = await sb
    .from("reports")
    .select("id, reason_code, comment, status, created_at")
    .eq("target_user_id", targetId)
    .order("created_at", { ascending: false })
    .limit(30);

  // Транскрипт связанного чата — evidence. Участников не именуем.
  let transcript: { who: "target" | "other"; body: string; at: string }[] = [];
  if (report.chat_id) {
    const { data: msgs } = await sb
      .from("chat_messages")
      .select("sender_id, body, created_at")
      .eq("chat_id", report.chat_id as string)
      .order("created_at", { ascending: true })
      .limit(200);
    transcript = (msgs ?? []).map((m) => ({
      who: (m.sender_id as string) === targetId ? "target" : "other",
      body: m.body as string,
      at: m.created_at as string,
    }));
  }

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <Link href="/admin/reports" style={{ fontSize: 13, color: ADMIN.accent, textDecoration: "none" }}>
        ← К жалобам
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0 4px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>
          Жалоба · {REASON_RU[report.reason_code as string] ?? report.reason_code}
        </h1>
        <StatusPill kind="warning">{STATUS_RU[report.status as string] ?? report.status}</StatusPill>
      </div>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 24 }}>
        {new Date(report.created_at as string).toLocaleString("ru-RU")} · отправитель скрыт
      </p>

      {report.comment ? (
        <div style={card}>
          <div style={label}>Комментарий жалобщика</div>
          <div style={{ fontSize: 14, fontStyle: "italic" }}>«{report.comment as string}»</div>
        </div>
      ) : null}

      {/* Нарушитель */}
      <div style={card}>
        <div style={label}>Нарушитель</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Link href={`/admin/clients/${targetId}`} style={{ fontSize: 15, fontWeight: 500, color: ADMIN.ink900 }}>
            {targetName}
          </Link>
          {target?.lifecycle_state === "blocked" ? <StatusPill kind="banned">заблокирован</StatusPill> : null}
          <span style={{ fontSize: 12, color: ADMIN.ink500 }}>
            жалоб всего: {history?.length ?? 0}
          </span>
          <Link href={`/admin/clients/${targetId}`} style={{ fontSize: 13, color: ADMIN.accent }}>
            открыть карточку (danger-zone) →
          </Link>
        </div>
      </div>

      {/* Действия */}
      <ReportTriageActions
        reportId={id}
        targetId={targetId}
        targetBlocked={target?.lifecycle_state === "blocked"}
      />

      {/* Evidence-чат */}
      <div style={card}>
        <div style={label}>Переписка (доказательство)</div>
        {report.chat_id ? (
          transcript.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 460, overflowY: "auto" }}>
              {transcript.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.who === "target" ? "flex-start" : "flex-end",
                    maxWidth: "80%",
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: m.who === "target" ? "#fcf0f3" : ADMIN.surface2,
                    border: `1px solid ${m.who === "target" ? ADMIN.danger : ADMIN.border}`,
                  }}
                >
                  <div style={{ fontSize: 11, color: ADMIN.ink500, marginBottom: 2 }}>
                    {m.who === "target" ? "Нарушитель" : "Собеседник"} ·{" "}
                    {new Date(m.at).toLocaleString("ru-RU")}
                  </div>
                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{m.body}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: ADMIN.ink500 }}>Сообщений нет.</div>
          )
        ) : (
          <div style={{ fontSize: 13, color: ADMIN.ink500 }}>
            Жалоба не привязана к чату — переписки нет.
          </div>
        )}
      </div>

      {/* История жалоб на нарушителя */}
      {history && history.length > 1 ? (
        <div style={card}>
          <div style={label}>История жалоб на нарушителя</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.map((h) => (
              <div
                key={h.id as string}
                style={{ display: "flex", gap: 12, fontSize: 13, color: ADMIN.ink700 }}
              >
                <span style={{ color: ADMIN.ink500, fontFamily: ADMIN.fontMono, fontSize: 12 }}>
                  {new Date(h.created_at as string).toLocaleDateString("ru-RU")}
                </span>
                <span>{REASON_RU[h.reason_code as string] ?? h.reason_code}</span>
                <span style={{ color: ADMIN.ink500 }}>
                  {STATUS_RU[h.status as string] ?? h.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </OpsShell>
  );
}

const card: React.CSSProperties = {
  padding: 20,
  marginBottom: 20,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 8,
  background: ADMIN.surface,
};
const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: ADMIN.ink500,
  marginBottom: 10,
};
