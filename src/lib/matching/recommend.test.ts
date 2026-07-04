import { describe, it, expect, vi, beforeEach } from "vitest";

// MATCH-2 — progressive relaxation loop: strict (0) → возраст ±5 (1) →
// + снятие candidate-side prefs (2) → только потом честный пустой результат.

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: vi.fn() }));
vi.mock("@/lib/uploads/storage", () => ({
  signedPhotoUrls: vi.fn(async (paths: (string | null)[]) =>
    Object.fromEntries(paths.filter(Boolean).map((p) => [p as string, `signed:${p}`])),
  ),
}));

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRecommendations } from "./recommend";

type RpcResult = { data: unknown; error: unknown };

function row(id: string, relaxLevel: number): Record<string, unknown> {
  return {
    user_id: id,
    display_name: "Тест",
    age: 27,
    city: "tashkent",
    vals: ["family"],
    vector: { O: 50, C: 50, E: 50, A: 50, ES: 50 },
    main_photo_path: `p/${id}.jpg`,
    relax_level: relaxLevel,
  };
}

/** sb-мок: профиль зрителя из from(), а rpc отвечает по p_relax_level. */
function mockSb(byLevel: Record<number, RpcResult>) {
  const rpc = vi.fn(async (_fn: string, args: { p_relax_level: number }) => {
    return byLevel[args.p_relax_level] ?? { data: [], error: null };
  });
  const sb = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "user_profiles"
              ? {
                  data: {
                    city: "tashkent",
                    top_life_values: ["family"],
                    birth_date: "1996-01-01",
                  },
                }
              : { data: { vector: { O: 50, C: 50, E: 50, A: 50, ES: 50 } } },
        }),
      }),
    }),
    rpc,
  };
  vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
  return rpc;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin).mockReset();
});

describe("getRecommendations — degradation ladder", () => {
  it("здоровый strict-пул → один вызов RPC с p_relax_level=0, relaxLevel=0", async () => {
    const rpc = mockSb({ 0: { data: [row("u-a", 0)], error: null } });
    const out = await getRecommendations("viewer-1", 5);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_viewer: "viewer-1", p_relax_level: 0 });
    expect(out).toHaveLength(1);
    expect(out[0].relaxLevel).toBe(0);
  });

  it("пустой strict → пробует level 1 и возвращает relaxLevel=1", async () => {
    const rpc = mockSb({
      0: { data: [], error: null },
      1: { data: [row("u-b", 1)], error: null },
    });
    const out = await getRecommendations("viewer-1", 5);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_relax_level: 1 });
    expect(out[0].relaxLevel).toBe(1);
  });

  it("пусто на 0 и 1 → level 2; кандидат несёт relaxLevel=2", async () => {
    const rpc = mockSb({
      0: { data: [], error: null },
      1: { data: [], error: null },
      2: { data: [row("u-c", 2)], error: null },
    });
    const out = await getRecommendations("viewer-1", 5);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(out[0].relaxLevel).toBe(2);
  });

  it("пусто на всех уровнях → [] (честный last-resort)", async () => {
    const rpc = mockSb({});
    const out = await getRecommendations("viewer-1", 5);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(out).toEqual([]);
  });

  it("ошибка RPC → throws (DB-6: сбой БД ≠ пустой фид), без каскада на уровни", async () => {
    const rpc = mockSb({ 0: { data: null, error: { message: "boom" } } });
    await expect(getRecommendations("viewer-1", 5)).rejects.toThrow(/get_recommendations/i);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
