/**
 * services/cycle/signs.ts — two body signs she can note, read against her
 * estimated ovulation (owner-approved 2026-11-13):
 *
 *   mid-cycle twinge — a one-sided ache around the middle of the cycle,
 *                      offered to everyone. Explained, with the safety line
 *                      beside it every time.
 *   discharge        — fertile-window users only. A CHECK on the ovulation
 *                      estimate, never an input to it: nothing here moves a
 *                      date. It only says whether her signs line up.
 *
 * Both patterns follow the standard (./patterns): completed cycles only, at
 * least two before anything is called a pattern, the denominator is the
 * cycles she logged the sign in, and a pattern is a timing, not a cause.
 */

import { addDays, daysBetween } from "./dates";
import { ovulationFor, type CycleMode, type CycleRecord, type Prediction } from "./predict";
import { patternCycles, type CyclePattern } from "./patterns";
import type { CycleDayLog, CycleDays } from "./types";

/* ───────────────────────────── mid-cycle twinge ───────────────────────────── */

/** A twinge this close to the estimated ovulation is "around ovulation". */
export const TWINGE_NEAR_OVULATION_DAYS = 2;
/** Cycles that showed it before it's called a pattern. */
export const SIGN_MIN_CYCLES = 2;

export const TWINGE_CALM_LINE =
  "A twinge on one side around the middle of the cycle is common. It's often ovulation.";
export const TWINGE_SAFETY_LINE =
  "Pain that's sudden or severe, or comes with fever or fainting, needs seeing someone today.";

/**
 * The day sheet's lines under a ticked "Mid-cycle twinge": the calm one when
 * the day sits within TWINGE_NEAR_OVULATION_DAYS of that cycle's estimated
 * ovulation (only where ovulation is estimated: normal and postpartum), and
 * the safety line every time the twinge is ticked. No date is named, so it is
 * the same with the fertile window off.
 */
export function twingeLines(input: {
  date: string;
  log: CycleDayLog | undefined;
  mode: CycleMode;
  prediction: Prediction | null;
  cycles: readonly CycleRecord[];
}): string[] {
  if (!input.log?.symptoms?.includes("mid_cycle_pain")) return [];
  const out: string[] = [];
  if (input.mode === "normal" || input.mode === "postpartum") {
    const o = ovulationFor(input.date, input.prediction, input.cycles);
    if (o && Math.abs(daysBetween(o, input.date)) <= TWINGE_NEAR_OVULATION_DAYS) out.push(TWINGE_CALM_LINE);
  }
  out.push(TWINGE_SAFETY_LINE);
  return out;
}

/** "3 of your last 4 cycles", or the cycles she logged it in when that's fewer. */
function scope(hits: number, observed: number, pool: number, what: string): string {
  return observed === pool ? `${hits} of your last ${observed} cycles` : `${hits} of the ${observed} recent cycles you logged ${what} in`;
}

function datesOf(c: CycleRecord): string[] {
  return Array.from({ length: c.length }, (_, i) => addDays(c.start, i));
}

/**
 * Does her twinge come around the middle of her cycle? In completed cycles
 * where she logged one, it fell within TWINGE_NEAR_OVULATION_DAYS of the
 * estimated ovulation (the next start less the luteal length the prediction
 * uses) in SIGN_MIN_CYCLES or more.
 */
export function twingePattern(
  cycles: readonly CycleRecord[],
  days: CycleDays,
  lutealDays: number,
  showFertile: boolean,
): CyclePattern | null {
  const pool = patternCycles(cycles);
  let observed = 0;
  let hits = 0;
  for (const c of pool) {
    const twinges = datesOf(c).filter((d) => !!days[d]?.symptoms?.includes("mid_cycle_pain"));
    if (!twinges.length) continue;
    observed += 1;
    const o = addDays(c.nextStart, -lutealDays);
    if (twinges.some((d) => Math.abs(daysBetween(o, d)) <= TWINGE_NEAR_OVULATION_DAYS)) hits += 1;
  }
  if (observed < SIGN_MIN_CYCLES || hits < SIGN_MIN_CYCLES) return null;
  const where = showFertile
    ? `within ${TWINGE_NEAR_OVULATION_DAYS} days of your estimated ovulation`
    : "around the middle of your cycle";
  const s = scope(hits, observed, pool.length, "one");
  return {
    id: "signs:twinge",
    kind: "signs",
    icon: "flash-outline",
    title: "Mid-cycle twinges",
    body: `Your mid-cycle twinges came ${where} in ${s}.`,
    scope: s,
    hits,
    observed,
  };
}

/* ───────────────────────────── discharge ───────────────────────────── */

/** Clear, stretchy days usually come in the days before ovulation: this many. */
export const STRETCHY_BEFORE_OVULATION_DAYS = 5;
/** ...and the last of them can land the day after, as an estimate's own slack. */
const STRETCHY_SLACK_DAYS = 1;

/**
 * Do her clear, stretchy days line up with the ovulation estimate? Read only
 * with the fertile window on, from completed cycles where she logged them.
 * Each cycle is judged by its LAST clear, stretchy day (the peak sign).
 * Said either way, honestly — and it never moves a date.
 */
export function dischargePattern(
  cycles: readonly CycleRecord[],
  days: CycleDays,
  lutealDays: number,
): CyclePattern | null {
  const pool = patternCycles(cycles);
  let observed = 0;
  let aligned = 0;
  let later = 0;
  let earlier = 0;
  for (const c of pool) {
    const stretchy = datesOf(c).filter((d) => days[d]?.discharge === "clear_stretchy");
    if (!stretchy.length) continue;
    observed += 1;
    const o = addDays(c.nextStart, -lutealDays);
    const peak = daysBetween(o, stretchy[stretchy.length - 1]);
    if (peak > STRETCHY_SLACK_DAYS) later += 1;
    else if (peak < -STRETCHY_BEFORE_OVULATION_DAYS) earlier += 1;
    else aligned += 1;
  }
  if (observed < SIGN_MIN_CYCLES) return null;
  const base = { id: "signs:discharge", kind: "signs" as const, icon: "water-outline", title: "Clear, stretchy days", observed };
  if (aligned >= SIGN_MIN_CYCLES && aligned * 2 >= observed) {
    const s = scope(aligned, observed, pool.length, "them");
    return {
      ...base,
      body: `Your clear, stretchy days came in the ${STRETCHY_BEFORE_OVULATION_DAYS} days before your estimated ovulation in ${s}.`,
      scope: s,
      hits: aligned,
    };
  }
  for (const [n, way] of [
    [later, "later"],
    [earlier, "earlier"],
  ] as const) {
    if (n >= SIGN_MIN_CYCLES) {
      const s = `${n} of ${observed} cycles`;
      return {
        ...base,
        body: `Your clear, stretchy days came ${way} than my estimate in ${s}. An ovulation test would tell us more.`,
        scope: s,
        hits: n,
      };
    }
  }
  return null;
}
