/**
 * WEEKLY INSIGHT — the one thing Gozlin noticed this week, on Home.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE COACH DECK
 *
 * The habit-awareness engine's best output was reachable only by tapping a card
 * in a horizontal carousel and then reading a modal. That is three deliberate
 * actions to reach the feature the top tier is sold on, and most people never
 * take the first one — so the thing Pro charges for was, in practice, invisible
 * to the people deciding whether to buy it.
 *
 * This surfaces exactly one finding, in place, on the screen everyone opens. Not
 * a carousel card competing with five others: a single named moment.
 *
 * WHY IT ROTATES WEEKLY RATHER THAN DAILY
 *
 * These patterns are drawn from weeks of behaviour and they do not change
 * overnight. Rotating daily would show the same three findings on a loop and
 * teach people to ignore the card inside a fortnight; changing never would make
 * it furniture. A week is also the honest cadence for the claim — "this week I
 * noticed" is true of a pattern read over weeks, where "today I noticed" is not.
 *
 * DETERMINISTIC, NOT RANDOM, AND NOT STORED
 *
 * The choice is a pure function of the week and the report, so every render in a
 * given week picks the same finding without persisting anything: no "last shown"
 * record to migrate, to get out of sync across devices, or to reset on
 * reinstall. Two devices signed into the same account show the same insight on
 * the same day, which they should, because it is a fact about the user and not a
 * notification.
 *
 * FREE OR PAID?
 *
 * Free. It is the counterpart to the first-finding-free rule in CoachDeepDive:
 * this card proves the feature works on the user's own data, and tapping it
 * opens the deep dive where the remaining findings are locked. Selling the depth
 * only works if the shallow end is genuinely wet.
 */
import { weekKeyOf } from "@/health-os/platform/clock";
import type { GozlinHabitReport, HabitPattern } from "@/services/gozlin";
import { parseLocalDate } from "@/services/OfflineStorage";

/*
 * Monday-of-week comes from the health-os platform clock rather than
 * HabitService.weekStartOf, which is the same calculation: HabitService imports
 * expo-notifications at module scope, and a pure module has no business pulling
 * a native dependency into everything that touches it — including its own test.
 * Both use the app-wide Mon–Sun convention, so the two agree by construction.
 */

/** A Monday, and the origin for counting weeks. 2024-01-01 was one. */
const EPOCH_MONDAY = "2024-01-01";
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** How many findings may ever appear in the rotation. */
const MAX_ROTATION = 5;

export interface WeeklyInsight {
  /** The finding to show this week. */
  pattern: HabitPattern;
  /** Monday of the week this was picked for — the rotation's stable key. */
  weekStart: string;
  /** Position in the rotation, 0-based. */
  index: number;
  /** How many findings the rotation is drawing from. */
  total: number;
}

/**
 * Whole weeks between the epoch Monday and `weekStart`.
 *
 * Rounded rather than floored because a DST shift moves a week boundary by an
 * hour, and a floor would occasionally count that week twice — which would show
 * the same insight for a fortnight, in the one week of the year hardest to
 * reproduce in a bug report.
 */
function weeksSinceEpoch(weekStart: string): number {
  const ms = parseLocalDate(weekStart).getTime() - parseLocalDate(EPOCH_MONDAY).getTime();
  return Math.max(0, Math.round(ms / MS_PER_WEEK));
}

/**
 * The insight to show on `dateStr`, or `null` when there is nothing real to say.
 *
 * Returns null for a brand-new account rather than inventing encouragement. An
 * empty week is the correct output of an engine that has not seen enough
 * behaviour yet, and a card that fires anyway is exactly how a user learns the
 * "insights" are generic — which poisons the paid tier the card exists to sell.
 *
 * Rotation is sequential (week N shows finding N mod count) rather than hashed,
 * so someone who opens the app every week sees each finding in turn instead of
 * the same one twice by coincidence.
 */
export function pickWeeklyInsight(
  report: GozlinHabitReport,
  dateStr: string,
): WeeklyInsight | null {
  // `dataLimited` is the engine's own admission that it is reading too little
  // behaviour to be confident. Honour it: this card is a claim about the user.
  if (report.dataLimited) return null;

  const pool = report.patterns.slice(0, MAX_ROTATION);
  if (pool.length === 0) return null;

  const weekStart = weekKeyOf(dateStr);
  const index = weeksSinceEpoch(weekStart) % pool.length;

  return { pattern: pool[index], weekStart, index, total: pool.length };
}

/**
 * The card's eyebrow. Named after the cadence rather than the content, so it
 * reads as a recurring moment the user can expect to return to — "this week"
 * implies there will be a next week, which is the whole retention idea.
 */
export const WEEKLY_INSIGHT_EYEBROW = "This week Gozlin noticed";
