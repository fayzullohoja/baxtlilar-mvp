"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./Button";
import type { BlockedPerson } from "@/lib/safety/blocked-list";

/**
 * Список заблокированных с возможностью снять блокировку.
 *
 * Замечание 11 тестеров family launch: заблокированный исчезал полностью и
 * нигде не показывался, хотя серверная ручка разблокировки существовала с
 * самого начала. Действие выглядело необратимым, будучи обратимым - люди
 * блокировали по ошибке и жили с этим.
 *
 * Показываем только СВОИ блокировки. Кто заблокировал меня - не показываем
 * никогда: блокировка по замыслу тихая, и обратное направление раскрыло бы её.
 */
type Props = { people: BlockedPerson[] };

export function BlockedList({ people }: Props) {
  const t = useTranslations("Settings");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  function unblock(userId: string) {
    if (pending) return;
    setBusyId(userId);
    setFailedId(null);
    startTransition(async () => {
      const res = await fetch("/api/block", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_id: userId, action: "unblock" }),
      }).catch(() => null);

      setBusyId(null);
      if (res?.ok) {
        router.refresh();
        return;
      }
      // Не молчим при неудаче: человек должен понимать, что блокировка осталась,
      // а не думать, что снял её.
      setFailedId(userId);
    });
  }

  if (!people.length) {
    return (
      <p
        style={{
          margin: 0,
          fontSize: "13.5px",
          lineHeight: 1.55,
          color: "var(--color-v2-ink-400)",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        {t("blocked_empty")}
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "10px" }}>
      {people.map((p) => (
        <li
          key={p.userId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 14px",
            background: "#fff",
            borderRadius: "14px",
            boxShadow: "var(--v2-shadow-card)",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: "42px",
              height: "42px",
              flex: "0 0 auto",
              borderRadius: "999px",
              background: p.photoUrl
                ? `center/cover no-repeat url(${JSON.stringify(p.photoUrl)})`
                : "var(--color-v2-paper-2)",
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 700,
                fontFamily: "var(--font-v2-body)",
                color: "var(--color-v2-ink-100)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {p.name || t("blocked_unknown")}
            </div>
            <div style={{ fontSize: "12.5px", color: "var(--color-v2-ink-400)" }}>
              {[p.age, p.city].filter(Boolean).join(" · ") || " "}
            </div>
            {failedId === p.userId ? (
              <div
                role="status"
                style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-v2-danger)" }}
              >
                {t("blocked_unblock_failed")}
              </div>
            ) : null}
          </div>
          <Button
            variant="secondary"
            onClick={() => unblock(p.userId)}
            disabled={pending && busyId === p.userId}
          >
            {pending && busyId === p.userId ? "..." : t("blocked_unblock")}
          </Button>
        </li>
      ))}
    </ul>
  );
}
