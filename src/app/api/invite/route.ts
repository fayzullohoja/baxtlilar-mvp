import { NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { ensureCodeForUser, countInvitedBy, InviteRevokedError } from "@/lib/invite/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Код приглашения и счётчик приглашённых для текущего пользователя.
 *
 * Приглашать могут ТОЛЬКО пользователи с одобренной верификацией - это главный
 * тормоз против лавины вместо лимита на сам код (пространство кодов 31^6).
 *
 * Отдаём только ЧИСЛО приглашённых, а не список/имена: имена раскрыли бы
 * третьему лицу факт поиска брака без согласия самого приглашённого человека -
 * это требование приватности из спеки, а не оптимизация полезной нагрузки.
 *
 * allowPaused: true - экран «Пригласить» висит в настройках (см.
 * requireActiveUser({ allowPaused: true }) в v2/settings/page.tsx). Без этого
 * paused-пользователь ловил бы 403 not_active вместо своего кода, хотя
 * настройки ему в остальном доступны.
 */
export async function GET(): Promise<NextResponse> {
  const { user, res } = await loadActiveUserApi({ allowPaused: true });
  if (res) return res;

  if (user.verification_status !== "approved") {
    return NextResponse.json({ ok: false, error: "not_verified" }, { status: 403 });
  }

  // ensureCodeForUser/countInvitedBy осознанно бросают на сбое БД (Task 5,
  // store.ts) - здесь единственное место, которое ловит исключение и
  // превращает его в честный JSON-ответ вместо голого 500 без тела: экрану
  // «Пригласить» нужно понятное поле ok/error, чтобы показать текст ошибки,
  // а не упасть на разборе ответа.
  try {
    const [code, invited] = await Promise.all([ensureCodeForUser(user.id), countInvitedBy(user.id)]);
    return NextResponse.json({ ok: true, code, invited });
  } catch (e) {
    // ⛔ Task 10: персональный запрет (гашение "утечка" в /admin/invites и
    // т.п.) - ОСОЗНАННОЕ состояние, а не сбой БД. Отличаем через instanceof
    // (см. InviteRevokedError в store.ts), чтобы в логах не путать "запрещено"
    // со "легла база", и отвечаем отдельным кодом ошибки вместо "db".
    // V2InviteScreen (Task 9) всё равно ловит любой error !== "not_verified"
    // в общий экран с кнопкой "Повторить" - это поверхность Task 9, её здесь
    // не трогаем, так что смена текста ошибки не меняет поведение мини-аппа.
    if (e instanceof InviteRevokedError) {
      return NextResponse.json({ ok: false, error: "invite_revoked" }, { status: 403 });
    }
    console.error("[invite] не удалось получить код/счётчик приглашений:", e);
    return NextResponse.json({ ok: false, error: "db" }, { status: 500 });
  }
}
