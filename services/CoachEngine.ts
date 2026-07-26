/**
 * COACH ENGINE
 * The "voice" of the guided session — a pure, deterministic layer that turns
 * live SessionState into contextual coaching.
 *
 * It produces two kinds of output:
 *   1. A continuous coaching LINE (getActiveCoachLine / getRestCoachLine /
 *      getCountdownLine) — the trainer talking you through the moment. The line
 *      escalates as you approach the end of a set, exercise, or session.
 *   2. Discrete MILESTONE moments (detectMilestone) — the big punchy beats
 *      ("GO", "LAST SET", "FINAL EXERCISE", set-done praise) that deserve a
 *      full-screen flash + a distinct haptic.
 *
 * Pure functions only: no timers, no storage, no UI. The GuidedSession screen
 * decides when to call these and how to present them.
 */

import { SessionExerciseInfo, SessionState, parseTargetReps } from "../models/session";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

/** Emotional register of a coaching line — drives color + iconography. */
export type CoachTone = "ready" | "cue" | "push" | "praise" | "recover";

export interface CoachLine {
  text: string;
  tone: CoachTone;
}

export type MilestoneKind =
  | "GO"
  | "NEXT_SET"
  | "LAST_SET"
  | "NEXT_EXERCISE"
  | "FINAL_EXERCISE"
  | "SET_DONE"
  | "EXERCISE_DONE";

export type CoachHaptic = "light" | "medium" | "heavy" | "success";

export interface Milestone {
  kind: MilestoneKind;
  /** Big flash headline, e.g. "LAST SET". */
  text: string;
  /** Optional small subtitle under the headline. */
  sub?: string;
  haptic: CoachHaptic;
  /** Accent role the screen maps to a color: brand | push | praise. */
  accent: "brand" | "push" | "praise";
}

// ──────────────────────────────────────────────
// Small deterministic helpers
// ──────────────────────────────────────────────

/** Pick from a list deterministically so the line is stable within a beat. */
function pick<T>(list: readonly T[], seed: number): T {
  return list[((seed % list.length) + list.length) % list.length];
}

function isLastExercise(s: SessionState): boolean {
  return s.currentExerciseIndex >= s.exercises.length - 1;
}

// ──────────────────────────────────────────────
// Countdown
// ──────────────────────────────────────────────

/** Pre-start "get ready" line. value 3 → 2 → 1, then GO is a milestone. */
export function getCountdownLine(value: number): CoachLine {
  if (value >= 3) return { text: "Stand tall. Breathe. Here we go.", tone: "ready" };
  if (value === 2) return { text: "Eyes up. Brace your core.", tone: "ready" };
  return { text: "Own this set.", tone: "ready" };
}

// ──────────────────────────────────────────────
// Active set — the continuous trainer voice
// ──────────────────────────────────────────────

const REP_OPENERS = [
  "First rep sets the tone — make it clean.",
  "Control the weight, own the tempo.",
  "Smooth and strong — settle in.",
] as const;

const REP_HALFWAY = [
  "Halfway — hold that form.",
  "Halfway there. Keep the rhythm.",
  "You're in the groove — don't slow down.",
] as const;

const REP_BONUS = [
  "Target hit — every rep now is a free gain.",
  "Past target! This is where growth happens.",
  "Bonus reps — bank them.",
] as const;

const TIMED_SETTLE = [
  "Settle into it. Steady breathing.",
  "Lock your position — own the hold.",
  "Quiet body, strong core.",
] as const;

const TIMED_MID = [
  "Halfway — stay strong.",
  "You've got this. Don't break form.",
  "Hold the line. Breathe.",
] as const;

/**
 * The live coaching line during a working set. Escalates from technique cues to
 * urgent encouragement as you near the target. `formCue` lets the screen pass
 * the exercise's own rotating cue for the early, calm phase.
 */
export function getActiveCoachLine(state: SessionState): CoachLine {
  const ex = state.exercises[state.currentExerciseIndex];
  if (!ex) return { text: "Keep moving.", tone: "push" };

  const seed = state.currentExerciseIndex + state.currentSet;
  const slowBucket = Math.floor(state.timerValue / 5); // rotate form cues calmly

  if (ex.exerciseType === "timed") {
    const target = parseTargetReps(ex.reps);
    const remaining = Math.max(0, target - state.timerValue);
    const progress = target > 0 ? state.timerValue / target : 0;

    if (remaining > 0 && remaining <= 5) {
      return { text: `${remaining} more — dig in!`, tone: "push" };
    }
    if (progress >= 0.66) {
      return { text: "Final stretch — do not quit now.", tone: "push" };
    }
    if (progress >= 0.33) {
      return { text: pick(TIMED_MID, seed), tone: "push" };
    }
    // Early: alternate the exercise's own form cue with a settle line.
    const cue = ex.coachCues.length ? pick(ex.coachCues, slowBucket) : "";
    return slowBucket % 2 === 0 && cue
      ? { text: cue, tone: "cue" }
      : { text: pick(TIMED_SETTLE, seed), tone: "cue" };
  }

  // Rep-based
  const target = parseTargetReps(ex.reps);
  const count = state.currentReps;
  const remaining = target - count;

  if (count === 0) {
    return { text: pick(REP_OPENERS, seed), tone: "ready" };
  }
  if (remaining <= 0) {
    return { text: pick(REP_BONUS, seed), tone: "praise" };
  }
  if (remaining <= 2) {
    return {
      text: remaining === 1 ? "Last one — make it count!" : "Two to go — finish strong!",
      tone: "push",
    };
  }
  if (count / target >= 0.5) {
    return { text: pick(REP_HALFWAY, seed), tone: "push" };
  }
  // Early reps: keep coaching technique using the exercise's own cues.
  const cue = ex.coachCues.length ? pick(ex.coachCues, slowBucket) : "Strong reps — keep going.";
  return { text: cue, tone: "cue" };
}

// ──────────────────────────────────────────────
// Rest & transition — recovery and the next-up brief
// ──────────────────────────────────────────────

export function getRestCoachLine(
  isTransition: boolean,
  timeRemaining: number,
  nextSet: number,
  totalSets: number,
  nextExercise?: SessionExerciseInfo,
): CoachLine {
  if (isTransition) {
    const name = nextExercise?.name ?? "the next move";
    if (timeRemaining <= 5) return { text: `Get set — ${name} coming up!`, tone: "push" };
    if (timeRemaining <= 12) return { text: `Up next: ${name}. Find your position.`, tone: "ready" };
    return { text: "Shake it out. Loosen up. Reset your breathing.", tone: "recover" };
  }

  if (timeRemaining <= 5) return { text: `Back to work — Set ${nextSet} now!`, tone: "push" };
  if (timeRemaining <= 12) return { text: "Almost time. Breathe deep, reset.", tone: "ready" };
  return {
    text: `Strong set. Recover — Set ${nextSet} of ${totalSets} is next.`,
    tone: "recover",
  };
}

// ──────────────────────────────────────────────
// Milestones — the big punchy beats
// ──────────────────────────────────────────────

/**
 * Compare the previous and next session states and surface a milestone worth a
 * full-screen flash + haptic. Returns null for ordinary ticks (e.g. a rep tap
 * or a quiet second of rest).
 */
export function detectMilestone(prev: SessionState, next: SessionState): Milestone | null {
  if (prev.phase === next.phase && prev.currentExerciseIndex === next.currentExerciseIndex) {
    // No structural change worth a flash (rep counts handled by the live line).
    return null;
  }

  // Entering a working set.
  if (next.phase === "ACTIVE_SET" && prev.phase !== "ACTIVE_SET") {
    const ex = next.exercises[next.currentExerciseIndex];
    const totalSets = ex?.sets ?? 1;

    // First set of the whole session — the big GO.
    if (prev.phase === "COUNTDOWN") {
      return {
        kind: "GO",
        text: "GO!",
        sub: ex ? ex.name : undefined,
        haptic: "heavy",
        accent: "brand",
      };
    }

    // Final set of an exercise that has more than one set.
    if (next.currentSet >= totalSets && totalSets > 1 && prev.phase === "REST") {
      return {
        kind: "LAST_SET",
        text: "LAST SET",
        sub: "Empty the tank",
        haptic: "heavy",
        accent: "push",
      };
    }

    // Arriving at a new exercise (post-transition).
    if (prev.phase === "TRANSITION") {
      if (isLastExercise(next)) {
        return {
          kind: "FINAL_EXERCISE",
          text: "FINAL EXERCISE",
          sub: ex ? ex.name : "Leave it all here",
          haptic: "heavy",
          accent: "push",
        };
      }
      return {
        kind: "NEXT_EXERCISE",
        text: "GO!",
        sub: ex ? ex.name : undefined,
        haptic: "medium",
        accent: "brand",
      };
    }

    // Ordinary next set.
    return {
      kind: "NEXT_SET",
      text: `SET ${next.currentSet}`,
      sub: "Here we go",
      haptic: "medium",
      accent: "brand",
    };
  }

  // Leaving a working set → a set was just completed.
  if (prev.phase === "ACTIVE_SET" && next.phase === "REST") {
    return {
      kind: "SET_DONE",
      text: pick(["NICE!", "STRONG!", "THAT'S IT!"], prev.currentSet),
      sub: "Set complete",
      haptic: "success",
      accent: "praise",
    };
  }
  if (prev.phase === "ACTIVE_SET" && next.phase === "TRANSITION") {
    return {
      kind: "EXERCISE_DONE",
      text: "DONE!",
      sub: "Exercise complete",
      haptic: "success",
      accent: "praise",
    };
  }

  return null;
}

// ──────────────────────────────────────────────
// Summary sign-off — the coach's closing words
// ──────────────────────────────────────────────

export interface CoachSignoff {
  message: string;
}

/** Personalized closing line for the summary, scaled to completion. */
export function getSummarySignoff(completionPercent: number, skipped: number): CoachSignoff {
  if (completionPercent >= 100) {
    return { message: "Flawless — you finished everything I put in front of you. That's a champion's session." };
  }
  if (completionPercent >= 80) {
    return {
      message:
        skipped > 0
          ? "You pushed through almost all of it. Strong work — next time we close out that last bit together."
          : "You left nothing on the table. This is exactly how real progress gets built.",
    };
  }
  if (completionPercent >= 50) {
    return { message: "Solid effort. You showed up and did the work — momentum beats perfection every time." };
  }
  return { message: "Every session counts, and you started. That's the hardest rep. Come back tomorrow and we go again." };
}
