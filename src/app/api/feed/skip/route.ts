import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkAndIncrement } from "@/lib/matching/quota";
import { requirePermissionForRequest } from "@/lib/v2/with-permission";
import { hiddenUntil, isSkipReason, suggestsFilterFix } from "@/lib/matching/skip-reasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Пропустить кандидата — пишем match_views (исключение из ленты).
 *
 * V2 Phase A: gate через withPermission. Shadow user не видит ленту,
 * значит не может вызывать skip.
 *
 * D1: дневной лимит пропусков (DAILY_LIMITS.views=30). Лимит атомарный
 * (bump_quota, граница суток Asia/Tashkent).
 *
 * ОТКАЗ БОЛЬШЕ НЕ НАВСЕГДА. Раньше строка в match_views исключала пару
 * насовсем. При нынешнем размере это тупик, а не строгость: на 2026-08-25 в
 * проде 25 опубликованных анкет, 22 мужчины и 9 женщин - у мужчины весь запас
 * кандидатов максимум девять человек при лимите тридцать отказов в сутки. Он
 * мог вычистить себе ленту за один присест. Теперь отказ несёт причину, а
 * причина решает срок возврата (см. skip-reasons.ts).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requirePermissionForRequest("view_feed");
  if ("response" in gate) return gate.response;
  const { user } = gate;

  const body = (await req.json().catch(() => ({}))) as {
    target_id?: string;
    reason?: string;
  };
  const { target_id } = body;
  if (!target_id || target_id === user.id)
    return NextResponse.json({ ok: false, error: "bad_target" }, { status: 400 });

  // Причина не обязательна: шторку можно закрыть молча, и это тоже отказ -
  // просто с мягким сроком. А вот НЕЗНАКОМАЯ причина отбивается здесь, а не
  // уходит в базу: в колонке стоит CHECK, и чужое значение упало бы ошибкой
  // базы уже на живом человеке (так было с post_marriage_living).
  const raw = body.reason;
  if (raw !== undefined && !isSkipReason(raw))
    return NextResponse.json({ ok: false, error: "bad_reason" }, { status: 400 });
  const reason = isSkipReason(raw) ? raw : "dismissed";

  const within = await checkAndIncrement(user.id, "views");
  if (!within)
    return NextResponse.json({ ok: false, error: "daily_limit" }, { status: 429 });

  const until = hiddenUntil(reason, Date.now());

  const sb = supabaseAdmin();
  const { error: saveErr } = await sb.from("match_views").upsert(
    {
      viewer_id: user.id,
      target_id,
      reason,
      // null означает «навсегда» — так и лежит в базе, см. миграцию.
      hidden_until: until ? until.toISOString() : null,
    },
    { onConflict: "viewer_id,target_id" },
  );
  // Сбой записи нельзя выдавать за успех: дневной лимит уже списан выше, а
  // кандидат остался бы в ленте. Человек получил бы «отказ учтён», увидел того
  // же человека снова и потерял попытку - худшее сочетание из возможных.
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  // «Что-то не так с анкетой» — это сигнал модерации, а не подбору. Кладём в ту
  // же очередь, что и обычные жалобы, но ОТДЕЛЬНЫМ кодом: оператор должен
  // видеть разницу между осознанной жалобой из чата и отметкой, поставленной
  // мимоходом в ленте. Best-effort: если запись не удалась, отказ всё равно
  // засчитан — терять его из-за сбоя в побочном действии нельзя.
  if (reason === "profile_issue") {
    try {
      await sb.from("reports").insert({
        reporter_id: user.id,
        target_user_id: target_id,
        chat_id: null,
        reason_code: "feed_profile_issue",
      });
    } catch (e) {
      console.error("[feed.skip] не удалось завести сигнал модерации:", e);
    }
  }

  return NextResponse.json({
    ok: true,
    // Две причины из семи — на самом деле претензия к фильтру, а не к человеку.
    // Клиент по этому полю показывает предложение поправить рамки или гео.
    suggest_filter_fix: suggestsFilterFix(reason) ? reason : null,
  });
}
