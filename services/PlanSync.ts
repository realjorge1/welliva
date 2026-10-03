/**
 * PLAN SYNC — the bridge between the AI backend and offline-first scheduling.
 *
 * Strategy: "generate ahead, then serve from the phone".
 *  - When online, the AI backend (Claude Haiku) builds MEAL plans personalized
 *    to the user's full bio (including region) and we cache them on the device.
 *  - Day to day, the app reads the cached day — no network needed.
 *  - When the backend is unconfigured or unreachable, we fall back to the local
 *    deterministic generator so the app never breaks.
 *
 * Workout plans are NOT AI-written, for anyone. Every week is built on the
 * phone by the training engine (services/training): each move chosen from the
 * user's own data with the reason shown, each dose climbed from what they
 * logged. An AI-written week could not do either — its moves had throwaway ids
 * that no later week could progress from, and its choices could not be traced
 * to an input. Pro's training value is what sits on top of the engine (a
 * lighter session on a low-recovery day; Gozlin's adjustments and
 * explanations), not a different author for the plan.
 *
 * THE TIER BOUNDARY LIVES HERE (for meals)
 *
 * AI meal generation is a Pro feature, and this file is where that is decided.
 * Free users take the `generateDietPlan` branch — the same deterministic engine
 * over the clinically-reviewed diet catalog the app shipped with. That matters: a
 * free user gets a real, complete, personalised-by-rules plan, not a stub or an
 * error. There is no dead end anywhere below, which is why the gate can be a
 * single `&&` at each call site rather than a new code path.
 *
 * This is also the *only* place a meal plan can become AI-generated, so gating
 * here covers onboarding, daily rollover, regeneration and the offline buffer at
 * once. The spend itself is additionally protected server-side — a modified
 * client can still call the endpoint (docs/monetization/setup.md Part 6).
 *
 * VARIETY. Every AI day is asked for on its own, so each request carries the
 * main meals of the days just before it (`recentMeals`) — without them Gozlin
 * cannot know what it served yesterday, and a model asked the same question
 * gives the same answer. For the same reason a run of days is planned IN ORDER
 * ({@link regenerateDietDays}), never as a blind parallel batch.
 *
 * These are async functions with no React state. Callers persist any resulting
 * plan-state themselves.
 */
import type { DaySchedule } from "../models/diet";
import type { NutritionTargets } from "../models/nutrition";
import type { UserBio } from "../models/user";
import type { GeneratedWorkoutPlan } from "../models/workout";
import type { FitnessProfile, WorkoutDefinition } from "../fitness/types";
import { ensureDietLibraryLoaded } from "../constants/DietDatabase";
import {
  loadFitnessProfile,
  updateFitnessProfile,
} from "../fitness/services/FitnessProfileStore";
import { WellivaApi } from "./api/WellivaApi";
import { allows } from "./billing/gating";
import { generateDietPlan } from "./DietPlanGenerator";
import { KEYS, parseLocalDate, readJSON, toLocalDateString } from "./OfflineStorage";
import {
  clearScheduledDietsAfter,
  getScheduleForDate,
  getStoredSchedules,
  saveDaySchedule,
} from "./ScheduleService";
import { SessionService } from "./SessionService";
import { resolveTrainingPrefs, type TrainingPrefs } from "./training";
import { ensureWorkoutExercisesLoaded, generateWorkoutPlan } from "./WorkoutGenerator";

export interface EnsuredDiet {
  dietId: string;
  /** Where the served plan came from. */
  source: "cache" | "ai" | "local";
}

/**
 * Whether to take the AI branch: a backend must exist AND the user must be
 * entitled to it. Read on every call rather than cached, so an upgrade takes
 * effect on the next plan the app builds — no restart, no cache to invalidate.
 */
function canGenerateWithAI(): boolean {
  // `ai-plans` is the Pro-tier feature: Free and Plus are matched to the
  // catalog by the local generator below, which is a genuinely good plan — the
  // AI branch is what writes one against this specific body.
  return WellivaApi.isConfigured && allows("ai-plans");
}

/** How many days back Gozlin is told about. */
const RECENT_DAYS = 3;

const shiftDate = (date: string, days: number): string => {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
};

/** The main meals already planned on the days just before `date`, most recent first. */
async function recentMealNames(date: string): Promise<string[]> {
  try {
    const before = Array.from({ length: RECENT_DAYS }, (_, i) => shiftDate(date, -(i + 1)));
    const stored = await getStoredSchedules(before);
    return before.flatMap((d) => {
      const s = stored.get(d);
      return s ? [s.breakfast, s.lunch, s.dinner].flatMap((m) => (m ? [m.name] : [])) : [];
    });
  } catch {
    // A hint, not a requirement: a day planned without it is still a day.
    return [];
  }
}

/** One AI day, told what the days before it served. Throws when the backend can't answer. */
async function aiDay(
  bio: UserBio,
  targets: NutritionTargets,
  date: string,
  preferredDietId?: string,
): Promise<DaySchedule> {
  const ai = await WellivaApi.generateDiet({
    bio,
    targets,
    date,
    dietId: preferredDietId,
    recentMeals: await recentMealNames(date),
  });
  return ai.schedule;
}

/** Plan one day, NOT saved: Gozlin when the user has it and it answers, else the on-device rotation. */
async function planOneDay(
  bio: UserBio,
  targets: NutritionTargets,
  date: string,
  preferredDietId?: string,
): Promise<{ schedule: DaySchedule; source: "ai" | "local" } | null> {
  if (canGenerateWithAI()) {
    try {
      return { schedule: await aiDay(bio, targets, date, preferredDietId), source: "ai" };
    } catch (e) {
      console.warn(`PlanSync: AI diet for ${date} failed, using local generator:`, e);
    }
  }
  await ensureDietLibraryLoaded(); // local generator reads the full diet library
  const dp = generateDietPlan(bio, targets, date, preferredDietId);
  return dp ? { schedule: dp.schedule, source: "local" } : null;
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

  const day = await planOneDay(bio, targets, date, preferredDietId);
  if (!day) return null;
  await saveDaySchedule(day.schedule);
  return { dietId: day.schedule.dietId, source: day.source };
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
  const day = await planOneDay(bio, targets, date, preferredDietId);
  if (!day) return null;
  await saveDaySchedule(day.schedule);
  return { dietId: day.schedule.dietId, source: day.source };
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
  // Free users have no buffer to fill: their days are generated locally on
  // rollover by `ensureDietForDate`, which needs no network and so needs no
  // read-ahead. Skipping this also means a free user never triggers a single
  // paid API call in the background.
  if (!canGenerateWithAI()) return;
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
        // In order, so each day is asked for knowing the one just written.
        const schedule = await aiDay(bio, targets, dateStr, preferredDietId);
        if (gen !== bufferGeneration) return; // don't persist stale work
        await saveDaySchedule(schedule);
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
 * Plan several days IN ORDER, overwriting what was there — the days after today
 * when a week-long diet starts. Each day is planned after the one before it is
 * written, so Gozlin is told what that day served rather than answering seven
 * blind copies of one question in parallel.
 *
 * It registers as the buffer fill, so the app-open buffer coalesces onto it
 * instead of asking for the same days again, and a newer plan's
 * {@link invalidateDietBuffer} stops it before it can write the old diet's days
 * over the new one.
 */
export function regenerateDietDays(
  bio: UserBio,
  targets: NutritionTargets,
  dates: string[],
  preferredDietId?: string,
): Promise<void> {
  const gen = bufferGeneration;
  const run: Promise<void> = (async () => {
    for (const date of dates) {
      if (gen !== bufferGeneration) return;
      const day = await planOneDay(bio, targets, date, preferredDietId);
      if (!day || gen !== bufferGeneration) return;
      await saveDaySchedule(day.schedule);
    }
  })().finally(() => {
    if (bufferInFlight === run) bufferInFlight = null;
  });
  bufferInFlight = run;
  return run;
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
 * The training preferences the plan reads, from the fitness profile. The first
 * time the days come from the profile's count rather than from a pick, they
 * are written back (marked "derived") so the reminders and the weekly target
 * read the same days the plan schedules — one set of training days, app-wide.
 */
export async function loadTrainingPrefs(bio: UserBio): Promise<TrainingPrefs> {
  const profile = await loadFitnessProfile();
  const prefs = resolveTrainingPrefs(bio, profile);
  if (!profile.daysSource && !profile.setupComplete) {
    await adoptDerivedDays(profile, prefs.days);
  }
  return prefs;
}

async function adoptDerivedDays(profile: FitnessProfile, days: number[]): Promise<void> {
  try {
    const next = await updateFitnessProfile({ daysAvailable: days, daysSource: "derived" });
    if (profile.reminders.workouts) {
      // Reminders were laid on the placeholder days; move them to the real ones.
      const { syncFitnessReminders } = await import("../fitness/services/FitnessNotifications");
      await syncFitnessReminders(next);
    }
  } catch (e) {
    console.warn("PlanSync: could not record training days:", e);
  }
}

async function libraryLookup(): Promise<(id: string) => WorkoutDefinition | undefined> {
  const { WORKOUT_BY_ID } = await import("../fitness/data/workouts");
  return (id) => WORKOUT_BY_ID.get(id);
}

/**
 * Build this week's workout plan on the phone, from everything the engine
 * reads: the bio, the training preferences, every logged guided session, and
 * the plan it replaces (so doses climb from where the user actually is).
 * Deterministic — calling it twice in a row builds the same plan.
 */
export async function generateWorkoutWeek(
  bio: UserBio,
  weekStart: string,
  previous?: GeneratedWorkoutPlan | null,
): Promise<GeneratedWorkoutPlan> {
  await ensureWorkoutExercisesLoaded(); // the engine reads the exercise pool
  const prefs = await loadTrainingPrefs(bio);
  const [sessions, prior, library] = await Promise.all([
    SessionService.getInstance().loadHistory(),
    previous !== undefined
      ? Promise.resolve(previous)
      : readJSON<GeneratedWorkoutPlan | null>(KEYS.WORKOUT_PLAN, null),
    prefs.mode === "chosen" && prefs.chosen.length > 0 ? libraryLookup() : Promise.resolve(undefined),
  ]);
  return generateWorkoutPlan(bio, weekStart, {
    prefs,
    sessions,
    previous: prior,
    today: toLocalDateString(new Date()),
    library,
  });
}
