"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import { InterestModal } from "./InterestModal";
import { SkipReasonSheet } from "./SkipReasonSheet";

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
  /** Кандидат уже показывался и вернулся после срока - см. skip-reasons.ts. */
  returning?: boolean;
};

export function InterestActions({ candidateId, candidateFirstName, returning = false }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  // Отказ больше не отправляется прямо из кнопки: сначала шторка спрашивает
  // причину, и она же решает, на какой срок человек скроется.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const [transientError, setTransientError] = useState(false);
  const t = useTranslations("Feed");

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
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          {t("send_interest")}
        </Button>
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          {t("not_now")}
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

      {sheetOpen ? (
        <SkipReasonSheet
          candidateId={candidateId}
          returning={returning}
          onDone={() => {
            setSheetOpen(false);
            router.refresh();
          }}
          onLimitHit={() => {
            setSheetOpen(false);
            setLimitHit(true);
          }}
          onError={() => {
            setSheetOpen(false);
            setTransientError(true);
          }}
        />
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
