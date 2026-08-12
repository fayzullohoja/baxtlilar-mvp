"use client";

/**
 * Список отзывов: фильтр по оценке и сортировка по свежести.
 *
 * Фильтр и сортировка на клиенте, а не запросом: на закрытом запуске отзывов
 * десятки, лишний round-trip к базе ради переключения радиокнопки не окупается.
 */

import { useState } from "react";
import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";
import type { FeedbackRow } from "@/lib/admin/load-feedback";

export function FeedbackList({
  rows,
  canOpenClient,
}: {
  rows: FeedbackRow[];
  // Имя автора ведёт в карточку клиента, а карточка - это паспортная PII:
  // модератору она открыта только для своей очереди, а заход мимо неё
  // записывается как нарушение области видимости (admin_scope_violations) и
  // всё равно отдаёт 404. Ссылку показываем только тому, кому карточка
  // открыта всегда - иначе админка сама наводила бы на модератора улику.
  canOpenClient: boolean;
}) {
  const [rating, setRating] = useState(0);
  const [oldestFirst, setOldestFirst] = useState(false);

  const view = rows
    .filter((r) => (rating ? r.rating === rating : true))
    .slice()
    .sort((a, b) =>
      oldestFirst
        ? a.created_at.localeCompare(b.created_at)
        : b.created_at.localeCompare(a.created_at),
    );

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: ADMIN.ink500 }}>
          Оценка:{" "}
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            style={{ padding: "4px 8px" }}
          >
            <option value={0}>любая</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setOldestFirst((v) => !v)}
          style={{ padding: "4px 10px", fontSize: 13, cursor: "pointer" }}
        >
          {oldestFirst ? "Сначала новые" : "Сначала старые"}
        </button>
        <span style={{ fontSize: 13, color: ADMIN.ink500 }}>Всего: {view.length}</span>
      </div>

      {view.length === 0 ? (
        <p style={{ color: ADMIN.ink500, fontSize: 14 }}>Отзывов пока нет.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {view.map((r) => (
            <div
              key={r.id}
              style={{
                border: `1px solid ${ADMIN.border}`,
                borderRadius: 10,
                padding: 14,
                display: "flex",
                gap: 14,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  {/* role="img" не украшение: без роли aria-label на span не
                      озвучивается, и оценка осталась бы видна только глазами. */}
                  <span style={{ fontSize: 16 }} role="img" aria-label={`оценка ${r.rating} из 5`}>
                    {"★".repeat(r.rating)}
                    <span style={{ color: ADMIN.ink300 }}>{"★".repeat(5 - r.rating)}</span>
                  </span>
                  {canOpenClient ? (
                    <Link href={`/admin/clients/${r.user_id}`} style={{ fontSize: 13 }}>
                      {r.user_label ?? "—"}
                    </Link>
                  ) : (
                    <span style={{ fontSize: 13 }}>{r.user_label ?? "—"}</span>
                  )}
                  <span style={{ fontSize: 12, color: ADMIN.ink500 }}>
                    {new Date(r.created_at).toLocaleString("ru-RU")} · {r.locale}
                  </span>
                </div>
                <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {r.body ?? <span style={{ color: ADMIN.ink500 }}>без текста</span>}
                </p>
              </div>
              {r.screenshot_url && (
                <a href={r.screenshot_url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка с коротким TTL, next/image её проксировать не должен */}
                  <img
                    src={r.screenshot_url}
                    alt="скриншот из отзыва"
                    style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8 }}
                  />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
