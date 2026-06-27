import { describe, it, expect, vi } from "vitest";
import { searchClients } from "./load-clients-search";

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: vi.fn().mockResolvedValue({ data: [] }),
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [] }),
    storage: {
      from: () => ({ createSignedUrls: async () => ({ data: [] }) }),
    },
  }),
}));

describe("searchClients", () => {
  it("returns empty rows when RPC matches nothing", async () => {
    const result = await searchClients("nobody", 20);
    expect(result.rows).toEqual([]);
  });

  it("returns empty rows for empty query with no users", async () => {
    const result = await searchClients("", 50);
    expect(result.rows).toEqual([]);
  });
});
