"use client";

import { useState, useTransition } from "react";
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

  function skip() {
    if (skipping) return;
    startSkip(async () => {
      const res = await fetch("/api/feed/skip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_id: candidateId }),
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          onClick={() => setModalOpen(true)}
          disabled={skipping}
        >
          Отправить интерес
        </Button>
        <Button
          variant="ghost"
          onClick={skip}
          disabled={skipping}
        >
          {skipping ? "..." : "Сейчас не подходит"}
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
