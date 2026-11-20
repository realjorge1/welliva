/**
 * DAY STATUS — is a closed day a whole day of eating, or only part of one?
 *
 * ── THE BUG THIS CLOSES ─────────────────────────────────────────────────────
 * `hasRecordedIntake` calls a day "recorded" once any macro is above zero, so a
 * day with one 150 kcal snack logged was averaged as if she ate 150 kcal. That
 * dragged down the trend averages, told the cycle tracker "you ate less this
 * cycle" (late.ts) and fed the learning model a starving day. MyFitnessPal has
 * "Complete this entry" for exactly this.
 *
 * ── THE RULE (one place, shared) ────────────────────────────────────────────
 *   complete — she said "That's everything for today" (her word wins)
 *   inferred — at least INFER_MIN_MEALS planned meals ticked, or her recorded
 *              calories reached INFER_MIN_SHARE of her target
 *   partial  — something logged, neither of the above (or she said it isn't
 *              everything)
 *   none     — nothing logged: unknown, never zero
 *
 * Averages, trends, "you ate less" readings and the learning model count only
 * complete and inferred days. Adherence (meals eaten ÷ planned) is a different
 * question and stays plan-based.
 *
 * Inference reads only fields a DietHistoryEntry already has, plus a target,
 * so existing history needs no migration: old days are simply inferred. A day
 * closed after 2026-11-20 carries its own status and the target it was judged
 * against (`loggedness`, `targetCalories`), so it never needs re-judging.
 *
 * Pure: no storage, no React. (The explicit flags' store is at the bottom.)
 */
import type { DietHistoryEntry } from "../../models/diet";
import { readJSON, writeJSON } from "../OfflineStorage";
import { pruneDatedRecord, RETENTION_DAYS } from "../sync/retention";
import { hasRecordedIntake } from "./recordedIntake";

export type DayLoggedness = "none" | "partial" | "complete" | "inferred";

/** Three planned meals ticked reads as a day's eating, whatever the calories. */
export const INFER_MIN_MEALS = 3;
/**
 * Recorded calories at 70% of target or more read as a whole day: most real
 * logging runs 20–30% under (the learning model's own caveat), so a day that
 * reached 70% is a logged day, not a skipped one.
 */
export const INFER_MIN_SHARE = 0.7;

/** The fields the rule reads; any may be missing (older or slimmer records). */
type DayFields = Partial<
  Pick<
    DietHistoryEntry,
    | "consumedCalories"
    | "consumedProteinG"
    | "consumedCarbsG"
    | "consumedFatG"
    | "mealsConsumed"
    | "totalMeals"
    | "loggedness"
    | "targetCalories"
  >
>;

/**
 * How much of a day was logged.
 *
 * @param opts.explicit her own answer for the day: true = "That's everything",
 *                      false = "not everything" (she corrected an inferred day),
 *                      null/undefined = she didn't say
 * @param opts.targetKcal the target to judge an UNSTAMPED day against
 */
export function dayLoggedness(
  entry: DayFields,
  opts: { explicit?: boolean | null; targetKcal?: number | null } = {},
): DayLoggedness {
  if (!hasRecordedIntake(entry)) return opts.explicit === true ? "complete" : "none";
  if (opts.explicit === true) return "complete";
  if (opts.explicit === false) return "partial";
  if ((entry.mealsConsumed ?? 0) >= INFER_MIN_MEALS) return "inferred";
  const target = opts.targetKcal ?? entry.targetCalories ?? null;
  if (
    typeof target === "number" &&
    target > 0 &&
    typeof entry.consumedCalories === "number" &&
    entry.consumedCalories >= INFER_MIN_SHARE * target
  ) {
    return "inferred";
  }
  return "partial";
}

/**
 * Does this closed day count as a day of eating (for averages, trends, the
 * cycle readings and learning)? A day stamped at close is read as stamped; an
 * older one is inferred against `targetKcal` (her current target is the best
 * stand-in for a day that never recorded its own).
 */
export function countsAsDay(entry: DayFields, targetKcal?: number | null): boolean {
  const status =
    entry.loggedness ?? dayLoggedness(entry, { targetKcal: entry.targetCalories ?? targetKcal });
  return status === "complete" || status === "inferred";
}

/**
 * Each WHOLE day's calories, oldest-first as given — the input the cycle
 * tracker's "hungrier week" (hungry.ts) and "you ate less this cycle"
 * (late.ts) readings take. One helper so both read the same days.
 */
export function wholeDayIntake(
  history: readonly (DayFields & { date: string })[],
  targetKcal?: number | null,
): { date: string; kcal: number }[] {
  return history
    .filter((e) => countsAsDay(e, targetKcal))
    .map((e) => ({ date: e.date, kcal: e.consumedCalories ?? 0 }));
}

/* ───────────────────────────── her own answers ─────────────────────────────*/

/**
 * Synced: Record<date, { complete, at }>. A day marked on the phone is marked
 * on the tablet; an undo is the same date with `complete: false` and a newer
 * `at`, so it wins (mergeByDate, preferField "at").
 */
export const DAY_COMPLETE_KEY = "@welliva_day_complete";

export interface DayCompleteFlag {
  complete: boolean;
  /** ISO time of her answer. */
  at: string;
}

export type DayCompleteStore = Record<string, DayCompleteFlag>;

export async function loadDayComplete(): Promise<DayCompleteStore> {
  try {
    const store = await readJSON<DayCompleteStore>(DAY_COMPLETE_KEY, {});
    return store && typeof store === "object" ? store : {};
  } catch {
    return {};
  }
}

/** Her answer for one date, or null if she never gave one. */
export async function explicitFor(date: string): Promise<boolean | null> {
  const store = await loadDayComplete();
  const flag = store[date];
  return flag && typeof flag.complete === "boolean" ? flag.complete : null;
}

export async function setDayComplete(date: string, complete: boolean, now: Date = new Date()): Promise<void> {
  const store = await loadDayComplete();
  store[date] = { complete, at: now.toISOString() };
  // Same horizon as the food it describes.
  await writeJSON(DAY_COMPLETE_KEY, await pruneDatedRecord(store, RETENTION_DAYS.FOOD_LOG));
}
