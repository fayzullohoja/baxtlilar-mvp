import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedPhotoUrls } from "@/lib/uploads/storage";
import { ageFromDate } from "@/lib/profile/schemas";
import { scoreCandidate, type ScoreInput } from "./score";

export type Candidate = {
  user_id: string;
  display_name: string;
  age: number;
  city: string;
  photoUrl: string | null;
  score: number;
};

/** Лента рекомендаций: жёсткие фильтры (SQL) + скоринг/сортировка (JS). */
export async function getRecommendations(viewerId: string, limit = 20): Promise<Candidate[]> {
  const sb = supabaseAdmin();

  // V3 (2026-06-30, Bug #3): `values` column was dropped in Sprint 3 cleanup —
  // selecting it returns null silently and recommendations break for ALL users.
  // Use `top_life_values` (the V3 replacement). RPC migration applied separately.
  const { data: vp } = await sb
    .from("user_profiles")
    .select("city, top_life_values, birth_date")
    .eq("user_id", viewerId)
    .maybeSingle();
  const { data: vq } = await sb.from("quiz_results").select("vector").eq("user_id", viewerId).maybeSingle();
  if (!vp) return [];
  const viewer: ScoreInput = {
    age: vp.birth_date ? ageFromDate(vp.birth_date as string) : 30,
    city: (vp.city as string) ?? "",
    values: (vp.top_life_values as string[]) ?? [],
    vector: (vq?.vector as Record<string, number>) ?? {},
  };

  const { data: rows, error } = await sb.rpc("get_recommendations", {
    p_viewer: viewerId,
    p_limit: 100,
  });
  if (error || !rows) return [];

  const list = rows as Record<string, unknown>[];
  const urls = await signedPhotoUrls(list.map((r) => r.main_photo_path as string | null));

  const scored: Candidate[] = list.map((r) => {
    const cand: ScoreInput = {
      age: (r.age as number) ?? 30,
      city: (r.city as string) ?? "",
      values: (r.vals as string[]) ?? [],
      vector: (r.vector as Record<string, number>) ?? {},
    };
    const path = r.main_photo_path as string | null;
    return {
      user_id: r.user_id as string,
      display_name: (r.display_name as string) ?? "",
      age: cand.age,
      city: cand.city,
      photoUrl: path ? (urls[path] ?? null) : null,
      score: scoreCandidate(viewer, cand),
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
