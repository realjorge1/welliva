/**
 * WellivaApi — typed client for the Welliva backend (/backend-welliva).
 *
 * All AI work (diet, workout, coach) runs server-side on Claude Haiku. These
 * methods return shapes that drop straight into the app's existing models.
 *
 * Every /v1 endpoint requires the signed-in user's Supabase access token, so
 * these calls throw when nobody is signed in. That's intentional and safe:
 * callers (PlanSync, RemoteGozlinProvider) already catch and fall back to the
 * on-device deterministic engines.
 */
import { supabase } from "@/lib/supabase";
import type { DaySchedule } from "@/models/diet";
import type { NutritionTargets } from "@/models/nutrition";
import type { UserBio } from "@/models/user";
import type { GeneratedWorkoutPlan } from "@/models/workout";
import { API_BASE_URL, isApiConfigured } from "./config";

export interface DietGenerateResponse {
  schedule: DaySchedule;
  dailyNutritionEstimate: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  dietName: string;
  rationale: string;
  coachNote: string;
  model: string;
  source: "ai";
}

export interface WorkoutGenerateResponse {
  plan: GeneratedWorkoutPlan;
  rationale: string;
  coachNote: string;
  model: string;
  source: "ai";
}

export interface CoachChatResponse {
  reply: string;
  model: string;
}

/**
 * Food-parse response. Note the shape: quantity, unit and food name — and
 * deliberately NO nutrition fields. The model is used as a parser only; the
 * numbers are resolved on-device from the cited reference table. See
 * services/gozlin/GozlinFoodAnalyst.ts for why this boundary matters.
 */
export interface ParseFoodResponse {
  items: { quantity: number; unit: string; food: string }[];
  model: string;
}

/**
 * Current access token. `getSession()` refreshes it when it's near expiry, so
 * this is normally enough on its own. Throws when there is no session.
 */
async function accessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Auth session unavailable: ${error.message}`);
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in — AI endpoints require an account");
  return token;
}

async function send(
  path: string,
  body: unknown,
  token: string,
  signal: AbortSignal,
): Promise<Response> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  return res;
}

async function post<T>(path: string, body: unknown, timeoutMs = 30000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await send(path, body, await accessToken(), controller.signal);

    // A 401 after a long backgrounding usually means the cached token aged out
    // between getSession() and arrival. Force one refresh and retry once.
    if (res.status === 401) {
      const { data, error } = await supabase.auth.refreshSession();
      const refreshed = data.session?.access_token;
      if (!error && refreshed) {
        res = await send(path, body, refreshed, controller.signal);
      }
    }

    if (!res.ok) {
      let message = `API error ${res.status}`;
      try {
        const j = (await res.json()) as { error?: { message?: string } };
        if (j?.error?.message) message = j.error.message;
      } catch {
        // non-JSON error body — keep the status message
      }
      throw new Error(message);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const WellivaApi = {
  /** Whether a backend URL is configured (EXPO_PUBLIC_API_URL). */
  isConfigured: isApiConfigured,

  /** Generate one day's AI meal plan tailored to the user. */
  generateDiet(args: {
    bio: UserBio;
    targets: NutritionTargets;
    date: string;
    dietId?: string;
  }): Promise<DietGenerateResponse> {
    return post<DietGenerateResponse>("/v1/diet/generate", args, 30000);
  },

  /** Generate a weekly AI workout plan tailored to the user. */
  generateWorkout(args: {
    bio: UserBio;
    weekStart: string;
  }): Promise<WorkoutGenerateResponse> {
    return post<WorkoutGenerateResponse>("/v1/workout/generate", args, 30000);
  },

  /** Open-ended Gozlin coach reply (grounded by the app's system prompt). */
  coachChat(args: { system?: string; user: string }): Promise<CoachChatResponse> {
    return post<CoachChatResponse>("/v1/coach/chat", args, 20000);
  },

  /**
   * Parse a free-text meal description into structured food items. Returns
   * names and amounts only — never nutrition figures. Short timeout: this sits
   * in front of a user typing, and the local parser is always available as a
   * fallback, so waiting is worse than degrading.
   */
  parseFood(args: { system: string; user: string }): Promise<ParseFoodResponse> {
    return post<ParseFoodResponse>("/v1/nutrition/parse", args, 12000);
  },
};
