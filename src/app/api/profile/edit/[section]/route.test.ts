import { describe, it, expect, vi, beforeEach } from "vitest";

const loadMock = vi.fn();
const upsertMock = vi.fn();
const selectRow = vi.fn();
const clearSkipsMock = vi.fn();

vi.mock("@/lib/auth/active-guard", () => ({
  loadActiveUserApi: (...a: unknown[]) => loadMock(...a),
}));
vi.mock("@/lib/matching/clear-filter-skips", () => ({
  clearFilterSkips: (...a: unknown[]) => clearSkipsMock(...a),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: selectRow() }) }),
      }),
      upsert: (...a: unknown[]) => {
        upsertMock(...a);
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

import { POST } from "./route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/profile/edit/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = (section: string) => ({ params: Promise.resolve({ section }) });

const GOOD_SELF = {
  bio: "Люблю тихие вечера, книги и долгие прогулки по старому городу вместе с близкими.",
  education: "higher",
  activity_field: "it_software",
  employment_status: "working",
};

beforeEach(() => {
  loadMock.mockReset().mockResolvedValue({ user: { id: "u1" }, res: undefined });
  upsertMock.mockReset();
  clearSkipsMock.mockReset().mockResolvedValue(0);
  selectRow.mockReset().mockReturnValue({ extended: {}, marital_status: "never" });
});

describe("POST /api/profile/edit/[section]", () => {
  it("сохраняет раздел и не двигает человека по машине состояний", async () => {
    const r = await POST(req(GOOD_SELF) as never, ctx("self") as never);
    expect(r.status).toBe(200);
    const patch = upsertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.bio).toBe(GOOD_SELF.bio);
    // Ручки анкеты после сохранения переводят шаг. Здесь перехода быть не
    // должно: человек уже прошёл онбординг, правка города не двигает его по
    // машине состояний.
    expect("onboarding_step" in patch).toBe(false);
  });

  it("паспортные и служебные поля не доезжают до базы", async () => {
    await POST(
      req({
        ...GOOD_SELF,
        display_name: "ВЗЛОМ",
        gender: "f",
        birth_date: "1990-01-01",
        status: "published",
        needs_v4_review: false,
      }) as never,
      ctx("self") as never,
    );
    const patch = upsertMock.mock.calls[0][0] as Record<string, unknown>;
    for (const forbidden of ["display_name", "gender", "birth_date", "status", "needs_v4_review"]) {
      expect(forbidden in patch, `${forbidden} не должен попадать в патч`).toBe(false);
    }
  });

  it("неизвестный раздел отбивается", async () => {
    const r = await POST(req(GOOD_SELF) as never, ctx("passport") as never);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe("bad_section");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("контакты в тексте отбиваются той же схемой, что в анкете", async () => {
    const r = await POST(
      req({ ...GOOD_SELF, bio: "Пишите на +998 90 123 45 67, отвечу всем быстро и с радостью" }) as never,
      ctx("self") as never,
    );
    expect(r.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("чужие секции extended не затираются", async () => {
    selectRow.mockReturnValue({
      extended: { parents: { father_status: "alive" }, self: { specialty: "старое" } },
      marital_status: "never",
    });
    await POST(req({ ...GOOD_SELF, specialty: "новое" }) as never, ctx("self") as never);
    const patch = upsertMock.mock.calls[0][0] as Record<string, unknown>;
    const ext = patch.extended as Record<string, Record<string, unknown>>;
    expect(ext.parents.father_status).toBe("alive");
    expect(ext.self.specialty).toBe("новое");
  });
});

describe("флаг проверки семейного положения", () => {
  const FAMILY = { has_children: "no", future_children_plan: "yes_later" };

  it("поднимается при смене статуса на требующий проверки", async () => {
    selectRow.mockReturnValue({ extended: {}, marital_status: "never" });
    const r = await POST(
      req({ ...FAMILY, marital_status: "divorcing", previous_marriages: "one" }) as never,
      ctx("family") as never,
    );
    expect((await r.json()).marital_review).toBe(true);
    expect((upsertMock.mock.calls[0][0] as Record<string, unknown>).needs_marital_review).toBe(true);
  });

  it("снимается при смене на обычный статус", async () => {
    selectRow.mockReturnValue({ extended: {}, marital_status: "divorcing" });
    const r = await POST(req({ ...FAMILY, marital_status: "never" }) as never, ctx("family") as never);
    expect((await r.json()).marital_review).toBe(false);
  });

  it("НЕ трогается, если статус не менялся - иначе отменяется работа оператора", async () => {
    // Сценарий: человек указал «разводится», флаг поднялся, оператор посмотрел
    // документы и снял его через approve-marital. Статус при этом остался
    // «разводится» - человек и правда разводится. Если пересчитывать флаг на
    // любое сохранение раздела, правка соседнего поля снова спрятала бы
    // одобренного человека из подбора, уже без всякой причины.
    selectRow.mockReturnValue({ extended: {}, marital_status: "divorcing" });
    const r = await POST(
      req({ ...FAMILY, marital_status: "divorcing", previous_marriages: "one" }) as never,
      ctx("family") as never,
    );
    expect((await r.json()).marital_review).toBeNull();
    expect("needs_marital_review" in (upsertMock.mock.calls[0][0] as object)).toBe(false);
  });
});

describe("правка рамок партнёра возвращает скрытых по возрасту", () => {
  it("зовёт снятие возрастных отказов и сообщает, скольких вернуло", async () => {
    clearSkipsMock.mockResolvedValue(3);
    const r = await POST(
      req({ partner_age_min: 24, partner_age_max: 36, partner_top_qualities: ["honesty", "kindness", "caring"] }) as never,
      ctx("partner") as never,
    );
    const body = await r.json();
    expect(clearSkipsMock).toHaveBeenCalledWith("u1", ["age"]);
    expect(body.returned_to_feed).toBe(3);
  });

  it("другие разделы отказов не трогают", async () => {
    await POST(req(GOOD_SELF) as never, ctx("self") as never);
    expect(clearSkipsMock).not.toHaveBeenCalled();
  });
});
