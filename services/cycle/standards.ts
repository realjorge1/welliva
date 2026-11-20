/**
 * services/cycle/standards.ts — the ONE medical standard the doctor notes use.
 *
 * Before 2026-11-20 the notes mixed two rulebooks: cycle length against 21–35
 * days and bleeding against 7 days, but regularity against FIGO 2018, whose own
 * normal range is 24–38 days (Fix 10). The owner chose FIGO everywhere
 * (2026-11-20), which makes the app warn LESS often.
 *
 * Source: Munro, Critchley, Fraser and the FIGO Menstrual Disorders Committee,
 * "The two FIGO systems for normal and abnormal uterine bleeding symptoms",
 * Int J Gynecol Obstet 2018. For the first years after periods begin cycles
 * normally run longer and vary more, so under 20 the range is the adolescent
 * one, 21–45 days (ACOG Committee Opinion 651).
 *
 * Every reader imports these: the notes (./flags), the library pages that quote
 * them (./library, whose tests hold the words to these numbers) and the doctor
 * summary. A threshold written anywhere else is a bug.
 */

/** FIGO 2018 normal frequency: a cycle under 24 or over 38 days, twice in her last six, is worth raising. */
export const NORMAL_CYCLE_DAYS = { min: 24, max: 38 } as const;
/** Under this age the adolescent range applies. */
export const ADOLESCENT_BELOW_AGE = 20;
/** The adolescent normal range: cycles run longer and vary more in the first years. */
export const ADOLESCENT_CYCLE_DAYS = { min: 21, max: 45 } as const;
/** FIGO 2018 normal duration: bleeding for more than this many days is worth raising. */
export const MAX_NORMAL_BLEED_DAYS = 8;
/** FIGO 2018 regularity: shortest-to-longest spread allowed at 26–41... */
export const REGULAR_SPREAD_DAYS = 7;
/** ...and at other ages. */
export const REGULAR_SPREAD_DAYS_OTHER_AGES = 9;
/** One line, for any page or note that names its source. */
export const STANDARD_SOURCE = "These are the international FIGO 2018 limits.";

/** The normal cycle-length range for her age. */
export function cycleRangeFor(age: number | null | undefined): { min: number; max: number } {
  return age != null && age < ADOLESCENT_BELOW_AGE ? ADOLESCENT_CYCLE_DAYS : NORMAL_CYCLE_DAYS;
}

/** FIGO 2018: a regular cycle varies by ≤7 days at 26–41, ≤9 days otherwise. */
export function regularityLimit(age: number | null | undefined): number {
  return age != null && age >= 26 && age <= 41 ? REGULAR_SPREAD_DAYS : REGULAR_SPREAD_DAYS_OTHER_AGES;
}
