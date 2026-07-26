/**
 * TRACKING MODE
 *
 * What is this app FOR, for this particular user? Three honest answers:
 *
 *   "diet"    — I'm here to eat better. I still work out sometimes, but don't
 *               plan it, don't score it, don't put it in my streak. Just tell
 *               me how the session went and let it go.
 *   "workout" — I'm here to train. I still eat, obviously, but I don't want a
 *               meal plan or a calorie target following me around. Let me look
 *               something up when I care and forget it otherwise.
 *   "both"    — Track everything. The full system.
 *
 * WHY THIS IS A MODEL AND NOT A SETTINGS FLAG
 * The untracked side isn't "the tracked side with the UI hidden". It behaves
 * differently at the data layer: an untracked activity produces a single result
 * the user reads once, and is deliberately NOT written to history, streaks,
 * achievements, targets, or the plan period. Hiding a chart while still
 * accumulating the data behind it would betray the choice — the user said they
 * didn't want to be scored, so we don't score them.
 *
 * Everything downstream gates on `tracksDiet()` / `tracksWorkout()` rather than
 * comparing to string literals, so adding a mode later stays a one-file change.
 */

import type { MealType } from "./diet";
import type { NutrientPanel } from "./nutrients";

export type TrackingMode = "diet" | "workout" | "both";

export const DEFAULT_TRACKING_MODE: TrackingMode = "both";

/** Is nutrition a tracked domain — plans, targets, streaks, history? */
export function tracksDiet(mode: TrackingMode): boolean {
  return mode === "diet" || mode === "both";
}

/** Is training a tracked domain — plans, progression, streaks, history? */
export function tracksWorkout(mode: TrackingMode): boolean {
  return mode === "workout" || mode === "both";
}

/** The domain the user opted out of tracking, if any. */
export function untrackedDomain(
  mode: TrackingMode,
): "diet" | "workout" | null {
  if (mode === "diet") return "workout";
  if (mode === "workout") return "diet";
  return null;
}

export interface TrackingModeOption {
  mode: TrackingMode;
  title: string;
  subtitle: string;
  /** What the user still gets on the untracked side — set expectations up front. */
  note: string;
  icon: string;
}

export const TRACKING_MODE_OPTIONS: TrackingModeOption[] = [
  {
    mode: "diet",
    title: "Nutrition",
    subtitle: "Plans, targets and food tracking",
    note: "Workouts stay casual — pick one whenever you feel like it and get a result at the end. Nothing is scored or saved.",
    icon: "nutrition-outline",
  },
  {
    mode: "workout",
    title: "Training",
    subtitle: "Workout plans and progression",
    note: "Meals stay casual — look up a meal or a food whenever you want. No plan, no targets, no logging.",
    icon: "barbell-outline",
  },
  {
    mode: "both",
    title: "Everything",
    subtitle: "Nutrition and training, fully tracked",
    note: "The complete system — plans, targets, streaks and progress across both.",
    icon: "infinite-outline",
  },
];

// ============================================================================
// AD-HOC RESULTS — the untracked path
// ============================================================================

/**
 * A one-off result from an untracked activity. Held in memory for the screen
 * that shows it and intentionally never persisted to history, streaks or
 * achievements. `expiresAt` exists so a result left on screen overnight doesn't
 * masquerade as today's data after the date rolls over.
 */
export interface AdHocResultBase {
  id: string;
  /** ISO timestamp. */
  completedAt: string;
  /** Local YYYY-MM-DD it was produced on, for the staleness check only. */
  date: string;
}

/** Result of a casual workout in diet-only mode. Read once, then gone. */
export interface AdHocWorkoutResult extends AdHocResultBase {
  kind: "workout";
  name: string;
  durationMin: number;
  exercisesCompleted: number;
  exercisesTotal: number;
  /** Estimated only — shown with an explicit "estimate" label in the UI. */
  estimatedCalories: number | null;
  /** Muscle groups the session touched, for the summary line. */
  focus: string[];
}

/** Result of a casual meal lookup in workout-only mode. Read once, then gone. */
export interface AdHocMealResult extends AdHocResultBase {
  kind: "meal";
  name: string;
  slot: MealType | null;
  nutrients: NutrientPanel;
  /** Provenance summary so even the casual path never shows unsourced numbers. */
  sourceNote: string;
}

export type AdHocResult = AdHocWorkoutResult | AdHocMealResult;

/**
 * An ad-hoc result is only meaningful on the day it was produced. Past that we
 * drop it rather than let it read as current.
 */
export function isAdHocResultFresh(
  result: AdHocResult,
  today: string,
): boolean {
  return result.date === today;
}

// ============================================================================
// GATING HELPERS
// ============================================================================

/**
 * Should this domain contribute to streaks, achievements and the daily score?
 * The single question every scoring call site should ask.
 */
export function countsTowardProgress(
  mode: TrackingMode,
  domain: "diet" | "workout",
): boolean {
  return domain === "diet" ? tracksDiet(mode) : tracksWorkout(mode);
}

/**
 * Copy for the empty state on an untracked tab — explains the choice and points
 * at the casual entry point instead of nagging the user to start tracking.
 */
export function untrackedCopy(domain: "diet" | "workout"): {
  title: string;
  body: string;
  cta: string;
} {
  return domain === "workout"
    ? {
        title: "Training isn't tracked",
        body: "You set Welliva up for nutrition. You can still run a workout any time you feel like it — you'll get a summary at the end, and nothing gets logged.",
        cta: "Pick a workout",
      }
    : {
        title: "Nutrition isn't tracked",
        body: "You set Welliva up for training. You can still look up any meal or food and see exactly what's in it — nothing gets logged or counted.",
        cta: "Look up a food",
      };
}
