/**
 * GOZLIN — Adaptive Workout Intelligence (Phase 5).
 *
 * The Sports-Scientist brain. It reads what actually happened in training —
 * completed vs skipped sessions, per-set reps, recovery and training density —
 * and decides how the program should change: progress volume/intensity, pull
 * back, modify rest, replace an exercise the user keeps avoiding, or call a
 * recovery day. Every decision is explained and carries the evidence behind it.
 *
 * Two layers:
 *   1. analyzeExercisePerformance — turns SessionSummaryData history into a
 *      per-exercise performance trend (the read).
 *   2. buildWorkoutAdaptations    — the decision engine: rules over those trends
 *      + recovery → ranked, explained adaptations (the write).
 *
 * applyWorkoutAdaptation(s) turns an adaptation into a concrete, mutated plan so
 * the capability is real — not just advice. Pure & deterministic throughout
 * (inject `now` for tests); composes the existing Twin + RecoveryEngine and the
 * deterministic ExerciseDatabase. It introduces no new scoring of recovery —
 * that stays in GozlinRecoveryEngine.
 */

import {
  EXERCISE_DATABASE,
  type ExerciseDBEntry,
} from "../../constants/ExerciseDatabase";
import type { Difficulty } from "../../models/exercise";
import { isTimedReps, parseTargetReps } from "../../models/session";
import type { SessionSummaryData } from "../../models/session";
import type {
  GeneratedWorkoutPlan,
  PlannedExercise,
  WorkoutLogEntry,
} from "../../models/workout";
import { parseLocalDate, toLocalDateString } from "../OfflineStorage";
import type {
  ExercisePerformanceTrend,
  GozlinTwin,
  GozlinWorkoutAdaptation,
  PerformanceDirection,
  WorkoutAdaptation,
} from "./gozlin.types";

// ── Tunables ────────────────────────────────────────────────────────
const WINDOW_DAYS = 28; // how far back we read training
const MIN_SESSIONS = 2; // below this an exercise is "new" (can't judge)
const PROGRESS_HEADROOM = 0.15; // beating reps by ≥15% → room to progress
const INTENSITY_HEADROOM = 0.35; // crushing it → step up difficulty, not just reps
const DECLINE_COMPLETION = 0.7; // finishing <70% of sets → slipping
const AVOID_SKIP_RATE = 0.5; // skipped in ≥half of programmed sessions → avoided
const VOLUME_STEP = 0.1; // the canonical +10% progression

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

const DB_BY_ID = new Map<string, ExerciseDBEntry>(
  EXERCISE_DATABASE.map((e) => [e.id, e]),
);

const DIFF_ORDER: Difficulty[] = ["beginner", "intermediate", "advanced"];

/** Extract a database id from a modification string like "Incline Push-ups (push_02)". */
function resolveModId(s?: string): string | null {
  if (!s) return null;
  const m = s.match(/\(([a-z]+_\d+)\)/i);
  if (m && DB_BY_ID.has(m[1])) return m[1];
  // Fall back: maybe the whole string is already an id.
  return DB_BY_ID.has(s) ? s : null;
}

// ════════════════════════════════════════════════════════════════════
// 1. PERFORMANCE READ
// ════════════════════════════════════════════════════════════════════

export interface WorkoutAdaptationInput {
  twin: GozlinTwin;
  sessionHistory: SessionSummaryData[];
  workoutLog: WorkoutLogEntry[];
  plan: GeneratedWorkoutPlan | null;
  difficulty: Difficulty;
  weeklyWorkoutTarget: number;
  now?: Date;
}

function sessionsInWindow(
  history: SessionSummaryData[],
  today: string,
): SessionSummaryData[] {
  const end = parseLocalDate(today);
  const cutoff = new Date(end);
  cutoff.setDate(end.getDate() - WINDOW_DAYS);
  return history.filter((s) => {
    const d = parseLocalDate(s.date);
    return d >= cutoff && d <= end;
  });
}

function classifyDirection(t: {
  sessions: number;
  skipRate: number;
  completionRate: number;
  headroom: number;
  repsBased: boolean;
}): PerformanceDirection {
  if (t.sessions >= MIN_SESSIONS && t.skipRate >= AVOID_SKIP_RATE) return "avoided";
  if (t.sessions < MIN_SESSIONS) return "new";
  if (t.completionRate < DECLINE_COMPLETION || t.headroom <= -0.2) return "declining";
  if (t.repsBased) {
    if (t.headroom >= PROGRESS_HEADROOM && t.completionRate >= 0.9) return "improving";
  } else if (t.completionRate >= 0.95) {
    return "improving"; // timed work finished in full, every set
  }
  return "steady";
}

/**
 * Roll the windowed session history up into one performance trend per exercise.
 * Reads only the recorded results — no DB lookup needed — so it's honest about
 * what was actually trained.
 */
export function analyzeExercisePerformance(
  input: WorkoutAdaptationInput,
): ExercisePerformanceTrend[] {
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);
  const windowed = sessionsInWindow(input.sessionHistory, today);

  interface Acc {
    name: string;
    sessions: number;
    skipped: number;
    repsSamples: number[];
    setsCompleted: number;
    setsPrescribed: number;
    targetReps: number;
    repsBased: boolean;
  }
  const byId = new Map<string, Acc>();

  for (const summary of windowed) {
    for (const r of summary.exerciseResults) {
      const acc =
        byId.get(r.exerciseId) ??
        ({
          name: r.exerciseName,
          sessions: 0,
          skipped: 0,
          repsSamples: [],
          setsCompleted: 0,
          setsPrescribed: 0,
          targetReps: parseTargetReps(r.targetReps),
          repsBased: !isTimedReps(r.targetReps),
        } satisfies Acc);

      acc.sessions += 1;
      acc.setsPrescribed += r.targetSets;
      if (r.skipped) {
        acc.skipped += 1;
      } else {
        acc.setsCompleted += r.setsCompleted.length;
        if (acc.repsBased) {
          for (const set of r.setsCompleted) {
            if (!set.skipped) acc.repsSamples.push(set.repsCompleted);
          }
        }
      }
      byId.set(r.exerciseId, acc);
    }
  }

  const trends: ExercisePerformanceTrend[] = [];
  for (const [exerciseId, a] of byId) {
    const avgRepsPerSet = a.repsBased ? Math.round(mean(a.repsSamples)) : 0;
    const completionRate =
      a.setsPrescribed > 0 ? clamp(a.setsCompleted / a.setsPrescribed, 0, 1) : 0;
    const skipRate = a.sessions > 0 ? a.skipped / a.sessions : 0;
    const headroom =
      a.repsBased && a.targetReps > 0
        ? clamp((avgRepsPerSet - a.targetReps) / a.targetReps, -1, 1)
        : 0;
    const direction = classifyDirection({
      sessions: a.sessions,
      skipRate,
      completionRate,
      headroom,
      repsBased: a.repsBased,
    });

    trends.push({
      exerciseId,
      exerciseName: a.name,
      sessions: a.sessions,
      avgRepsPerSet,
      targetReps: a.targetReps,
      completionRate: Math.round(completionRate * 100) / 100,
      skipRate: Math.round(skipRate * 100) / 100,
      headroom: Math.round(headroom * 100) / 100,
      direction,
      repsBased: a.repsBased,
    });
  }

  // Most-trained first — those carry the most signal.
  trends.sort((x, y) => y.sessions - x.sessions);
  return trends;
}

// ════════════════════════════════════════════════════════════════════
// 2. REPLACEMENT FINDER
// ════════════════════════════════════════════════════════════════════

/**
 * Find a same-pattern alternative one step easier than `entry`. Prefers the
 * authored `modifications.easier`, then scans the DB for a lower-difficulty
 * movement-pattern match that needs no more equipment than the original.
 */
function findEasierAlternative(entry: ExerciseDBEntry): ExerciseDBEntry | null {
  const authored = resolveModId(entry.modifications?.easier);
  if (authored && authored !== entry.id) return DB_BY_ID.get(authored) ?? null;

  const maxDiff = DIFF_ORDER.indexOf(entry.difficulty);
  const candidates = EXERCISE_DATABASE.filter(
    (e) =>
      e.id !== entry.id &&
      e.movementPattern === entry.movementPattern &&
      DIFF_ORDER.indexOf(e.difficulty) <= maxDiff &&
      e.equipment.every((eq) => entry.equipment.includes(eq)),
  ).sort(
    (a, b) =>
      DIFF_ORDER.indexOf(a.difficulty) - DIFF_ORDER.indexOf(b.difficulty) ||
      a.id.localeCompare(b.id),
  );
  return candidates[0] ?? null;
}

/** Find a harder same-pattern progression for an exercise that's been mastered. */
function findHarderAlternative(entry: ExerciseDBEntry): ExerciseDBEntry | null {
  const authored = resolveModId(entry.modifications?.harder);
  if (authored && authored !== entry.id) return DB_BY_ID.get(authored) ?? null;

  const minDiff = DIFF_ORDER.indexOf(entry.difficulty);
  const candidates = EXERCISE_DATABASE.filter(
    (e) =>
      e.id !== entry.id &&
      e.movementPattern === entry.movementPattern &&
      DIFF_ORDER.indexOf(e.difficulty) >= minDiff &&
      e.equipment.every((eq) => entry.equipment.includes(eq)),
  ).sort(
    (a, b) =>
      DIFF_ORDER.indexOf(b.difficulty) - DIFF_ORDER.indexOf(a.difficulty) ||
      a.id.localeCompare(b.id),
  );
  return candidates[0] ?? null;
}

// ════════════════════════════════════════════════════════════════════
// 3. DECISION ENGINE
// ════════════════════════════════════════════════════════════════════

/** Plan exercises currently programmed, deduped by id (with current params). */
function planExerciseIndex(
  plan: GeneratedWorkoutPlan | null,
): Map<string, PlannedExercise> {
  const idx = new Map<string, PlannedExercise>();
  if (!plan) return idx;
  for (const session of plan.sessions) {
    for (const ex of session.exercises) {
      if (!idx.has(ex.exerciseId)) idx.set(ex.exerciseId, ex);
    }
  }
  return idx;
}

export function buildWorkoutAdaptations(
  input: WorkoutAdaptationInput,
): GozlinWorkoutAdaptation {
  const { twin, plan } = input;
  const trends = analyzeExercisePerformance(input);
  const programmed = planExerciseIndex(plan);
  const windowed = sessionsInWindow(
    input.sessionHistory,
    toLocalDateString(input.now ?? new Date()),
  );
  const dataLimited = windowed.length < MIN_SESSIONS;

  const adaptations: WorkoutAdaptation[] = [];
  const recovery = twin.recovery;

  // ── Rule 0: recovery leads. A fried athlete doesn't get a volume bump. ──
  const recoveryFirst = recovery.level === "red";
  if (recoveryFirst) {
    adaptations.push({
      kind: "recommend_recovery",
      icon: "bed-outline",
      exerciseId: null,
      exerciseName: null,
      title: "Take a recovery day",
      explanation: `Your recovery is in the red (${recovery.score}/100). ${recovery.recommendation} Progress is built on recovered tissue — pushing now just digs the hole deeper.`,
      evidence: recovery.drivers,
      change: {},
      priority: 0.97,
      tone: "gentle",
    });
  }

  // ── Per-exercise rules (only for exercises still in the plan) ──
  for (const t of trends) {
    const current = programmed.get(t.exerciseId);
    if (!current) continue; // not programmed anymore — nothing to adapt
    const dbEntry = DB_BY_ID.get(t.exerciseId);

    // A) Avoided → replace with something they'll actually do.
    if (t.direction === "avoided") {
      const alt = dbEntry ? findEasierAlternative(dbEntry) : null;
      adaptations.push({
        kind: "replace_exercise",
        icon: "swap-horizontal",
        exerciseId: t.exerciseId,
        exerciseName: t.exerciseName,
        title: alt
          ? `Swap ${t.exerciseName} → ${alt.name}`
          : `Rethink ${t.exerciseName}`,
        explanation: alt
          ? `You've skipped ${t.exerciseName} in ${Math.round(t.skipRate * 100)}% of sessions it was programmed. A plan you skip isn't a plan — let's swap in ${alt.name}, a ${t.exerciseName.toLowerCase()} alternative you're more likely to finish.`
          : `${t.exerciseName} keeps getting skipped. Worth asking whether it fits your setup — I can find an alternative if you want one.`,
        evidence: [
          `skipped in ${Math.round(t.skipRate * 100)}% of ${t.sessions} sessions`,
        ],
        change: alt
          ? { replacementId: alt.id, replacementName: alt.name }
          : {},
        priority: 0.82,
        tone: "honest",
      });
      continue;
    }

    if (recoveryFirst) continue; // don't stack progressions on a red day

    // B) Improving → progress. Crushing it → harder variant; else +10% volume.
    if (t.direction === "improving") {
      const hard = dbEntry ? findHarderAlternative(dbEntry) : null;
      if (t.repsBased && t.headroom >= INTENSITY_HEADROOM && hard) {
        adaptations.push({
          kind: "increase_intensity",
          icon: "flame",
          exerciseId: t.exerciseId,
          exerciseName: t.exerciseName,
          title: `Progress ${t.exerciseName} → ${hard.name}`,
          explanation: `${t.exerciseName} has stopped challenging you — you're averaging ${t.avgRepsPerSet} reps against a ${t.targetReps} target. Time to graduate to ${hard.name} and keep the stimulus honest.`,
          evidence: [
            `${t.avgRepsPerSet} avg reps vs ${t.targetReps} target`,
            `${Math.round(t.completionRate * 100)}% sets completed`,
          ],
          change: {
            replacementId: hard.id,
            replacementName: hard.name,
            difficultyShift: "harder",
          },
          priority: 0.74,
          tone: "proud",
        });
      } else {
        const pct = Math.round(VOLUME_STEP * 100);
        adaptations.push({
          kind: "increase_volume",
          icon: "trending-up",
          exerciseId: t.exerciseId,
          exerciseName: t.exerciseName,
          title: `Increase ${t.exerciseName} volume by ${pct}%`,
          explanation: t.repsBased
            ? `I noticed ${t.exerciseName} is becoming easier — you're averaging ${t.avgRepsPerSet} reps against a ${t.targetReps} target. Increasing volume by ${pct}% to keep you progressing.`
            : `You're completing every set of ${t.exerciseName} cleanly. Nudging volume up ${pct}% to keep the adaptation going.`,
          evidence: t.repsBased
            ? [
                `${t.avgRepsPerSet} avg reps vs ${t.targetReps} target`,
                `+${Math.round(t.headroom * 100)}% above prescription`,
              ]
            : [`${Math.round(t.completionRate * 100)}% sets completed across ${t.sessions} sessions`],
          change: { repFactor: 1 + VOLUME_STEP },
          priority: 0.7,
          tone: "proud",
        });
      }
      continue;
    }

    // C) Declining (not avoided) → pull volume back so form/consistency holds.
    if (t.direction === "declining") {
      adaptations.push({
        kind: "decrease_volume",
        icon: "trending-down",
        exerciseId: t.exerciseId,
        exerciseName: t.exerciseName,
        title: `Ease ${t.exerciseName} back a set`,
        explanation: `${t.exerciseName} is slipping — you're finishing only ${Math.round(t.completionRate * 100)}% of the prescribed sets. Pulling one set off so the reps you do hit stay quality, then we rebuild.`,
        evidence: [
          `${Math.round(t.completionRate * 100)}% sets completed`,
          t.repsBased ? `${t.avgRepsPerSet} avg reps vs ${t.targetReps} target` : `${t.sessions} sessions`,
        ],
        change: { setsDelta: -1 },
        priority: 0.6,
        tone: "gentle",
      });
      continue;
    }
  }

  // ── Rule: rest tuning from recovery (session-wide), when not already red. ──
  if (!recoveryFirst && recovery.level === "amber" && twin.today.workout.planned) {
    adaptations.push({
      kind: "modify_rest",
      icon: "time-outline",
      exerciseId: null,
      exerciseName: null,
      title: "Add 15s rest between sets today",
      explanation: `Recovery's amber (${recovery.score}/100). A little more rest between sets keeps quality up without cutting the session — train smart, not sore.`,
      evidence: recovery.drivers,
      change: { restDeltaSeconds: 15 },
      priority: 0.45,
      tone: "steady",
    });
  }

  // ── Fallback so the engine always has something true to say ──
  if (adaptations.length === 0) {
    const enough = !dataLimited;
    adaptations.push({
      kind: "modify_rest",
      icon: "checkmark-circle-outline",
      exerciseId: null,
      exerciseName: null,
      title: enough ? "Hold your current program" : "Keep logging your sessions",
      explanation: enough
        ? "Your numbers are right in the pocket — hitting prescription without slipping or coasting. No change needed; consistency is the work right now."
        : "I need a couple more logged workouts before I start tuning your program. Run your next session through the guided coach and I'll take it from there.",
      evidence: enough
        ? [`${windowed.length} sessions analyzed`]
        : ["awaiting more training data"],
      change: {},
      priority: 0.1,
      tone: enough ? "steady" : "warm",
    });
  }

  adaptations.sort((a, b) => b.priority - a.priority);
  const top = adaptations.slice(0, 5);

  return {
    __kind: "workout-adaptation",
    summary: buildSummary(top, trends, recovery.level, dataLimited),
    trends: trends.slice(0, 6),
    adaptations: top,
    dataLimited,
  };
}

function buildSummary(
  adaptations: WorkoutAdaptation[],
  trends: ExercisePerformanceTrend[],
  recoveryLevel: GozlinTwin["recovery"]["level"],
  dataLimited: boolean,
): string {
  if (dataLimited) {
    return "Not enough logged training yet to adapt your program — let's build a few sessions of data first.";
  }
  if (recoveryLevel === "red") {
    return "Your body's asking for recovery before progression — that's the priority today.";
  }
  const improving = trends.filter((t) => t.direction === "improving").length;
  const avoided = trends.filter((t) => t.direction === "avoided").length;
  if (improving >= 2) {
    return `${improving} exercises are trending up — time to progress before they go stale.`;
  }
  if (avoided >= 1) {
    return "A couple of moves keep getting skipped — let's swap them for ones you'll actually finish.";
  }
  if (adaptations[0]?.kind === "increase_volume" || adaptations[0]?.kind === "increase_intensity") {
    return "You've earned a step up — here's how I'd progress your training.";
  }
  return "Here's how I'd tune your training based on what you've actually been doing.";
}

// ════════════════════════════════════════════════════════════════════
// 4. APPLY (turn decisions into a concrete, mutated plan)
// ════════════════════════════════════════════════════════════════════

/** Scale a reps string ("10-15", "30 sec", "12") by a factor, preserving form. */
export function scaleReps(reps: string, factor: number): string {
  const range = reps.match(/(\d+)\s*-\s*(\d+)/);
  if (range) {
    const lo = Math.max(1, Math.round(Number(range[1]) * factor));
    const hi = Math.max(lo + 1, Math.round(Number(range[2]) * factor));
    return reps.replace(/\d+\s*-\s*\d+/, `${lo}-${hi}`);
  }
  const single = reps.match(/(\d+)/);
  if (single) {
    const v = Math.max(1, Math.round(Number(single[1]) * factor));
    return reps.replace(/\d+/, String(v));
  }
  return reps; // unrecognized — leave untouched
}

function applyToExercise(
  ex: PlannedExercise,
  adaptation: WorkoutAdaptation,
): PlannedExercise {
  const { change } = adaptation;
  let next: PlannedExercise = { ...ex };

  if (change.replacementId) {
    const repl = DB_BY_ID.get(change.replacementId);
    if (repl) {
      next = {
        ...next,
        exerciseId: repl.id,
        name: repl.name,
        category: repl.category,
        movementPattern: repl.movementPattern,
        reps: repl.defaultReps,
        restSeconds: repl.restSeconds,
        durationMinutes: repl.durationMinutes,
        difficulty: repl.difficulty,
      };
    }
  }
  if (change.repFactor && change.repFactor !== 1) {
    next.reps = scaleReps(next.reps, change.repFactor);
  }
  if (change.setsDelta) {
    next.sets = clamp(next.sets + change.setsDelta, 1, 6);
  }
  if (change.restDeltaSeconds) {
    next.restSeconds = clamp(next.restSeconds + change.restDeltaSeconds, 20, 240);
  }
  return next;
}

/**
 * Apply ONE adaptation to a plan, returning a new plan (immutable). Exercise-
 * targeted changes hit every session the exercise appears in; rest changes with
 * no target apply to every exercise. The plan's inputHash is preserved so the
 * weekly regen check won't clobber an in-week adaptation.
 */
export function applyWorkoutAdaptation(
  plan: GeneratedWorkoutPlan,
  adaptation: WorkoutAdaptation,
): GeneratedWorkoutPlan {
  const target = adaptation.exerciseId;
  const restWide =
    adaptation.kind === "modify_rest" && !target && adaptation.change.restDeltaSeconds;

  const sessions = plan.sessions.map((s) => ({
    ...s,
    exercises: s.exercises.map((ex) => {
      if (target) return ex.exerciseId === target ? applyToExercise(ex, adaptation) : ex;
      if (restWide) return applyToExercise(ex, adaptation);
      return ex;
    }),
  }));

  return { ...plan, sessions };
}

/** Apply many adaptations in priority order (skips no-op recovery suggestions). */
export function applyWorkoutAdaptations(
  plan: GeneratedWorkoutPlan,
  adaptations: WorkoutAdaptation[],
): GeneratedWorkoutPlan {
  return adaptations
    .filter((a) => a.kind !== "recommend_recovery")
    .reduce((p, a) => applyWorkoutAdaptation(p, a), plan);
}

/** Whether an adaptation actually changes the plan when applied (UI gate). */
export function isApplicable(adaptation: WorkoutAdaptation): boolean {
  const c = adaptation.change;
  return Boolean(
    c.replacementId ||
      (c.repFactor && c.repFactor !== 1) ||
      c.setsDelta ||
      c.restDeltaSeconds,
  );
}
