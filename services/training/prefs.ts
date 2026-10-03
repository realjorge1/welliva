/**
 * TRAINING PREFERENCES — the one reading of "how does this person want to
 * train?" that the plan, the reminders and the weekly target all share.
 *
 * Two stores hold training answers: UserBio (level, equipment, a days-per-week
 * COUNT from onboarding) and the FitnessProfile (the actual WEEKDAYS, session
 * length, styles, location, milestone, plan mode). They used to be read
 * separately — the plan put a 3-day week on Mon/Wed/Fri from the count while
 * reminders fired on whatever weekdays setup had stored — so the app could
 * schedule Monday and remind Tuesday. `resolveTrainingPrefs` is now the only
 * place the two are reconciled, and the rule is simple:
 *
 *   • Days the profile holds for real (`daysSource` set, or a finished setup)
 *     are the days.
 *   • Otherwise the days are derived from the bio's count, spaced for recovery
 *     (`spacedDays`), and the first plan build writes them back (as "derived")
 *     so every other reader sees the same days from then on.
 */

import type {
  ChosenWorkout,
  FitnessGoal,
  FitnessProfile,
  TrainingAdjustment,
  WorkoutLocation,
  WorkoutPlanMode,
  WorkoutStyle,
} from "../../fitness/types";
import type { PrimaryGoal, UserBio } from "../../models/user";

/** Sensible weekly training default per goal when the user never said. */
export const DEFAULT_DAYS_FOR_GOAL: Record<PrimaryGoal, number> = {
  lose_weight: 3,
  build_muscle: 4,
  improve_fitness: 4,
  increase_energy: 3,
  better_health: 3,
  athletic_performance: 5,
};

/**
 * Training days per sessions-a-week, Monday = 0. Each set leaves at least one
 * rest day between sessions where the count allows it (2–3 a week), and puts
 * the unavoidable back-to-back pairs where a split trains different muscles on
 * consecutive days (4–6 a week).
 */
const SPACED_DAYS: Record<number, readonly number[]> = {
  1: [2], // Wed
  2: [0, 3], // Mon, Thu
  3: [0, 2, 4], // Mon, Wed, Fri
  4: [0, 1, 3, 4], // Mon, Tue, Thu, Fri
  5: [0, 1, 2, 4, 5], // Mon–Wed, Fri, Sat
  6: [0, 1, 2, 3, 4, 5], // Mon–Sat, Sunday off
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function spacedDays(count: number): number[] {
  const n = Math.min(7, Math.max(1, Math.round(Number.isFinite(count) ? count : 3)));
  return [...SPACED_DAYS[n]];
}

/** Unique whole weekdays 0–6, ascending. Anything else is dropped. */
export function normalizeDays(days: unknown): number[] {
  if (!Array.isArray(days)) return [];
  const set = new Set<number>();
  for (const d of days) {
    if (typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6) set.add(d);
  }
  return [...set].sort((a, b) => a - b);
}

export interface TrainingPrefs {
  /** Training weekdays, 0 = Mon … 6 = Sun, ascending, never empty. */
  days: number[];
  /** "you" = picked by the user; "derived" = spaced from the bio's count. */
  daysSource: "you" | "derived";
  /** Minutes per session the user chose, or null when they never said. */
  sessionMinutes: number | null;
  /** Training goals from setup (empty = read the profile's goals instead). */
  goals: FitnessGoal[];
  styles: WorkoutStyle[];
  location: WorkoutLocation;
  milestone: string | null;
  mode: WorkoutPlanMode;
  /** Library workouts on training days (only days in `days` are kept). */
  chosen: ChosenWorkout[];
  adjustments: TrainingAdjustment[];
}

export function defaultDayCount(bio: UserBio | null): number {
  return bio?.workoutDaysPerWeek ?? DEFAULT_DAYS_FOR_GOAL[bio?.primaryGoal ?? "better_health"];
}

export function resolveTrainingPrefs(
  bio: UserBio | null,
  profile: FitnessProfile | null,
): TrainingPrefs {
  const stored =
    profile && (profile.daysSource || profile.setupComplete) ? normalizeDays(profile.daysAvailable) : [];
  const days = stored.length > 0 ? stored : spacedDays(defaultDayCount(bio));
  // A finished setup asked for the days, so those were picked.
  const source: "you" | "derived" =
    stored.length > 0 ? (profile?.daysSource ?? (profile?.setupComplete ? "you" : "derived")) : "derived";
  const minutes = profile?.setupComplete ? profile.typicalDurationMin : null;
  const daySet = new Set(days);

  return {
    days,
    daysSource: source,
    sessionMinutes:
      typeof minutes === "number" && Number.isFinite(minutes) && minutes >= 5
        ? Math.round(minutes)
        : null,
    goals: profile?.goals ?? [],
    styles: profile?.preferredStyles ?? [],
    location: profile?.location ?? "anywhere",
    milestone: profile?.milestone?.trim() || null,
    mode: profile?.planMode ?? "planned",
    chosen: (profile?.chosenWorkouts ?? []).filter(
      (c) => daySet.has(c.day) && typeof c.workoutId === "string" && c.workoutId.length > 0,
    ),
    adjustments: profile?.trainingAdjustments ?? [],
  };
}
