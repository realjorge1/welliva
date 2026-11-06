/**
 * services/nutrition/dayTargets.ts — when one day's calorie target isn't the usual one.
 *
 * The profile's targets are a person's targets, and nothing here edits them. This
 * is a narrow layer on top: a date, a number of kcal, and the reason. Today its
 * one writer is the hungrier-week plan (services/cycle/hungry), which the user
 * chose, can see, and can switch off.
 *
 * EVERY READER OF A DAY'S CALORIE TARGET GOES THROUGH HERE, so a day can't have
 * one target on Home and another on Diet:
 *
 *   Home's calorie hero and its "yesterday" fact, Diet's ring, "kcal left" and meal
 *   swap ranking, the nutrition trend's "% of target", the coach's today numbers,
 *   and the coach insight that says you've gone over.
 *
 * WHO DELIBERATELY DOESN'T. Anything that reads a long-run average: the forecast's
 * maintenance estimate, the coach's 14-day comparison, the period report and the
 * meal plan generator. The plan keeps the total the same, so over a fortnight the
 * usual target is the right one to compare with, and it keeps a one-day shift from
 * looking like a change in someone's metabolism. Protein, carbs and fat targets
 * don't move either: this is a calorie number, not a new diet.
 *
 * It is not a change to how targets are calculated, so TARGETS_ALGO_VERSION
 * stays put (services/nutrition/TargetsVersion).
 *
 * It is pushed in by whoever owns the plan, rather than read from storage here,
 * so this module knows nothing about cycles and stays importable from anywhere.
 */

export interface DayTargetAdjustment {
  /** Added to the day's calorie target. Negative on a day evened out for another. */
  kcal: number;
  /** Why, in case another feature ever writes here. */
  reason: "cycle";
}

export type DayTargetAdjustments = Readonly<Record<string, DayTargetAdjustment>>;

const NONE: DayTargetAdjustments = Object.freeze({});
let current: DayTargetAdjustments = NONE;
const listeners = new Set<() => void>();

/** The plan's owner announces the full set; signing out announces none. */
export function publishDayAdjustments(next: DayTargetAdjustments): void {
  if (next === current) return;
  current = Object.keys(next).length ? next : NONE;
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      // one bad listener must not stop the others
    }
  }
}

export function subscribeDayAdjustments(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function dayAdjustmentsSnapshot(): DayTargetAdjustments {
  return current;
}

/** The kcal a date's target moves by. 0 on almost every day for almost everyone. */
export function dayCalorieDelta(date: string, adjustments: DayTargetAdjustments = current): number {
  return adjustments[date]?.kcal ?? 0;
}

/** A date's calorie target. `base` is the profile's target. */
export function dayCalorieTarget(
  base: number,
  date: string,
  adjustments: DayTargetAdjustments = current,
): number {
  return base + dayCalorieDelta(date, adjustments);
}

/** The small note beside the target. Null on an ordinary day. Never a penalty, never a debt. */
export function dayTargetNote(kcal: number): string | null {
  if (kcal > 0) return `+${kcal} · hungrier week`;
  if (kcal < 0) return `−${Math.abs(kcal)} · evened out`;
  return null;
}
