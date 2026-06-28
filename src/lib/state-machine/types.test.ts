import { describe, it, expect } from "vitest";
import { ALLOWED_TRANSITIONS, ALL_STEPS } from "./types";

/** Множество шагов, достижимых из start по ALLOWED_TRANSITIONS (BFS). */
function reachableFrom(start: string): Set<string> {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const s = queue.shift() as keyof typeof ALLOWED_TRANSITIONS;
    for (const next of ALLOWED_TRANSITIONS[s] ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

describe("ALLOWED_TRANSITIONS", () => {
  it("покрывает все шаги как источник", () => {
    for (const step of ALL_STEPS) {
      expect(ALLOWED_TRANSITIONS).toHaveProperty(step);
    }
  });

  it("все целевые шаги — валидные", () => {
    for (const [, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      for (const t of targets) expect(ALL_STEPS).toContain(t);
    }
  });

  it("нет self-loops", () => {
    for (const [src, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      expect(targets).not.toContain(src as (typeof ALL_STEPS)[number]);
    }
  });

  it("bot-flow (2026-06-19 + welcome ext 2026-06-28): язык → контакт → ПД → биометрия → welcome → verification_intro → doc_upload", () => {
    expect(ALLOWED_TRANSITIONS.bot_language).toContain("bot_contact");
    expect(ALLOWED_TRANSITIONS.bot_contact).toContain("bot_consent_pd");
    expect(ALLOWED_TRANSITIONS.bot_consent_pd).toContain("bot_consent_biometric");
    // V2 ext 2026-06-28: после биометрии идёт welcome серия (welcome_mission),
    // verification_intro оставлен как legacy fallback для soft-rollout.
    expect(ALLOWED_TRANSITIONS.bot_consent_biometric).toEqual([
      "welcome_mission",
      "verification_intro",
    ]);
    expect(ALLOWED_TRANSITIONS.welcome_mission).toEqual(["welcome_safety"]);
    expect(ALLOWED_TRANSITIONS.welcome_safety).toEqual(["welcome_rules"]);
    expect(ALLOWED_TRANSITIONS.welcome_rules).toEqual(["verification_intro"]);
    expect(ALLOWED_TRANSITIONS.verification_intro).toEqual(["doc_upload"]);
    expect(ALLOWED_TRANSITIONS.doc_upload).toContain("selfie_upload");
    expect(ALLOWED_TRANSITIONS.selfie_upload).toContain("moderation_pending");
  });

  it("retry/fix минуют verification_intro (юзер уже видел его 1 раз)", () => {
    expect(ALLOWED_TRANSITIONS.verification_rejected).toContain("doc_upload");
    expect(ALLOWED_TRANSITIONS.verification_rejected).not.toContain("verification_intro");
    expect(ALLOWED_TRANSITIONS.needs_changes).toContain("doc_upload");
    expect(ALLOWED_TRANSITIONS.needs_changes).not.toContain("verification_intro");
  });

  it("legacy SMS-шаги — terminal (новых переходов нет)", () => {
    expect(ALLOWED_TRANSITIONS.language).toEqual([]);
    expect(ALLOWED_TRANSITIONS.consent).toEqual([]);
    expect(ALLOWED_TRANSITIONS.phone_input).toEqual([]);
    expect(ALLOWED_TRANSITIONS.otp_pending).toEqual([]);
  });

  it("модератор может одобрить или вернуть с moderation_pending", () => {
    expect(ALLOWED_TRANSITIONS.moderation_pending).toEqual(
      expect.arrayContaining(["profile_basic", "needs_changes", "verification_rejected"]),
    );
  });

  it("active — терминальный (для onboarding-цикла)", () => {
    expect(ALLOWED_TRANSITIONS.active).toEqual([]);
  });

  it("MAJOR #3: quiz → attribution", () => {
    expect(ALLOWED_TRANSITIONS.quiz).toEqual(["attribution"]);
    // V2 (2026-06-25): attribution ведёт в tutorial_intro (новый путь)
    // ИЛИ active (legacy fallback для уже зарегистрированных).
    expect(ALLOWED_TRANSITIONS.attribution).toEqual(["tutorial_intro", "active"]);
  });

  it("V2 tutorial tour: 4 шага + ready как терминал onboarding", () => {
    // Каждый tutorial-шаг разрешает либо следующий, либо ready (skip-возможность).
    expect(ALLOWED_TRANSITIONS.tutorial_intro).toContain("tutorial_swipe");
    expect(ALLOWED_TRANSITIONS.tutorial_intro).toContain("ready");

    expect(ALLOWED_TRANSITIONS.tutorial_swipe).toContain("tutorial_chat");
    expect(ALLOWED_TRANSITIONS.tutorial_swipe).toContain("ready");

    expect(ALLOWED_TRANSITIONS.tutorial_chat).toContain("tutorial_safety");
    expect(ALLOWED_TRANSITIONS.tutorial_chat).toContain("ready");

    expect(ALLOWED_TRANSITIONS.tutorial_safety).toEqual(["ready"]);

    // ready — переход в lifecycle=active (RPC устанавливает).
    expect(ALLOWED_TRANSITIONS.ready).toEqual(["active"]);
  });
});

describe("ALLOWED_TRANSITIONS connectivity (анти-застревание)", () => {
  // Legacy-шаги намеренно terminal — это и есть способ "ничего не делать с
  // унаследованными строками". Они исключены из проверки тупиков.
  const LEGACY: ReadonlySet<string> = new Set(["language", "consent", "phone_input", "otp_pending"]);
  const LIVE = ALL_STEPS.filter((s) => !LEGACY.has(s));

  it("из live-шагов тупиков нет (терминален только active)", () => {
    const deadEnds = LIVE.filter((s) => s !== "active" && ALLOWED_TRANSITIONS[s].length === 0);
    expect(deadEnds).toEqual([]);
  });

  it("каждый live-шаг достижим из bot_language (нет сирот)", () => {
    const reached = reachableFrom("bot_language");
    const unreachable = LIVE.filter((s) => !reached.has(s));
    expect(unreachable).toEqual([]);
  });

  it("active достижим из bot_language (happy-path замыкается)", () => {
    expect(reachableFrom("bot_language").has("active")).toBe(true);
  });
});
