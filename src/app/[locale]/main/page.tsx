import { setRequestLocale } from "next-intl/server";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { getUnreadTotal } from "@/lib/chat/list";
import { BottomNav } from "@/components/bottom-nav";
import { deriveRole, hasPermission } from "@/lib/v2/permissions";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { VerificationPlashka } from "@/components/v2/VerificationPlashka";
import { Headline, Lead } from "@/components/v2/Headline";
import { ProgressiveProfile } from "@/components/v2/ProgressiveProfile";
import { toProgressiveView } from "@/lib/v2/progressive-view";
import { MatchStoryCard } from "@/components/v2/MatchStoryCard";
import { InterestActions } from "@/components/v2/InterestActions";
import { PausedResume } from "@/components/v2/PausedResume";
import { getMatchOfTheDay } from "@/lib/v2/match-of-the-day";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * V2 (2026-06-25) /main — главный экран.
 *
 *   Shadow user (lifecycle=active, verification!=approved)
 *     → MiniAppShell + VerificationPlashka (empty state)
 *
 *   Verified user
 *     → MiniAppShell + (ProgressiveProfile + MatchStoryCard) ИЛИ empty
 *       Не лента. Одна рекомендация на сегодня + объяснение.
 *
 * Источник истины (продуктовое решение): см. memory
 * [[project-baxtlilar-v2-matching-model]].
 */
export default async function MainPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // allowPaused: paused — first-class state. БЕЗ него router (paused→/main) и
  // гард (отвергает paused) образуют бесконечную петлю редиректов: юзер на
  // паузе намертво заперт и не может сняться. C1.
  const user = await requireActiveUser(locale, { allowPaused: true });
  const role = deriveRole(user.lifecycle_state, user.verification_status);
  const unread = await getUnreadTotal(user.id);

  // Пауза («общаюсь с кем-то») — отдельный экран с кнопкой «Возобновить».
  // Должен идти ДО проверки view_feed, иначе paused провалился бы в shadow-ветку
  // и увидел бы неуместную VerificationPlashka.
  if (role === "paused") {
    return (
      <>
        <MiniAppShell eyebrow="Пауза" align="top" footer={null}>
          <Headline size="lg" as="h1">
            Вы на паузе.
          </Headline>
          <Lead>
            Вас не показывают в подборе, новые интересы не приходят. Существующие
            чаты остаются — можно отвечать. Снимите паузу, когда будете готовы
            продолжить.
          </Lead>
          <div style={{ marginTop: "28px" }}>
            <PausedResume />
          </div>
        </MiniAppShell>
        <BottomNav active="feed" unread={unread} />
      </>
    );
  }

  // Shadow Active — empty + плашка.
  if (!hasPermission(role, "view_feed")) {
    return (
      <>
        <MiniAppShell eyebrow="Baxtlilar" align="top" footer={null}>
          <VerificationPlashka
            status={user.verification_status}
            submittedAt={user.verification_submitted_at}
          />
        </MiniAppShell>
        <BottomNav active="feed" unread={unread} />
      </>
    );
  }

  // F4 (ревью оунера): профиль с needs_marital_review=true скрыт из мэтчинга
  // (гейт в get_recommendations/is_matchable) до одобрения оператором. Показываем
  // честную «на проверке» плашку вместо пустого/ищущего фида.
  const { data: reviewRow } = await supabaseAdmin()
    .from("user_profiles")
    .select("needs_marital_review")
    .eq("user_id", user.id)
    .maybeSingle();
  if (reviewRow?.needs_marital_review === true) {
    return (
      <>
        <MiniAppShell eyebrow="Baxtlilar" align="top" footer={null}>
          <Headline size="lg" as="h1">
            Анкета на проверке.
          </Headline>
          <Lead>
            Мы уточняем некоторые данные Вашей анкеты. Пока идёт проверка, Вас не
            показывают в подборе — обычно это занимает от нескольких часов до
            суток. Как только всё подтвердим, подбор включится автоматически.
          </Lead>
        </MiniAppShell>
        <BottomNav active="feed" unread={unread} />
      </>
    );
  }

  // Verified — match of the day.
  // DB-6: сбой БД в подборе НЕ равен «пусто». getMatchOfTheDay бросает при
  // ошибке RPC — показываем «попробуйте позже» (retry), а не genuine-empty
  // «алгоритм ищет», чтобы не выдавать инцидент за отсутствие кандидатов.
  let match: Awaited<ReturnType<typeof getMatchOfTheDay>>;
  try {
    match = await getMatchOfTheDay(user.id);
  } catch {
    return (
      <>
        <MiniAppShell eyebrow="Сегодня · подбор" align="top" footer={null}>
          <Headline size="lg" as="h1">
            Не удалось загрузить подбор.
          </Headline>
          <Lead>
            Временная техническая заминка на нашей стороне. Обновите страницу
            через минуту — Ваши данные в порядке.
          </Lead>
        </MiniAppShell>
        <BottomNav active="feed" unread={unread} />
      </>
    );
  }

  if (!match) {
    return (
      <>
        <MiniAppShell eyebrow="Сегодня · подбор" align="top" footer={null}>
          <Headline size="lg" as="h1">
            Алгоритм ищет подходящего человека.
          </Headline>
          {/* MATCH-4: честный last-resort — сюда попадают после полной
              degradation ladder; не обещаем «завтра точно сработает». */}
          <Lead>
            Пока нет анкеты, которая бы достаточно совпадала с Вашей. Это
            нормально — мы не показываем кого попало. Новые люди появляются
            каждый день: как только найдём подходящего человека, он будет
            здесь.
          </Lead>
          <Lead style={{ marginTop: "20px" }}>
            А пока — можете расширить желаемый возрастной диапазон в анкете
            или дополнить психо-портрет. Чем точнее данные, тем шире и точнее
            подбор.
          </Lead>
        </MiniAppShell>
        <BottomNav active="feed" unread={unread} />
      </>
    );
  }

  const candidateFirstName =
    match.candidate.profile.display_name.trim().split(/\s+/)[0] ?? "";

  return (
    <>
      <MiniAppShell
        eyebrow="Сегодня · подбор"
        align="top"
        footer={
          <InterestActions
            candidateId={match.candidate.user_id}
            candidateFirstName={candidateFirstName}
          />
        }
      >
        {/* APP-1: только узкая pre-mutual проекция уходит в клиент (без точного
            DOB / статуса / детей / предпочтений). Кандидаты в подборе всегда
            approved (is_matchable гейтит verification_status='approved') → бейдж
            «Проверен» показываем. */}
        <ProgressiveProfile
          profile={toProgressiveView({
            ...match.candidate.profile,
            verification_status: "approved",
          })}
          locale={locale}
        />
        <MatchStoryCard story={match.story} candidateName={candidateFirstName} />
        {/* Spacer чтобы footer-actions не накрывали bottom часть карточки */}
        <div style={{ height: "80px" }} />
      </MiniAppShell>
      <BottomNav active="feed" unread={unread} />
    </>
  );
}
