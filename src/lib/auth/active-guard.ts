import "server-only";
import { NextResponse } from "next/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser, type DbUser } from "@/lib/auth/current-user";
import { nextScreenFor } from "@/lib/state-machine/router";
import { isActiveAccessAllowed } from "@/lib/auth/active-access";

/**
 * Гард active-страниц. По умолчанию пускает только active.
 * allowPaused=true — для чатов/настроек/главной (paused может отвечать в
 * существующих чатах и должен иметь достижимый экран — см. C1 / active-access).
 */
export async function requireActiveUser(
  locale: string,
  opts?: { allowPaused?: boolean },
): Promise<DbUser> {
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/", locale });
  if (user!.lifecycle_state === "blocked") redirect({ href: "/blocked", locale });
  if (!isActiveAccessAllowed(user!.lifecycle_state, opts))
    redirect({ href: nextScreenFor(user!), locale });
  return user!;
}

export async function loadActiveUserApi(opts?: {
  allowPaused?: boolean;
}): Promise<{ user: DbUser; res?: undefined } | { user?: undefined; res: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { res: NextResponse.json({ ok: false, error: "no_session" }, { status: 401 }) };
  if (user.lifecycle_state === "blocked")
    return { res: NextResponse.json({ ok: false, error: "blocked" }, { status: 403 }) };
  if (!isActiveAccessAllowed(user.lifecycle_state, opts))
    return { res: NextResponse.json({ ok: false, error: "not_active" }, { status: 403 }) };
  return { user };
}
