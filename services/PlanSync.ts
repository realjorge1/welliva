/**
 * PLAN SYNC — the bridge between the AI backend and offline-first scheduling.
 *
 * Strategy: "generate ahead, then serve from the phone".
 *  - When online, the AI backend (Claude Haiku) builds plans personalized to the
 *    user's full bio (including region) and we cache them on the device.
 *  - Day to day, the app reads the cached day — no network needed.
 *  - When the backend is unconfigured or unreachable, we fall back to the local
 *    deterministic generators so the app never breaks.
 *
 * These are pure async functions (no React, no component state). Callers persist
 * any resulting plan-state themselves.
 */
import type { NutritionTargets } from "../models/nutrition";
import type { UserBio } from "../models/user";
import type { GeneratedWorkoutPlan } from "../models/workout";
import { ensureDietLibraryLoaded } from "../constants/DietDatabase";
import { WellivaApi } from "./api/WellivaApi";
import { generateDietPlan } from "./DietPlanGenerator";
import { parseLocalDate, toLocalDateString } from "./OfflineStorage";
import {
  clearScheduledDietsAfter,
  getScheduleForDate,
  saveDaySchedule,
} from "./ScheduleService";
import { ensureWorkoutExercisesLoaded, generateWorkoutPlan } from "./WorkoutGenerator";

export interface EnsuredDiet {
  dietId: string;
  /** Where the served plan came from. */
  source: "cache" | "ai" | "local";
}

/**
 * Ensure a single day has a meal plan, preferring (in order):
 *   1. an already-cached schedule (fully offline),
 *   2. a fresh AI plan from the backend (when configured + online),
 *   3. the local deterministic generator.
 * Saves whatever it generates and returns the active diet id.
 */
export async function ensureDietForDate(
  bio: UserBio,
  targets: NutritionTargets,
  date: string,
  preferredDietId?: string,
): Promise<EnsuredDiet | null> {
  const cached = await getScheduleForDate(date);
  if (cached) return { dietId: cached.dietId, source: "cache" };

  if (WellivaApi.isConfigured) {
    try {
      const ai = await WellivaApi.generateDiet({ bio, targets, date, dietId: preferredDietId });
      await saveDaySchedule(ai.schedule);
      return { dietId: ai.schedule.dietId, source: "ai" };
    } catch (e) {
      console.warn(`PlanSync: AI diet for ${date} failed, using local generator:`, e);
    }
  }

  await ensureDietLibraryLoaded(); // local generator reads the full diet library
  const dp = generateDietPlan(bio, targets, date, preferredDietId);
  if (dp) {
    await saveDaySchedule(dp.schedule);
    return { dietId: dp.diet.id, source: "local" };
  }
  return null;
}

/**
 * Force-generate a single day's plan (ignores any cached day) — used by the
 * explicit "regenerate today" action. AI-first with local fallback.
 */
export async function regenerateDietForDate(
  bio: UserBio,
  targets: NutritionTargets,
  date: string,
  preferredDietId?: string,
): Promise<EnsuredDiet | null> {
  if (WellivaApi.isConfigured) {
    try {
      const ai = await WellivaApi.generateDiet({ bio, targets, date, dietId: preferredDietId });
      await saveDaySchedule(ai.schedule);
      return { dietId: ai.schedule.dietId, source: "ai" };
    } catch (e) {
      console.warn(`PlanSync: AI regen for ${date} failed, using local generator:`, e);
    }
  }
  await ensureDietLibraryLoaded(); // local generator reads the full diet library
  const dp = generateDietPlan(bio, targets, date, preferredDietId);
  if (dp) {
    await saveDaySchedule(dp.schedule);
    return { dietId: dp.diet.id, source: "local" };
  }
  return null;
}

/**
 * Fill a rolling buffer of upcoming days with AI plans so the user can follow
 * their schedule OFFLINE. Only touches days that don't already have a plan, and
 * only runs when the backend is configured (the offline baseline is filled
 * lazily on rollover via {@link ensureDietForDate}). Safe to fire-and-forget.
 *
 * Returns the diet id of the first day it can resolve, for plan-state stamping.
 */
let bufferInFlight: Promise<void> | null = null;
let bufferGeneration = 0;

/**
 * Invalidate any in-flight buffer fill (e.g. after a preference change) so it
 * stops writing stale-style days and the next call starts a fresh fill.
 */
export function invalidateDietBuffer(): void {
  bufferGeneration++;
  bufferInFlight = null;
}

export async function ensureDietBuffer(
  bio: UserBio,
  targets: NutritionTargets,
  fromDate: string,
  preferredDietId?: string,
  days = 7,
): Promise<void> {
  if (!WellivaApi.isConfigured) return;
  // Coalesce concurrent fills (onboarding + the app-open effect can overlap)
  // so we never fire duplicate AI calls for the same day.
  if (bufferInFlight) return bufferInFlight;
  const gen = bufferGeneration;
  bufferInFlight = (async () => {
    const start = parseLocalDate(fromDate);
    for (let i = 0; i < days; i++) {
      if (gen !== bufferGeneration) return; // superseded (e.g. prefs changed)
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = toLocalDateString(d);
      if (await getScheduleForDate(dateStr)) continue; // already cached
      try {
        const ai = await WellivaApi.generateDiet({ bio, targets, date: dateStr, dietId: preferredDietId });
        if (gen !== bufferGeneration) return; // don't persist stale work
        await saveDaySchedule(ai.schedule);
      } catch (e) {
        // Likely offline — stop here; rollover will fill lazily when needed.
        console.warn(`PlanSync: buffer fill for ${dateStr} stopped:`, e);
        break;
      }
    }
  })().finally(() => {
    if (gen === bufferGeneration) bufferInFlight = null;
  });
  return bufferInFlight;
}

/**
 * A diet-affecting preference changed (cuisine, dislikes, allergies, region,
 * goal…). Refresh the WHOLE plan: regenerate today fresh, drop the now-stale
 * cached upcoming days, and refill the offline buffer in the new style. This is
 * what makes a cuisine/preference change propagate across the entire week, not
 * just today.
 */
export async function applyDietPreferenceChange(
  bio: UserBio,
  targets: NutritionTargets,
  today: string,
  preferredDietId?: string,
): Promise<EnsuredDiet | null> {
  invalidateDietBuffer();
  await clearScheduledDietsAfter(today); // tomorrow onward is stale now
  const result = await regenerateDietForDate(bio, targets, today, preferredDietId);
  void ensureDietBuffer(bio, targets, today, preferredDietId ?? result?.dietId);
  return result;
}

/**
 * Build a weekly workout plan, AI-first with local fallback. The AI plan is
 * stamped with the LOCAL input hash so the app's weekly drift-check treats it as
 * current and never clobbers it on a later launch.
 */
export async function generateWorkoutWeek(
  bio: UserBio,
  weekStart: string,
): Promise<GeneratedWorkoutPlan> {
  await ensureWorkoutExercisesLoaded(); // local generator reads the exercise pool
  if (WellivaApi.isConfigured) {
    try {
      const ai = await WellivaApi.generateWorkout({ bio, weekStart });
      const localHash = generateWorkoutPlan(bio, weekStart, {
        equipment: bio.equipment,
        daysPerWeek: bio.workoutDaysPerWeek,
      }).inputHash;
      return { ...ai.plan, inputHash: localHash };
    } catch (e) {
      console.warn("PlanSync: AI workout failed, using local generator:", e);
    }
  }
  return generateWorkoutPlan(bio, weekStart, {
    equipment: bio.equipment,
    daysPerWeek: bio.workoutDaysPerWeek,
    salt: Date.now().toString(),
  });
}
