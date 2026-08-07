"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("Main");
  const router = useRouter();
  const [skipping, startSkip] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [limitHit, setLimitHit] = useState(false);

  function skip() {
    if (skipping || limitHit) return;
    startSkip(async () => {
      const res = await fetch("/api/feed/skip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_id: candidateId }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      // D1: дневной лимит пропусков исчерпан — не молчим, а объясняем.
      if (res.status === 429) setLimitHit(true);
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
        {t("interest_daily_limit")}
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
          {t("interest_send")}
        </Button>
        <Button
          variant="secondary"
          onClick={skip}
          disabled={skipping}
        >
          {skipping ? "..." : t("interest_skip")}
        </Button>
      </div>

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
