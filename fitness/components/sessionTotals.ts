/**
 * SESSION TOTALS — what a session added up to, counted the way a person would.
 *
 * The engine banks a HOLD's seconds in the same `repsCompleted` field as a rep
 * set's reps (a 45 s plank banks "45"), so the stored `totalReps` of a session
 * with a plank in it is reps and seconds added together. The model keeps that —
 * Gozlin's adaptive layer reads it per move — but no card may show it as reps.
 * These totals split the two: reps from rep sets, held time from holds.
 *
 * Pure, and shared by the completion card and the summary screen.
 */
import type { ExerciseSessionResult } from "@/models/session";

export interface SessionTotals {
  setsDone: number;
  setsTotal: number;
  movesDone: number;
  movesTotal: number;
  /** Reps banked on rep sets only. */
  reps: number;
  /** Seconds held on timed sets only. */
  heldSeconds: number;
}

/**
 * Add the session up. `isTimed` says whether a move is a hold; `setsTotal` and
 * `movesTotal` are the plan's (a skipped move has no result to count from).
 */
export function sessionTotals(
  results: readonly ExerciseSessionResult[],
  isTimed: (exerciseId: string) => boolean,
  plan: { setsTotal: number; movesTotal: number },
): SessionTotals {
  let setsDone = 0;
  let reps = 0;
  let heldSeconds = 0;
  const movesDone = new Set<string>();
  for (const r of results) {
    if (r.skipped) continue;
    const sets = r.setsCompleted.filter((s) => !s.skipped);
    if (sets.length > 0) movesDone.add(r.exerciseId);
    setsDone += sets.length;
    for (const s of sets) {
      if (isTimed(r.exerciseId)) heldSeconds += Math.max(0, s.durationSeconds);
      else reps += Math.max(0, s.repsCompleted);
    }
  }
  return {
    setsDone,
    setsTotal: Math.max(plan.setsTotal, setsDone),
    movesDone: movesDone.size,
    movesTotal: Math.max(plan.movesTotal, movesDone.size),
    reps,
    heldSeconds,
  };
}

/** A duration as a clock: "0:24", "32:40", "1:02:40". */
export function formatClock(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
