/**
 * DOSE — sets × reps × rest, as data the planner can reason about.
 *
 * The exercise database writes a prescription as a string ("10-15",
 * "30 sec each leg", "8 each shape", "10 cycles"); the player reads the same
 * strings back. This module parses them into numbers, scales and steps them,
 * and writes them back in the same form, so a scaled "10-15 each side" is still
 * a prescription the player and the rest of the app already understand.
 *
 * Durations are estimated the way the PLAYER boxes a set (models/session
 * `estimateWorkSeconds`: lower bound × tempo + 4 s, rounded to 5, clamped
 * 20–120 s; a timed set is its own seconds), so a session's minutes are the
 * minutes the player will actually run — not a separate guess.
 */

import type { ExerciseCategory } from "../../models/exercise";

export interface Dose {
  sets: number;
  reps: string;
  restSeconds: number;
}

export interface ParsedReps {
  lo: number;
  /** Top of a range ("10-15" → 15); null for a single number. */
  hi: number | null;
  /** Everything after the numbers: "sec each leg", "each side", "cycles", "". */
  suffix: string;
  timed: boolean;
}

/** "10-15 each side" → { lo: 10, hi: 15, suffix: "each side", timed: false }. */
export function parseReps(reps: string): ParsedReps | null {
  const m = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*(.*?)\s*$/.exec(reps ?? "");
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = m[2] !== undefined ? Number(m[2]) : null;
  const suffix = m[3] ?? "";
  if (!Number.isFinite(lo) || lo <= 0) return null;
  return { lo, hi: hi !== null && hi > lo ? hi : null, suffix, timed: /\b(sec|min)/i.test(suffix) };
}

export function formatReps(p: ParsedReps): string {
  const nums = p.hi !== null && p.hi > p.lo ? `${p.lo}-${p.hi}` : `${p.lo}`;
  return p.suffix ? `${nums} ${p.suffix}` : nums;
}

/** Whether the count is per side/leg/direction — one "rep" is really two. */
export function isPerSide(p: ParsedReps): boolean {
  return /\beach\b/i.test(p.suffix);
}

/** The number a set is judged against: the top of a range, or the single target. */
export function topOf(p: ParsedReps): number {
  return p.hi ?? p.lo;
}

function round5(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5);
}

/**
 * Scale a prescription by `factor`, keeping its form. Rep counts round to whole
 * reps and stay a real range; timed sets round to 5 s. `cap` bounds the top.
 */
export function scaleReps(reps: string, factor: number, cap?: number): string {
  const p = parseReps(reps);
  if (!p || factor === 1) return p && cap !== undefined ? capReps(p, cap) : reps;
  if (p.timed) {
    let lo = round5(p.lo * factor);
    if (cap !== undefined) lo = Math.min(lo, cap);
    return formatReps({ ...p, lo, hi: null });
  }
  const lo = Math.max(1, Math.round(p.lo * factor));
  const hi = p.hi !== null ? Math.max(lo + 1, Math.round(p.hi * factor)) : null;
  return cap !== undefined ? capReps({ ...p, lo, hi }, cap) : formatReps({ ...p, lo, hi });
}

/** Bring the top of a prescription down to `cap`; the bottom only moves if it must. */
function capReps(p: ParsedReps, cap: number): string {
  if (topOf(p) <= cap) return formatReps(p);
  if (p.timed || p.hi === null) return formatReps({ ...p, lo: cap, hi: null });
  return formatReps({ ...p, lo: Math.min(p.lo, cap - 1), hi: cap });
}

/** Add `delta` reps (or seconds, for timed) to both ends of a prescription. */
export function shiftReps(reps: string, delta: number): string | null {
  const p = parseReps(reps);
  if (!p) return null;
  const lo = p.lo + delta;
  if (lo < 1) return null;
  return formatReps({ ...p, lo, hi: p.hi !== null ? p.hi + delta : null });
}

/** "3×10-15" / "2×30 sec" — how a dose reads in a sentence. */
export function formatDose(d: { sets: number; reps: string }): string {
  return `${d.sets}×${d.reps.replace(/(\d+)-(\d+)/, "$1–$2")}`;
}

/**
 * Seconds of one controlled rep, by category — the same tempo table the player
 * boxes sets with (models/session SECONDS_PER_REP).
 */
const SECONDS_PER_REP: Record<ExerciseCategory, number> = {
  push: 3,
  pull: 3,
  legs: 3,
  core: 2.8,
  cardio: 1.6,
  flexibility: 4,
};

/** Rest between exercises inside the player (guided-session TRANSITION). */
export const TRANSITION_SECONDS = 30;

/** How long the player boxes ONE set of this prescription. */
export function workSeconds(reps: string, category: ExerciseCategory, timedType: boolean): number {
  const p = parseReps(reps);
  const n = p?.lo ?? 10;
  if (timedType || p?.timed) return n;
  const raw = n * (SECONDS_PER_REP[category] ?? 3) + 4;
  return Math.max(20, Math.min(120, Math.round(raw / 5) * 5));
}

/** Wall-clock seconds for a whole exercise: its sets, the rests between, the hand-over. */
export function exerciseSeconds(
  dose: Dose,
  category: ExerciseCategory,
  timedType: boolean,
): number {
  const work = workSeconds(dose.reps, category, timedType);
  return dose.sets * work + Math.max(0, dose.sets - 1) * dose.restSeconds + TRANSITION_SECONDS;
}
