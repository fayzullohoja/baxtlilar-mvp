"use client";

import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { AnketaSubmitNotice } from "./AnketaSubmitNotice";
import { useAnketaSubmit } from "./useAnketaSubmit";

/**
 * V2 Publish — финальное действие на /v2/anketa/preview.
 * POST /api/onboarding/profile/publish → transition в quiz.
 *
 * Ревью оунера: пока верификация НЕ approved, кнопка честно говорит «Отправить
 * на проверку» (анкета видима в подборе только после подтверждения личности),
 * и «Опубликовать» — когда уже approved. Все строки локализованы (ru/uz/tr).
 */

export function V2PublishButton({
  verificationStatus,
}: {
  verificationStatus?: string;
}) {
  const t = useTranslations("Anketa");
  const { busy, errorCode, stepMoved, submit } = useAnketaSubmit(
    "/api/onboarding/profile/publish",
  );
  const isApproved = verificationStatus === "approved";
  // C6: пол в анкете не совпал с паспортом - это не «поправьте анкету», менять
  // пол пользователь не может, нужен оператор. Остальные коды - общий текст.
  const errCopy: Record<string, string> = {
    gender_mismatch: t("error_gender_mismatch"),
    failed: t("error_publish_failed"),
  };

  async function publish() {
    if (busy) return;
    await submit();
  }

  return (
    <div>
      <AnketaSubmitNotice errorCode={errorCode} stepMoved={stepMoved} errorCopy={errCopy} />
      <Button onClick={publish} disabled={busy} variant="primary">
        {busy
          ? isApproved
            ? t("publish_button_approved")
            : t("publish_button_pending")
          : isApproved
            ? t("publish_label_approved")
            : t("publish_label_pending")}
      </Button>
    </div>
  );
}
