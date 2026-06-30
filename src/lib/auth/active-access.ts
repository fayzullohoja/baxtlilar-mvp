import type { LifecycleState } from "@/lib/state-machine/types";

/**
 * Чистый предикат доступа к active-экранам (без server-only / IO — тестируется).
 *
 * ВАЖНО (C1): любой экран, на который `nextScreenFor` может направить paused
 * (сейчас это /main), ОБЯЗАН вызывать гард с `allowPaused: true`. Иначе router
 * (paused→/main) и гард (отвергает paused) образуют бесконечную петлю
 * редиректов — юзер на паузе намертво заперт и не может сняться с паузы.
 */
export function isActiveAccessAllowed(
  lifecycle: LifecycleState,
  opts?: { allowPaused?: boolean },
): boolean {
  if (lifecycle === "active") return true;
  // pending_ban (Option A политика): внутреннее предложение бана с 24h auto-cancel,
  // user'у не должно быть заметно. Treat идентично active — иначе nextScreenFor
  // (отправляющий pending_ban на /main) + этот гард (отвергающий pending_ban)
  // образуют тот же C1 redirect-loop, что был у paused до allowPaused.
  if (lifecycle === "pending_ban") return true;
  if (opts?.allowPaused && lifecycle === "paused") return true;
  return false;
}
