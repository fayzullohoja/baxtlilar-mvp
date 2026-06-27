import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchClients } from "./load-clients-search";

// Управляемый результат RPC, чтобы покрыть и happy-path, и error-path.
const rpc = vi.hoisted(() => ({
  current: { data: [] as unknown, error: null as unknown },
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: vi.fn().mockImplementation(async () => rpc.current),
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
    storage: {
      from: () => ({ createSignedUrls: async () => ({ data: [] }) }),
    },
  }),
}));

describe("searchClients", () => {
  beforeEach(() => {
    rpc.current = { data: [], error: null };
  });

  it("returns empty rows when RPC matches nothing", async () => {
    rpc.current = { data: [], error: null };
    const result = await searchClients("nobody", 20);
    expect(result.rows).toEqual([]);
  });

  it("throws (does NOT silently render an empty directory) when the RPC errors", async () => {
    // pg_trgm extension/function missing, or any SQL error → adapter soft-fails
    // with {data:null,error}. The loader must surface it, not return {rows:[]}.
    rpc.current = { data: null, error: { message: "function does not exist" } };
    await expect(searchClients("Каримов", 20)).rejects.toThrow(
      /admin_search_clients failed/,
    );
  });
});
