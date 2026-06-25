/**
 * V2 VerificationPlashka — статусная карточка верификации для shadow users.
 *
 * Editorial DNA. Не "alert". Не "banner". Карточка с собственной личностью.
 *
 * Показывается на /main когда роль = shadow. Контент зависит от
 * verification_status:
 *   - submitted / pending_review → "Модератор смотрит, обычно 2-4 часа"
 *   - needs_changes              → "Нужно поправить" + кнопка
 *   - rejected                   → "Не прошёл" (final)
 *
 * Если verification_submitted_at задан — показываем относительное время
 * ("отправлено 1 час назад").
 */

import type { VerificationStatus } from "@/lib/state-machine/types";
import { Headline } from "./Headline";

type Props = {
  status: VerificationStatus;
  submittedAt: string | null;
};

type Content = {
  eyebrow: string;
  title: string;
  body: string;
};

function contentFor(status: VerificationStatus): Content {
  switch (status) {
    case "documents_uploaded":
    case "liveness_uploaded":
    case "pending_review":
      return {
        eyebrow: "В очереди",
        title: "Модератор сейчас смотрит твою заявку.",
        body: "Обычно это занимает 2–4 часа. Когда решение будет — придёт уведомление в Telegram. Пока ты не показываешься в ленте и не видишь чужих анкет.",
      };
    case "needs_changes":
      return {
        eyebrow: "Нужно поправить",
        title: "Модератор просит уточнить пару моментов.",
        body: "Обычно это плохое селфи или нечитаемая фотография паспорта. Открой раздел верификации и переделай — займёт пару минут.",
      };
    case "rejected":
      return {
        eyebrow: "Не прошёл",
        title: "К сожалению, мы не можем подтвердить твой профиль.",
        body: "Если думаешь, что это ошибка — напиши нам в @baxtlilar_support. Решение модератора окончательное.",
      };
    case "not_started":
    case "phone_verified":
      return {
        eyebrow: "Шаг не пройден",
        title: "Сначала верификация.",
        body: "Чтобы тебя показали другим, нужно подтвердить личность — паспорт и селфи. Открой бот и пройди шаги.",
      };
    case "approved":
    case "revoked":
      // Сюда мы не должны попадать (approved → не shadow), но возвращаем
      // что-то на случай race.
      return {
        eyebrow: "Готово",
        title: "Профиль подтверждён.",
        body: "Перезагрузи страницу — должна появиться лента.",
      };
  }
}

function timeAgo(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const day = Math.floor(hr / 24);
  return `${day} д назад`;
}

export function VerificationPlashka({ status, submittedAt }: Props) {
  const c = contentFor(status);
  const ago = timeAgo(submittedAt);

  return (
    <div
      data-v2="true"
      style={{
        background: "var(--color-v2-paper)",
        border: "1px solid var(--color-v2-ink-500)",
        borderRadius: "var(--v2-radius-lg)",
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
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--color-v2-ink-400)",
          marginBottom: "16px",
        }}
      >
        {c.eyebrow}
        {ago ? <span style={{ marginLeft: "12px" }}>· {ago}</span> : null}
      </div>
      <Headline size="md" as="h2">
        {c.title}
      </Headline>
      <p
        style={{
          fontSize: "15px",
          lineHeight: "1.55",
          color: "var(--color-v2-ink-300)",
          marginTop: "16px",
        }}
      >
        {c.body}
      </p>
    </div>
  );
}
