/**
 * DAY PROVENANCE — how much of today's total was actually measured.
 *
 * Every food entry already carries a `NutrientConfidence` (models/nutrients.ts),
 * and a meal is labelled by its WEAKEST ingredient — the right rule for one
 * meal, because a plate is only as certain as the least certain thing on it.
 *
 * That rule is wrong for a DAY. Applied to a whole day it collapses everything
 * into its worst moment: one AI-estimated jollof at dinner relabels 2,000
 * carefully-measured calories as "AI estimate", which is both discouraging and
 * false. Nobody would then trust the label, which defeats its purpose.
 *
 * So a day is reported as a SHARE, weighted by calories: "1,840 kcal — 86%
 * measured". Weighted by calories rather than by entry count on purpose — three
 * measured black coffees and one estimated stew is not 75% measured in any
 * sense a person cares about, because the stew is nearly all the energy.
 *
 * WHY THIS SHIPS AT ALL. No competitor tells you which of their numbers are
 * guesses. MyFitnessPal's crowd-sourced entries and Noom's estimates are shown
 * with exactly the same authority as a lab-measured figure. Welliva already
 * tracks the difference for its own correctness; surfacing it costs almost
 * nothing and is the honest version of a number everyone else fakes.
 */

import {
  CONFIDENCE_RANK,
  type NutrientConfidence,
} from "../../models/nutrients";
import type { FoodLogEntry } from "./FoodLogService";

/**
 * Confidence rungs at or below this rank count as MEASURED for the share.
 *
 * `portion-estimated` counts as measured, and that is a deliberate line rather
 * than a fudge: the food itself was matched to a reference table and only the
 * serving size was assumed. The nutrition is real; the amount is approximate,
 * which is a different and much smaller claim than "we made these numbers up".
 * `recipe-estimated` and below do NOT count — there, the figures themselves are
 * derived rather than read.
 */
const MEASURED_MAX_RANK = CONFIDENCE_RANK["portion-estimated"];

export function isMeasured(confidence: NutrientConfidence): boolean {
  return CONFIDENCE_RANK[confidence] <= MEASURED_MAX_RANK;
}

export interface DayProvenance {
  /** Calories from entries whose figures were read, not derived. */
  measuredCalories: number;
  /** Calories from recipe-estimated, macros-only or AI-estimated entries. */
  estimatedCalories: number;
  /** Calories the app could not attribute at all (unmatched foods). */
  unknownCalories: number;
  /** Total logged calories — the denominator the UI already displays. */
  totalCalories: number;
  /**
   * 0–100, rounded. The headline figure. Null when nothing is logged yet:
   * "0% measured" on an empty day is a false accusation, not information.
   */
  measuredPercent: number | null;
  /** How many entries carry figures weaker than measured. */
  estimatedEntries: number;
}

const EMPTY: DayProvenance = {
  measuredCalories: 0,
  estimatedCalories: 0,
  unknownCalories: 0,
  totalCalories: 0,
  measuredPercent: null,
  estimatedEntries: 0,
};

/**
 * Compute the measured share of a day's logged energy.
 *
 * Entries with no calorie figure at all (an unmatched food) are counted in
 * `unknownCalories` as zero energy but still lower the entry count's honesty —
 * they cannot be weighted by calories they don't have, so they are reported
 * separately rather than silently improving the percentage.
 */
export function dayProvenance(entries: FoodLogEntry[]): DayProvenance {
  if (entries.length === 0) return EMPTY;

  let measured = 0;
  let estimated = 0;
  let unknown = 0;
  let estimatedEntries = 0;

  for (const e of entries) {
    const kcal = e.totals?.calories ?? 0;
    if (e.confidence === "unmatched") {
      unknown += kcal;
      estimatedEntries++;
      continue;
    }
    if (isMeasured(e.confidence)) {
      measured += kcal;
    } else {
      estimated += kcal;
      estimatedEntries++;
    }
  }

  const total = measured + estimated + unknown;
  return {
    measuredCalories: Math.round(measured),
    estimatedCalories: Math.round(estimated),
    unknownCalories: Math.round(unknown),
    totalCalories: Math.round(total),
    measuredPercent: total > 0 ? Math.round((measured / total) * 100) : null,
    estimatedEntries,
  };
}

/**
 * The one-line summary shown under the daily total.
 *
 * Silent at 100%: a day that is entirely measured needs no caveat, and printing
 * "100% measured" every single day would train people to stop reading the line
 * on the days it matters. The label earns attention by being rare.
 */
export function provenanceLine(p: DayProvenance): string | null {
  if (p.measuredPercent == null) return null;
  if (p.measuredPercent >= 100) return null;
  return `${p.measuredPercent}% measured`;
}

/** Longer explanation for the detail sheet. Plain, never apologetic. */
export function provenanceDetail(p: DayProvenance): string | null {
  if (p.measuredPercent == null || p.measuredPercent >= 100) return null;
  const n = p.estimatedEntries;
  const items = n === 1 ? "one item" : `${n} items`;
  return (
    `${items} today came from an estimate rather than a food composition table. ` +
    `Those figures are a reasonable ballpark, not a measurement.`
  );
}
