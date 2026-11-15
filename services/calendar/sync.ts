/**
 * services/calendar/sync.ts — keep welliva's calendar in step with the plan and the cycle.
 *
 * Two switches, both OFF until the person turns them on, both kept on this phone
 * only (the calendar they fill exists on this phone only):
 *   · workouts — the stored week's sessions at the training hour (Fitness settings)
 *   · cycle    — likely period days (+ the fertile window if she shows it), in the
 *                cycle's own discreet wording (Cycle settings). Never written while
 *                cycle tracking is off; switching either off removes its entries.
 *
 * Syncs run one at a time, newest call last, like the reminder modules — two
 * overlapping syncs must never write the same entry twice.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { loadFitnessProfile } from "@/fitness/services/FitnessProfileStore";
import type { GeneratedWorkoutPlan } from "@/models/workout";
import { KEYS, readJSON, todayDate } from "@/services/OfflineStorage";
import type { UserBio } from "@/models/user";

import { applyScope, clearWindow, type ApplyResult } from "./device";
import { addDays, cycleEventSpecs, dayStart, workoutEventSpecs, type CalendarScope } from "./events";

export const CALENDAR_WORKOUTS_KEY = "@welliva_calendar_workouts_on";
export const CALENDAR_CYCLE_KEY = "@welliva_calendar_cycle_on";

const KEY_OF: Record<CalendarScope, string> = {
  workouts: CALENDAR_WORKOUTS_KEY,
  cycle: CALENDAR_CYCLE_KEY,
};

/** How far ahead each scope is written. The cycle's second period is ~2 cycles out. */
const AHEAD_DAYS: Record<CalendarScope, number> = { workouts: 14, cycle: 120 };

type Listener = () => void;
const listeners = new Set<Listener>();

/** Re-render when a switch flips (the settings rows and the runner both listen). */
export function onCalendarPrefsChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function calendarScopeOn(scope: CalendarScope): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY_OF[scope])) === "1";
  } catch {
    return false;
  }
}

export async function setCalendarScopeOn(scope: CalendarScope, on: boolean): Promise<void> {
  try {
    if (on) await AsyncStorage.setItem(KEY_OF[scope], "1");
    else await AsyncStorage.removeItem(KEY_OF[scope]);
  } finally {
    for (const fn of [...listeners]) {
      try {
        fn();
      } catch {
        // one bad listener must not stop the others
      }
    }
  }
}

let tail: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(job, job);
  tail = run.catch(() => undefined);
  return run;
}

/** Remove every entry of a scope — the switch went off, or the source did. */
function clearScope(scope: CalendarScope): Promise<ApplyResult> {
  const { from, to } = clearWindow();
  return applyScope(scope, [], from, to);
}

/**
 * Workouts. `plan` is the stored week (useWorkout().workoutPlan); the hour comes
 * from the fitness profile (the same hour as the training-day reminder).
 */
export function syncWorkoutCalendar(plan: GeneratedWorkoutPlan | null): Promise<ApplyResult> {
  return oneAtATime(async () => {
    if (!(await calendarScopeOn("workouts"))) return clearScope("workouts");
    const profile = await loadFitnessProfile();
    const today = todayDate();
    const wanted = workoutEventSpecs(plan, profile.reminders?.hour ?? 17, today);
    // From today's midnight: a past session stays where it was (it happened).
    return applyScope("workouts", wanted, dayStart(today), dayStart(addDays(today, AHEAD_DAYS.workouts)));
  });
}

/** The cycle — read from storage like its reminders, so the cycle screen needn't be open. */
export function syncCycleCalendar(): Promise<ApplyResult> {
  return oneAtATime(async () => {
    if (!(await calendarScopeOn("cycle"))) return clearScope("cycle");
    // Imported here: the cycle module is large and only some people use it.
    const { loadCycleData, predict, fertileWindowAllowed, cycleModeOf } = await import("@/services/cycle");
    const data = await loadCycleData();
    if (!data.settings.enabled) return clearScope("cycle");
    const bio = await readJSON<Partial<UserBio> | null>(KEYS.USER_BIO, null);
    const today = todayDate();
    const input = {
      episodes: data.periods,
      days: data.days,
      settings: data.settings,
      today,
      profile: { age: bio?.age ?? null, conditions: bio?.medicalConditions ?? [] },
    };
    const prediction = predict(input);
    // The same rule the cycle screen uses (services/cycle/view): her switch AND her mode.
    const mode = cycleModeOf(input.profile.conditions, data.settings.contraception?.answer);
    const wanted = cycleEventSpecs({
      prediction,
      discreet: data.settings.discreet,
      fertileWindow: fertileWindowAllowed(data.settings.showFertileWindow, mode),
      today,
    });
    // From a cycle back, so a period that has begun is still moved or cleared.
    return applyScope("cycle", wanted, dayStart(addDays(today, -45)), dayStart(addDays(today, AHEAD_DAYS.cycle)));
  });
}
