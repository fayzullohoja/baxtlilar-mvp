"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { InterestModal } from "./InterestModal";

/**
 * V2 InterestActions — два варианта решения по кандидату.
 *
 * Primary: «Отправить интерес» → открывает InterestModal.
 * Ghost:   «Сейчас не подходит» → POST /api/feed/skip → refresh,
 *          получим следующий мэтч (или empty state).
 *
 * Источник истины: [[project-baxtlilar-v2-matching-model]] — пользователь
 * либо принимает рекомендацию, либо вежливо пропускает.
 *
 * Skip пишется в match_views (RLS-фильтр в get_recommendations исключит
 * этого user_id из дальнейших рекомендаций — анти-рулетка от F5).
 */

type Props = {
  candidateId: string;
  candidateFirstName: string;
};

export function InterestActions({ candidateId, candidateFirstName }: Props) {
  const router = useRouter();
  const [skipping, startSkip] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const [transientError, setTransientError] = useState(false);
  const t = useTranslations("Feed");

  function skip() {
    if (skipping || limitHit) return;
    startSkip(async () => {
      setTransientError(false);
      const res = await fetch("/api/feed/skip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_id: candidateId }),
      }).catch(() => null);

      if (res?.ok) {
        router.refresh();
        return;
      }

      // Раньше здесь стояло `if (res.status === 429) setLimitHit(true)`, и это
      // склеивало три разные вещи в одну надпись «на сегодня достаточно»:
      //   - настоящий дневной лимит (роут отдаёт daily_limit);
      //   - общий ограничитель нагрузки в proxy.ts (тот же 429, но rate_limited);
      //   - сбой базы или сети (500 либо вовсе нет ответа) - он не показывался
      //     никак, кнопка просто молча ничего не делала.
      // Хуже того, состояние залипало: кнопки исчезали до перезахода в
      // приложение, хотя человек сегодня не пропустил ни одного кандидата.
      // Теперь различаем по коду в теле: залипает только настоящий лимит,
      // остальное - обычная ошибка с предложением повторить.
      const code = res
        ? await res
            .json()
            .then((b: { error?: string }) => b?.error)
            .catch(() => undefined)
        : undefined;

      if (code === "daily_limit") setLimitHit(true);
      else setTransientError(true);
    });
  }

  if (limitHit) {
    return (
      <p
        className="v2-rise"
        style={{
          fontSize: "13.5px",
          fontWeight: 600,
          lineHeight: 1.55,
          textAlign: "center",
          background: "var(--color-v2-ink-100)",
          color: "#FFF7F0",
          borderRadius: "14px",
          padding: "14px 18px",
          margin: 0,
          fontFamily: "var(--font-v2-body)",
        }}
      >
        <strong style={{ display: "block", marginBottom: "4px" }}>
          {t("skip_limit_title")}
        </strong>
        {t("skip_limit_body")}
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <Button
          variant="primary"
          onClick={() => setModalOpen(true)}
          disabled={skipping}
        >
          Отправить интерес
        </Button>
        <Button
          variant="secondary"
          onClick={skip}
          disabled={skipping}
        >
          {skipping ? "..." : "Сейчас не подходит"}
        </Button>
      </div>

      {transientError ? (
        <p
          role="status"
          style={{
            marginTop: "10px",
            marginBottom: 0,
            fontSize: "13px",
            fontWeight: 600,
            textAlign: "center",
            color: "var(--color-v2-danger)",
            fontFamily: "var(--font-v2-body)",
          }}
        >
          {t("skip_failed")}
        </p>
      ) : null}

      {modalOpen ? (
        <InterestModal
          candidateId={candidateId}
          candidateFirstName={candidateFirstName}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}
