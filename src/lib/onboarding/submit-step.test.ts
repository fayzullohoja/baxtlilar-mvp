import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseStepOutcome,
  postStep,
  stepMovedHref,
  stepSubmitEffect,
  submitNoticeKind,
} from "./submit-step";

/**
 * Регресс на прод-инцидент 12.08.2026 (пользователь 39ede142): модератор вынес
 * решение, пока человек заполнял анкету, RPC сырым UPDATE переставил ему
 * onboarding_step, и POST шага стал отдавать 409 wrong_step. Формы показывали
 * общий текст «не удалось сохранить, попробуйте ещё раз» - человек сделал пять
 * попыток и заполнил 11 шагов заново.
 *
 * Здесь проверяем два обещания разом:
 *  1) 409 разбирается в переход на настоящий шаг человека;
 *  2) при 409 общий текст ошибки НЕ показывается (stepSubmitEffect.errorCode →
 *     null, submitNoticeKind → "step_moved"), потому что повтор при 409 не
 *     срабатывает никогда.
 */
describe("parseStepOutcome", () => {
  it("успех: ok + next → переход на следующий шаг", () => {
    expect(parseStepOutcome(200, { ok: true, next: "/v2/anketa/marriage" })).toEqual({
      kind: "ok",
      next: "/v2/anketa/marriage",
      body: { ok: true, next: "/v2/anketa/marriage" },
    });
  });

  it("успех без next (загрузка фото) остаётся успехом", () => {
    const out = parseStepOutcome(200, { ok: true, photo: { id: "p1" } });
    expect(out.kind).toBe("ok");
    if (out.kind === "ok") {
      expect(out.next).toBeUndefined();
      expect(out.body.photo).toEqual({ id: "p1" });
    }
  });

  it("прод-сценарий 12.08.2026: 409 wrong_step + current=needs_changes → /onboarding/needs-changes", () => {
    const out = parseStepOutcome(409, {
      ok: false,
      error: "wrong_step",
      current: "needs_changes",
    });
    expect(out).toEqual({
      kind: "step_moved",
      path: "/onboarding/needs-changes",
      dataLost: true,
    });
  });

  it("409 wrong_step на анкетный шаг ведёт на этот шаг анкеты", () => {
    expect(
      parseStepOutcome(409, { ok: false, error: "wrong_step", current: "profile_marriage" }),
    ).toEqual({ kind: "step_moved", path: "/v2/anketa/marriage", dataLost: true });
  });

  it("409 wrong_step учитывает lifecycle, если сервер его прислал", () => {
    expect(
      parseStepOutcome(409, {
        ok: false,
        error: "wrong_step",
        current: "profile_lifestyle",
        lifecycle: "blocked",
      }),
    ).toEqual({ kind: "step_moved", path: "/blocked", dataLost: true });
    expect(
      parseStepOutcome(409, {
        ok: false,
        error: "wrong_step",
        current: "active",
        lifecycle: "active",
      }),
    ).toEqual({ kind: "step_moved", path: "/main", dataLost: true });
  });

  it("409 без current (упал tryTransition в конце роута) - данные УЖЕ записаны", () => {
    // Роуты анкеты делают upsert и только потом переводят шаг: если переход не
    // прошёл, введённое сохранено. Сказать здесь «не сохранилось» было бы такой
    // же ложью, как и «попробуйте ещё раз». Поэтому dataLost=false: человека
    // уводим в корень, он разведёт по настоящему состоянию, и молчим.
    expect(parseStepOutcome(409, { ok: false, error: "wrong_step" })).toEqual({
      kind: "step_moved",
      path: "/",
      dataLost: false,
    });
  });

  it("409 с неизвестным шагом всё равно уводит человека с формы", () => {
    expect(
      parseStepOutcome(409, { ok: false, error: "wrong_step", current: "неизвестный_шаг" }),
    ).toEqual({ kind: "step_moved", path: "/", dataLost: true });
  });

  it("409 с другой причиной (не wrong_step) остаётся обычной ошибкой", () => {
    // Например wrong_verification_status из роутов повторной подачи документов:
    // перехватывать его этим правилом нельзя.
    expect(
      parseStepOutcome(409, { ok: false, error: "wrong_verification_status", current: "approved" }),
    ).toEqual({ kind: "error", code: "wrong_verification_status" });
  });

  it("ошибка валидации: detail важнее error (так формы подбирают точный текст)", () => {
    expect(parseStepOutcome(400, { ok: false, error: "validation", detail: "bio_too_short" })).toEqual(
      { kind: "error", code: "bio_too_short" },
    );
  });

  it("пустое или нечитаемое тело → общий код failed", () => {
    expect(parseStepOutcome(500, {})).toEqual({ kind: "error", code: "failed" });
    expect(parseStepOutcome(500, null)).toEqual({ kind: "error", code: "failed" });
    expect(parseStepOutcome(502, "<html>502</html>")).toEqual({ kind: "error", code: "failed" });
  });
});

describe("postStep", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("409 от сервера превращается в переход, а не в ошибку сохранения", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 409,
        json: async () => ({ ok: false, error: "wrong_step", current: "needs_changes" }),
      }),
    );
    const out = await postStep("/api/onboarding/profile/lifestyle", { method: "POST" });
    expect(out).toEqual({
      kind: "step_moved",
      path: "/onboarding/needs-changes",
      dataLost: true,
    });
    // И то же самое глазами формы: ни ошибки, ни «попробуйте ещё раз».
    expect(stepSubmitEffect(out).errorCode).toBeNull();
  });

  it("обрыв сети - обычная ошибка: тут повтор как раз помогает", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await postStep("/api/onboarding/profile/lifestyle", { method: "POST" })).toEqual({
      kind: "error",
      code: "failed",
    });
  });

  it("нечитаемое тело при 409: разбор не падает и не выдаёт это за успех", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 409,
        json: async () => {
          throw new Error("not json");
        },
      }),
    );
    // error в теле не прочитан → правило по статусу не сработает, это честная
    // ошибка: код failed. Проверяем, что разбор не падает и не врёт про успех.
    const out = await postStep("/api/onboarding/profile/lifestyle", { method: "POST" });
    expect(out).toEqual({ kind: "error", code: "failed" });
  });
});

describe("stepSubmitEffect + submitNoticeKind - что реально увидит человек", () => {
  const moved409 = parseStepOutcome(409, {
    ok: false,
    error: "wrong_step",
    current: "needs_changes",
    lifecycle: "onboarding",
  });

  it("409: уводим на настоящий шаг и НЕ показываем общий текст ошибки", () => {
    const e = stepSubmitEffect(moved409);
    expect(e).toEqual({
      navigateTo: "/onboarding/needs-changes?step_moved=1",
      errorCode: null,
      stepMoved: true,
    });
    // То же самое глазами плашки под формой: это объяснение, а не ошибка.
    expect(submitNoticeKind(e.errorCode, e.stepMoved)).toBe("step_moved");
    expect(submitNoticeKind(e.errorCode, e.stepMoved)).not.toBe("error");
  });

  it("409: даже если код ошибки почему-то дошёл, плашка ошибки не показывается", () => {
    // Защита от полумеры «оставим текст, просто добавим редирект»: пока стоит
    // stepMoved, общий текст «попробуйте ещё раз» не выводится ни при каких кодах.
    expect(submitNoticeKind("failed", true)).toBe("step_moved");
  });

  it("409 после записи (tryTransition): переход БЕЗ метки «не сохранилось»", () => {
    const e = stepSubmitEffect(parseStepOutcome(409, { ok: false, error: "wrong_step" }));
    expect(e).toEqual({ navigateTo: "/", errorCode: null, stepMoved: false });
    // Ни ошибки, ни обещания потери: данные записаны, врать не о чем.
    expect(e.navigateTo).not.toContain("step_moved");
    expect(submitNoticeKind(e.errorCode, e.stepMoved)).toBeNull();
  });

  it("успех: только переход, никаких плашек", () => {
    const e = stepSubmitEffect(parseStepOutcome(200, { ok: true, next: "/v2/anketa/health" }));
    expect(e).toEqual({ navigateTo: "/v2/anketa/health", errorCode: null, stepMoved: false });
    expect(submitNoticeKind(e.errorCode, e.stepMoved)).toBeNull();
  });

  it("успех без next (загрузка фото): человек остаётся на месте и без плашек", () => {
    const e = stepSubmitEffect(parseStepOutcome(200, { ok: true, photo: { id: "p1" } }));
    expect(e).toEqual({ navigateTo: null, errorCode: null, stepMoved: false });
  });

  it("настоящая ошибка: остаёмся на форме и показываем ошибку", () => {
    const e = stepSubmitEffect(parseStepOutcome(500, { ok: false }));
    expect(e).toEqual({ navigateTo: null, errorCode: "failed", stepMoved: false });
    expect(submitNoticeKind(e.errorCode, e.stepMoved)).toBe("error");
  });
});

describe("метка «шаг сменился» доезжает до нового экрана", () => {
  it("прод-сценарий целиком: 409 → адрес настоящего шага с меткой объяснения", () => {
    const out = parseStepOutcome(409, {
      ok: false,
      error: "wrong_step",
      current: "needs_changes",
      lifecycle: "onboarding",
    });
    expect(out.kind).toBe("step_moved");
    if (out.kind === "step_moved") {
      expect(stepMovedHref(out.path)).toBe("/onboarding/needs-changes?step_moved=1");
    }
  });

  it("не ломает адрес, в котором уже есть параметры", () => {
    expect(stepMovedHref("/v2/anketa/basic?from=bot")).toBe(
      "/v2/anketa/basic?from=bot&step_moved=1",
    );
  });
});
