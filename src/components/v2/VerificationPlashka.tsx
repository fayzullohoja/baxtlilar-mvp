/**
 * V2 VerificationPlashka — статусная карточка верификации для shadow users.
 *
 * Editorial DNA. Не "alert". Не "banner". Карточка с собственной личностью.
 *
 * Показывается на /main когда роль = shadow. Контент зависит от
 * verification_status:
 *   - submitted / pending_review → "Модератор смотрит, обычно 2-4 часа"
 *   - needs_changes              → "Нужно поправить" + кнопка
 *   - rejected                   → "Не прошёл": кнопка при техническом отказе,
 *                                  поддержка при блокирующем
 *
 * Если verification_submitted_at задан — показываем относительное время
 * ("отправлено 1 час назад").
 *
 * ВАЖНО (12.08.2026): кнопка здесь - не украшение, а единственный вход в
 * повторную подачу документов для человека, который дошёл до lifecycle='active'
 * с неодобренной верификацией. Без неё решение модератора needs_changes/
 * rejected становилось для него необратимым: экраны починки гейтились шагом
 * онбординга, а шаг у него уже 'active'.
 */

"use client";
import type { VerificationStatus } from "@/lib/state-machine/types";
import { Headline } from "./Headline";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

type Props = {
  status: VerificationStatus;
  submittedAt: string | null;
  /**
   * Куда вести за повторной подачей документов. null - чинить нечего
   * (статус не требует действий) либо нельзя (блокирующий отказ: подделка,
   * катфиш, несовершеннолетний - таким retry закрыт, узла в DOM быть не должно).
   */
  repairHref?: string | null;
};

type Content = {
  eyebrow: string;
  title: string;
  body: string;
};

function contentFor(
  status: VerificationStatus,
  t: ReturnType<typeof useTranslations>,
  canRepair: boolean,
): Content {
  switch (status) {
    case "documents_uploaded":
    case "liveness_uploaded":
    case "pending_review":
      return {
        eyebrow: t("queued.label"),
        title: t("queued.title"),
        body: t("queued.body"),
      };
    case "needs_changes":
      return {
        eyebrow: t("needsChanges.label"),
        title: t("needsChanges.title"),
        body: t("needsChanges.body"),
      };
    case "rejected":
      // Технический отказ («не смогли разобрать фото») и блокирующий
      // («не подтвердили личность») - разные сообщения. Отличаем по тому, дали
      // ли нам ссылку на починку: её считает сервер по reject_category.
      return canRepair
        ? {
            eyebrow: t("rejectedTechnical.label"),
            title: t("rejectedTechnical.title"),
            body: t("rejectedTechnical.body"),
          }
        : {
            eyebrow: t("rejected.label"),
            title: t("rejected.title"),
            body: t("rejected.body"),
          };
    case "not_started":
    case "phone_verified":
      return {
        eyebrow: t("notStarted.label"),
        title: t("notStarted.title"),
        body: t("notStarted.body"),
      };
    case "approved":
    case "revoked":
      // Сюда мы не должны попадать (approved → не shadow), но возвращаем
      // что-то на случай race.
      return {
        eyebrow: t("approved.label"),
        title: t("approved.title"),
        body: t("approved.body"),
      };
  }
}

function timeAgo(iso: string | null, tTime: ReturnType<typeof useTranslations>): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return tTime("justNow");
  if (min < 60) return tTime("minutesAgo", { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return tTime("hoursAgo", { n: hr });
  const day = Math.floor(hr / 24);
  return tTime("daysAgo", { n: day });
}

export function VerificationPlashka({ status, submittedAt, repairHref = null }: Props) {
  const t = useTranslations("VerificationPlashka");
  const canRepair = repairHref !== null;
  const c = contentFor(status, t, canRepair);
  const ago = timeAgo(submittedAt, t);

  return (
    <div
      data-v2="true"
      className="v2-rise"
      style={{
        background: "#fff",
        border: "1px solid var(--color-v2-border)",
        borderRadius: "var(--v2-radius-card)",
        boxShadow: "var(--v2-shadow-card)",
        padding: "32px 24px",
        margin: "24px var(--v2-screen-padding)",
        maxWidth: "var(--v2-max-width)",
        marginLeft: "auto",
        marginRight: "auto",
        fontFamily: "var(--font-v2-body)",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "var(--color-v2-accent)",
          marginBottom: "16px",
        }}
      >
        {c.eyebrow}
        {ago ? (
          <span
            style={{
              marginLeft: "12px",
              color: "var(--color-v2-ink-400)",
              fontWeight: 700,
            }}
          >
            · {ago}
          </span>
        ) : null}
      </div>
      <Headline size="md" as="h2">
        {c.title}
      </Headline>
      <p
        style={{
          fontSize: "15px",
          lineHeight: "1.55",
          color: "var(--color-v2-ink-200)",
          marginTop: "16px",
        }}
      >
        {c.body}
      </p>
      {repairHref ? (
        <Link
          href={repairHref}
          style={{
            display: "block",
            marginTop: "24px",
            padding: "16px 24px",
            borderRadius: "999px",
            background: "var(--color-v2-accent)",
            color: "#fff",
            fontSize: "15px",
            fontWeight: 700,
            textAlign: "center",
            textDecoration: "none",
          }}
        >
          {t("repairCta")}
        </Link>
      ) : null}
    </div>
  );
}
