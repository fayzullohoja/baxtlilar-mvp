import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadPhotosQueue } from "./load-photos";

// Реальный supabase замокан — тест проверяет контракт публичного API
// (форма результата, отсутствие падения на пустых данных), не SQL.
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [] }),
    storage: {
      from: () => ({
        createSignedUrls: async () => ({ data: [] }),
        createSignedUrl: async () => ({ data: { signedUrl: "x" } }),
      }),
    },
  }),
}));

describe("loadPhotosQueue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty rows when DB empty", async () => {
    const result = await loadPhotosQueue("new", 60);
    expect(result.rows).toEqual([]);
    expect(result.next_cursor).toBeUndefined();
  });

  it("does not throw on the overdue filter", async () => {
    const result = await loadPhotosQueue("overdue", 60);
    expect(result.rows).toEqual([]);
  });
});
