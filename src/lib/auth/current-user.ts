import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUserId } from "@/lib/auth/session";
import type {
  LifecycleState,
  OnboardingStep,
  ProfileCompletion,
  QuizCompletion,
  VerificationStatus,
} from "@/lib/state-machine/types";

export type DbUser = {
  id: string;
  telegram_id: number;
  telegram_username: string | null;
  telegram_first_name: string | null;
  phone_number: string | null;
  phone_verified: boolean;
  language: "ru" | "uz" | null;
  lifecycle_state: LifecycleState;
  onboarding_step: OnboardingStep;
  verification_status: VerificationStatus;
  profile_completion: ProfileCompletion;
  quiz_completion: QuizCompletion;
  blocked_reason: string | null;
  updated_at: string;
};

/** Текущий пользователь по сессии (httpOnly cookie) или null. */
export async function getCurrentUser(): Promise<DbUser | null> {
  const uid = await getSessionUserId();
  if (!uid) return null;
  const { data, error } = await supabaseAdmin().from("users").select("*").eq("id", uid).single();
  if (error || !data) return null;
  return data as DbUser;
}
