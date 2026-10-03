/**
 * TRAINING HISTORY — what the user actually did, read per exercise.
 *
 * Only PROGRAMMED work counts toward progression: sessions from the plan
 * (planned or chosen days). A library workout run on a whim is real exercise
 * and counts as "done lately", but its sets and reps were the library's, not a
 * prescription the user was working up, so it never moves a dose. Warm-up and
 * cool-down items (one set) are ignored for the same reason.
 *
 * Remember how the player records reps: a finished rep set banks its TARGET
 * (the low end of the range) unless the athlete corrects it on the rest screen.
 * So "met the prescription" is the everyday signal, and a set logged at the TOP
 * of the range is the athlete telling us, unprompted, that it was too easy.
 */

import type { SessionEffort, SessionSummaryData, SetResult } from "../../models/session";
import { parseReps, topOf } from "./dose";

/** How far back a prescription is still a starting point to climb from. */
export const CARRY_DAYS = 42;
/** How far back skips count toward "avoided". */
const AVOID_WINDOW_DAYS = 28;

export interface ExerciseRecord {
  date: string;
  sessionId: string;
  targetSets: number;
  targetReps: string;
  done: SetResult[];
  skipped: boolean;
  effort?: SessionEffort;
}

export interface ExerciseHistory {
  exerciseId: string;
  name: string;
  /** Programmed records within CARRY_DAYS, newest first. */
  records: ExerciseRecord[];
  /** Most recent day it was actually done, in any session. */
  lastDone: string | null;
  /** Programmed appearances / skips within AVOID_WINDOW_DAYS. */
  programmed: number;
  skipped: number;
}

/** Plan sessions (planned or chosen days) — not ad-hoc library or single runs. */
export function isProgrammedSession(sessionId: string): boolean {
  return !sessionId.startsWith("lib_") && sessionId !== "single";
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86_400_000);
}

/** Whole days from `date` to `today` (positive = in the past). */
export function daysAgo(date: string, today: string): number {
  return daysBetween(date, today);
}

function byNewest(a: SessionSummaryData, b: SessionSummaryData): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (a.completedAt ?? "") < (b.completedAt ?? "") ? 1 : -1;
}

export function readHistory(
  sessions: SessionSummaryData[],
  today: string,
): Map<string, ExerciseHistory> {
  const out = new Map<string, ExerciseHistory>();
  const sorted = sessions
    .filter((s) => typeof s.date === "string" && s.date <= today)
    .slice()
    .sort(byNewest);

  for (const s of sorted) {
    const age = daysAgo(s.date, today);
    const programmed = isProgrammedSession(s.workoutSessionId ?? "");
    for (const r of s.exerciseResults ?? []) {
      let h = out.get(r.exerciseId);
      if (!h) {
        h = { exerciseId: r.exerciseId, name: r.exerciseName, records: [], lastDone: null, programmed: 0, skipped: 0 };
        out.set(r.exerciseId, h);
      }
      if (!r.skipped && h.lastDone === null) h.lastDone = s.date;
      // One-set items are warm-ups and cool-downs: never progressed, never "avoided".
      if (!programmed || r.targetSets < 2) continue;
      if (age <= AVOID_WINDOW_DAYS) {
        h.programmed += 1;
        if (r.skipped) h.skipped += 1;
      }
      if (age <= CARRY_DAYS) {
        h.records.push({
          date: s.date,
          sessionId: s.workoutSessionId,
          targetSets: r.targetSets,
          targetReps: r.targetReps,
          done: (r.setsCompleted ?? []).filter((set) => !set.skipped),
          skipped: r.skipped,
          effort: s.effort,
        });
      }
    }
  }
  return out;
}

/** Skipped in at least half of the (2+) sessions it was programmed in. */
export function isAvoided(h: ExerciseHistory | undefined): boolean {
  return !!h && h.programmed >= 2 && h.skipped / h.programmed >= 0.5;
}

/** Every prescribed set done, each at or above the target the player banks. */
export function metPrescription(r: ExerciseRecord): boolean {
  if (r.skipped || r.done.length < r.targetSets) return false;
  const p = parseReps(r.targetReps);
  if (!p) return false;
  if (p.timed) return true; // a timed set ends when its clock does
  return r.done.every((set) => set.repsCompleted >= p.lo);
}

/** Met it AND logged the top of the range on every set — "this was easy". */
export function beatPrescription(r: ExerciseRecord): boolean {
  if (!metPrescription(r)) return false;
  const p = parseReps(r.targetReps);
  if (!p || p.timed || p.hi === null) return false;
  return r.done.every((set) => set.repsCompleted >= topOf(p));
}

/** Fewer than 70% of the sets, or below the bottom of the range on average. */
export function cameUpShort(r: ExerciseRecord): boolean {
  if (r.skipped) return false;
  if (r.done.length < Math.ceil(r.targetSets * 0.7)) return true;
  const p = parseReps(r.targetReps);
  if (!p || p.timed || r.done.length === 0) return false;
  const avg = r.done.reduce((sum, set) => sum + set.repsCompleted, 0) / r.done.length;
  return avg < p.lo;
}

export interface EffortRead {
  hard: number;
  easy: number;
  /** Programmed sessions answered, of the last three within three weeks. */
  counted: number;
}

/** How the last three programmed sessions felt (the completion screen's question). */
export function recentEffort(sessions: SessionSummaryData[], today: string): EffortRead {
  const recent = sessions
    .filter(
      (s) =>
        s.effort &&
        isProgrammedSession(s.workoutSessionId ?? "") &&
        s.date <= today &&
        daysAgo(s.date, today) <= 21,
    )
    .slice()
    .sort(byNewest)
    .slice(0, 3);
  return {
    hard: recent.filter((s) => s.effort === "hard").length,
    easy: recent.filter((s) => s.effort === "easy").length,
    counted: recent.length,
  };
}
