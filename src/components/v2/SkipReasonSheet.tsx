"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  SELECTABLE_SKIP_REASONS,
  suggestsFilterFix,
  type SkipReason,
} from "@/lib/matching/skip-reasons";

/**
 * Шторка выбора причины отказа от кандидата.
 *
 * Почему она вообще есть. Отказ перестал быть навсегда: причина решает срок
 * возврата (см. skip-reasons.ts). Без причины сроком был бы один общий месяц, и
 * мы бы так и не узнали, что именно не сработало.
 *
 * Почему это НЕ опрос - хотя технически спрашивает:
 *
 *   - нет вопроса в заголовке. «Почему он вам не понравился?» звучит как допрос
 *     и заставляет оправдываться. Вместо этого одна спокойная строка о том,
 *     зачем это нужно ЧЕЛОВЕКУ: чтобы подбор стал точнее;
 *   - нет переключателей и нет кнопки «отправить». Тап по строке и есть ответ,
 *     шторка закрывается сама. Один тап вместо трёх;
 *   - «Просто дальше» той же высоты и с тем же кеглем, что причины, но без
 *     карточки и потише по цвету. Это осознанная середина: сделать её вровень с
 *     причинами значит подтолкнуть к самому лёгкому варианту и потерять сигнал,
 *     а спрятать в мелкий серый текст - приём из тёмных паттернов. Отказ
 *     отвечать остаётся доступным одним тапом и не выглядит наказанием;
 *   - закрытие любым способом (крестик, фон, Escape, кнопка «назад») всё равно
 *     засчитывает отказ. Человек нажал «не подходит» - его решение услышано,
 *     и передумать шторка его не заставляет.
 *
 * Две причины - «не по возрасту» и «не мой город» - на самом деле претензия к
 * ФИЛЬТРУ. На них шторка не закрывается, а показывает, что произошло, и
 * предлагает поправить рамки. Это отвечает на настоящий вопрос человека
 * («почему мне показывают не тех») вместо того, чтобы молча спрятать карточку.
 */

type Props = {
  candidateId: string;
  /** Показывался ли этот человек раньше и вернулся после срока. */
  returning?: boolean;
  onDone: () => void;
  onLimitHit: () => void;
  onError: () => void;
};

type Phase = "choosing" | "filter-hint";

export function SkipReasonSheet({
  candidateId,
  returning = false,
  onDone,
  onLimitHit,
  onError,
}: Props) {
  const t = useTranslations("SkipSheet");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("choosing");
  const [hintKind, setHintKind] = useState<"age" | "geo">("age");
  // Отказ отправляем ровно один раз, чем бы шторку ни закрыли.
  const sent = useRef(false);
  const closing = useRef(false);

  // Открываем НЕ сразу: элемент должен успеть отрисоваться в закрытом положении,
  // иначе переходу не с чего стартовать и шторка просто возникнет на месте.
  //
  // Кадр плюс запасной таймер, а не один кадр: requestAnimationFrame в скрытой
  // вкладке душится и может не сработать вовсе - тогда шторка осталась бы
  // закрытой навсегда, хотя разметка уже на экране. Таймер срабатывает в любом
  // случае. Что выстрелит первым, то и откроет; второе безвредно.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    const fallback = window.setTimeout(() => setOpen(true), 60);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
    };
  }, []);

  async function send(reason: SkipReason): Promise<"ok" | "limit" | "error"> {
    if (sent.current) return "ok";
    sent.current = true;
    const res = await fetch("/api/feed/skip", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_id: candidateId, reason }),
    }).catch(() => null);
    if (res?.ok) return "ok";
    const data = (await res?.json().catch(() => ({}))) as { error?: string };
    return data?.error === "daily_limit" ? "limit" : "error";
  }

  /* Ведём в РЕДАКТОР профиля, а не на шаг анкеты. Экраны анкеты пускают только
     тех, кто на этом шаге стоит: активного человека они выбрасывают обратно в
     ленту - проверено переходом, попадаешь на /main. То есть кнопка «поправить»
     вела бы в тупик ровно для тех, кому она нужна. */

  /** Закрыть с анимацией, потом отдать управление наверх. */
  function closeThen(after: () => void) {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    // Ждём ровно столько, сколько длится выход (180 мс в globals.css).
    window.setTimeout(after, 180);
  }

  async function choose(reason: SkipReason) {
    const outcome = await send(reason);
    if (outcome === "limit") return closeThen(onLimitHit);
    if (outcome === "error") return closeThen(onError);

    // Жалоба на фильтр: не закрываемся, а объясняем и предлагаем поправить.
    if (suggestsFilterFix(reason)) {
      setHintKind(reason);
      setPhase("filter-hint");
      return;
    }
    closeThen(onDone);
  }

  /** Закрытие без выбора - тоже отказ, просто без причины. */
  async function dismiss() {
    if (phase === "filter-hint") return closeThen(onDone);
    const outcome = await send("dismissed");
    if (outcome === "limit") return closeThen(onLimitHit);
    if (outcome === "error") return closeThen(onError);
    closeThen(onDone);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") void dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const rows: SkipReason[] = returning
    ? [...SELECTABLE_SKIP_REASONS, "never"]
    : [...SELECTABLE_SKIP_REASONS];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("aria_label")}
      style={{ position: "fixed", inset: 0, zIndex: 40 }}
    >
      <div
        className="v2-sheet-backdrop"
        data-open={open}
        onClick={() => void dismiss()}
        style={{ position: "absolute", inset: 0, background: "rgba(42, 26, 46, 0.55)" }}
      />
      <div
        className="v2-sheet"
        data-open={open}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          marginLeft: "auto",
          marginRight: "auto",
          maxWidth: "var(--v2-max-width)",
          background: "var(--color-v2-paper)",
          borderTopLeftRadius: "var(--v2-radius-card)",
          borderTopRightRadius: "var(--v2-radius-card)",
          padding: "10px var(--v2-screen-padding) calc(20px + env(safe-area-inset-bottom))",
          boxShadow: "0 -12px 34px rgba(42, 26, 46, 0.16)",
        }}
      >
        {/* Полоска-ручка: показывает, что это шторка снизу, а не экран. */}
        <div
          aria-hidden
          style={{
            width: 36,
            height: 4,
            borderRadius: 999,
            background: "var(--color-v2-border)",
            margin: "0 auto 14px",
          }}
        />

        {phase === "choosing" ? (
          <>
            {/* Не вопрос, а польза для самого человека. */}
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 13,
                lineHeight: 1.45,
                color: "var(--color-v2-ink-300)",
                fontFamily: "var(--font-v2-body)",
                textAlign: "center",
              }}
            >
              {t("lead")}
            </p>

            {rows.map((r) => (
              <button
                key={r}
                className="v2-sheet-row"
                onClick={() => void choose(r)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "14px 16px",
                  marginBottom: 8,
                  fontSize: 15,
                  lineHeight: 1.35,
                  fontFamily: "var(--font-v2-body)",
                  color: "var(--color-v2-ink-100)",
                  background: "var(--color-v2-paper-2)",
                  border: "1px solid var(--color-v2-border)",
                  borderRadius: "var(--v2-radius-md)",
                  cursor: "pointer",
                }}
              >
                {t(`reason_${r}`)}
              </button>
            ))}

            {/* На равных с остальными: отказ отвечать - нормальный ответ. */}
            <button
              className="v2-sheet-row"
              onClick={() => void dismiss()}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "14px 16px",
                fontSize: 15,
                lineHeight: 1.35,
                fontFamily: "var(--font-v2-body)",
                color: "var(--color-v2-ink-300)",
                background: "transparent",
                border: "1px solid transparent",
                borderRadius: "var(--v2-radius-md)",
                cursor: "pointer",
              }}
            >
              {t("just_next")}
            </button>
          </>
        ) : (
          <>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: 16,
                lineHeight: 1.35,
                fontWeight: 600,
                color: "var(--color-v2-ink-100)",
                fontFamily: "var(--font-v2-display)",
              }}
            >
              {t(`hint_title_${hintKind}`)}
            </p>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: 14,
                lineHeight: 1.5,
                color: "var(--color-v2-ink-300)",
                fontFamily: "var(--font-v2-body)",
              }}
            >
              {t(`hint_body_${hintKind}`)}
            </p>
            <button
              className="v2-sheet-row"
              onClick={() =>
                closeThen(() => router.push("/v2/profile/edit"))
              }
              style={{
                display: "block",
                width: "100%",
                padding: "14px 16px",
                marginBottom: 8,
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "var(--font-v2-body)",
                color: "#fff",
                background: "var(--v2-grad-primary)",
                border: "none",
                borderRadius: "var(--v2-radius-md)",
                cursor: "pointer",
              }}
            >
              {t("hint_cta")}
            </button>
            <button
              className="v2-sheet-row"
              onClick={() => closeThen(onDone)}
              style={{
                display: "block",
                width: "100%",
                padding: "14px 16px",
                fontSize: 15,
                fontFamily: "var(--font-v2-body)",
                color: "var(--color-v2-ink-300)",
                background: "transparent",
                border: "1px solid transparent",
                borderRadius: "var(--v2-radius-md)",
                cursor: "pointer",
              }}
            >
              {t("hint_later")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
