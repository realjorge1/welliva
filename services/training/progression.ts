/**
 * PROGRESSION — how a dose moves from one week to the next.
 *
 * Classic double progression, read from what the user logged:
 *
 *   • Completed the prescription twice running, or completed it and called it
 *     easy, or logged the top of the range on every set  →  step UP: two more
 *     reps (five more seconds on a hold).
 *   • Reps already at the emphasis's cap  →  the move is OUTGROWN: an extra set
 *     for now, and the planner looks for the next harder variant to take over.
 *   • Completed it once  →  HOLD, and say what moves it up.
 *   • Came up short twice running  →  step DOWN.
 *   • Rated recent sessions hard  →  no step-ups this week, whatever the reps.
 *
 * Each outcome carries the sentence that explains it, built from the same
 * signal that decided it. A dose with no history is a starting dose and
 * carries none — the week's reasons already explain how starting doses are set.
 */

import type { ExerciseDBEntry } from "../../constants/ExerciseDatabase";
import type { Scheme } from "./context";
import {
  formatDose,
  formatReps,
  isPerSide,
  parseReps,
  shiftReps,
  topOf,
  type Dose,
} from "./dose";
import {
  beatPrescription,
  cameUpShort,
  metPrescription,
  type EffortRead,
  type ExerciseHistory,
} from "./history";

export type DoseMove = "new" | "up" | "hold" | "down";

export interface DoseDecision {
  dose: Dose;
  move: DoseMove;
  /** Plain line explaining a move or a deliberate hold. Absent on a starting dose. */
  reason?: string;
  /** Reps (or hold) topped out — a harder variant should take this slot over. */
  outgrown: boolean;
}

const MAX_SETS = 5;

/**
 * The rep cap for this move under this scheme: per-side counts and loaded
 * moves cap lower — but never below the database's own default for the move,
 * which is already a sensible dose; a goal's cap may stop reps climbing, it
 * must not cut a starting dose.
 */
export function repCapFor(ex: ExerciseDBEntry, reps: string, scheme: Scheme): number {
  const p = parseReps(reps);
  let cap = p && isPerSide(p) ? Math.round(scheme.repCap * 0.6) : scheme.repCap;
  if (ex.equipment.length > 0) cap = Math.min(cap, 15);
  const own = parseReps(ex.defaultReps);
  return Math.max(4, cap, own && !own.timed ? topOf(own) : 0);
}

/**
 * One step up. Within a rep range the BOTTOM climbs first ("10-15" → "12-15"):
 * the player banks the bottom of the range when a set is finished untouched,
 * so completing the prescription is evidence of the bottom, not the top. Only
 * when the range has closed — or the athlete logged the top of it — does the
 * whole range move, and once it would pass the cap the move is outgrown.
 */
function stepUp(
  from: Dose,
  ex: ExerciseDBEntry,
  scheme: Scheme,
  loggedTop: boolean,
): { dose: Dose; outgrown: boolean } {
  const p = parseReps(from.reps);
  if (!p) return { dose: from, outgrown: false };
  if (p.timed) {
    const next = p.lo + 5;
    if (next <= scheme.holdCap) return { dose: { ...from, reps: formatReps({ ...p, lo: next }) }, outgrown: false };
  } else {
    const cap = repCapFor(ex, from.reps, scheme);
    if (!loggedTop && p.hi !== null && p.lo + 2 <= p.hi - 1) {
      return { dose: { ...from, reps: formatReps({ ...p, lo: p.lo + 2 }) }, outgrown: false };
    }
    if (topOf(p) + 2 <= cap) {
      const reps = shiftReps(from.reps, 2);
      if (reps) return { dose: { ...from, reps }, outgrown: false };
    }
  }
  // Topped out: one more set while a harder variant is found (and if none is).
  return {
    dose: from.sets < MAX_SETS ? { ...from, sets: from.sets + 1 } : from,
    outgrown: true,
  };
}

function stepDown(from: Dose): Dose | null {
  const p = parseReps(from.reps);
  if (!p) return null;
  if (p.timed) {
    if (p.lo - 5 >= 10) return { ...from, reps: formatReps({ ...p, lo: p.lo - 5 }) };
  } else if (p.lo - 2 >= 3) {
    const reps = shiftReps(from.reps, -2);
    if (reps) return { ...from, reps };
  }
  return from.sets > 2 ? { ...from, sets: from.sets - 1 } : null;
}

export interface DoseInput {
  ex: ExerciseDBEntry;
  /** Today's starting dose for this slot under the current scheme. */
  base: Dose;
  history?: ExerciseHistory;
  scheme: Scheme;
  /** Records before this date were logged under different dose rules — ignored. */
  carryFrom: string | null;
  effort: EffortRead;
}

export function decideDose({ ex, base, history, scheme, carryFrom, effort }: DoseInput): DoseDecision {
  const records = (history?.records ?? []).filter(
    (r) => !r.skipped && (carryFrom === null || r.date >= carryFrom),
  );
  const last = records[0];
  if (!last || !parseReps(last.targetReps)) return { dose: base, move: "new", outgrown: false };
  const prev = records[1];

  // Climb from where they actually were; rest follows today's rules.
  const from: Dose = {
    sets: Math.max(1, Math.min(MAX_SETS, Math.round(last.targetSets))),
    reps: last.targetReps,
    restSeconds: base.restSeconds,
  };
  const was = formatDose(from);
  const met = metPrescription(last);
  const hardRun = effort.counted >= 2 && effort.hard >= 2;
  const easyRun = effort.counted >= 2 && effort.easy >= 2 && effort.hard === 0;

  if (met && hardRun) {
    return {
      dose: from,
      move: "hold",
      outgrown: false,
      reason: `Held at ${was} — you rated your recent sessions hard`,
    };
  }

  let trigger: string | null = null;
  const loggedTop = beatPrescription(last);
  if (loggedTop) trigger = "you logged the top of the range on every set";
  else if (met && prev && metPrescription(prev)) trigger = "you completed it the last two times";
  else if (met && (last.effort === "easy" || easyRun)) trigger = "you completed it and it felt easy";

  if (trigger) {
    const step = stepUp(from, ex, scheme, loggedTop);
    if (step.outgrown) {
      return {
        dose: step.dose,
        move: "up",
        outgrown: true,
        reason:
          step.dose.sets > from.sets
            ? `An extra set — ${trigger}, and the reps are maxed`
            : `Maxed out at ${was} — ${trigger}`,
      };
    }
    return {
      dose: step.dose,
      move: "up",
      outgrown: false,
      reason: `Up from ${was} — ${trigger}`,
    };
  }

  if (met) {
    return {
      dose: from,
      move: "hold",
      outgrown: false,
      reason: "Same as last time — complete it once more to move up",
    };
  }

  if (cameUpShort(last)) {
    if (prev && cameUpShort(prev)) {
      const down = stepDown(from);
      if (down) {
        return {
          dose: down,
          move: "down",
          outgrown: false,
          reason: `Eased from ${was} — the last two sessions came up short`,
        };
      }
    }
    return {
      dose: from,
      move: "hold",
      outgrown: false,
      reason: "Same as last time — last session came up a little short",
    };
  }

  return { dose: from, move: "hold", outgrown: false };
}
