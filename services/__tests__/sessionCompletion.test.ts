/**
 * SESSION COMPLETION — the full chain from "athlete finishes a workout" to
 * "the numbers on Progress and the Fitness dashboard move".
 *
 * The engine, the summary, the log entry and the progress derivations are each
 * unit-tested elsewhere; nothing tested the SEAM between them. This walks a
 * real session through the state machine exactly as the player does, builds the
 * summary and the WorkoutLogEntry exactly as the summary screen does, and then
 * asserts the dashboard/Progress readings that the user actually sees.
 */
import { describe, expect, it } from "vitest";

import { SessionService } from "../SessionService";
import { parseTargetReps, type SessionExerciseInfo, type SessionState } from "../../models/session";
import type { WorkoutLogEntry } from "../../models/workout";
import { buildProgressSnapshot, weekStartOf, workoutStreakDays } from "@/fitness/services/ProgressService";
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { WORKOUTS } from "@/fitness/data/workouts";
import { workoutToPlayerParams } from "@/fitness/services/WorkoutCatalog";

const service = SessionService.getInstance();

function repsExercise(id: string, sets = 3): SessionExerciseInfo {
  return {
    exerciseId: id,
    name: `Exercise ${id}`,
    category: "push",
    difficulty: "beginner",
    exerciseType: "reps",
    sets,
    reps: "10",
    restSeconds: 30,
    transitionSeconds: 30,
    setupPosition: "",
    instructions: [],
    coachCues: [],
    icon: "barbell",
  };
}

function timedExercise(id: string, sets = 2, seconds = 30): SessionExerciseInfo {
  return { ...repsExercise(id, sets), exerciseType: "timed", reps: `${seconds} sec` };
}

/** Drive the machine the way the player's buttons do, to COMPLETE. */
function playThrough(
  exercises: SessionExerciseInfo[],
  opts: { repsPerSet?: number; skip?: string[] } = {},
): SessionState {
  const repsPerSet = opts.repsPerSet ?? 10;
  const skip = new Set(opts.skip ?? []);

  let s = service.createSession("w1", "Test session", exercises);
  s = service.startSession(s); // INTRO → COUNTDOWN
  s = service.beginFirstSet(s); // COUNTDOWN → ACTIVE_SET

  let guard = 0;
  while (s.phase !== "COMPLETE" && guard++ < 2000) {
    const ex = s.exercises[s.currentExerciseIndex];
    if (s.phase === "ACTIVE_SET") {
      if (ex && skip.has(ex.exerciseId)) {
        s = service.skipExercise(s);
        continue;
      }
      if (ex?.exerciseType === "timed") {
        // Timed sets auto-finish on the clock — tick to the target.
        const target = parseTargetReps(ex.reps);
        for (let i = 0; i < target + 1 && s.phase === "ACTIVE_SET"; i++) s = service.tick(s);
        continue;
      }
      for (let r = 0; r < repsPerSet; r++) s = service.addRep(s);
      s = service.completeSet(s);
      continue;
    }
    if (s.phase === "REST" || s.phase === "TRANSITION") {
      s = service.skipRest(s);
      continue;
    }
    break;
  }
  return s;
}

/** Exactly what app/session-summary.tsx writes into the workout log. */
function toLogEntry(summary: ReturnType<typeof service.buildSummary>): WorkoutLogEntry {
  return {
    id: summary.sessionRunId,
    date: summary.date,
    sessionId: summary.workoutSessionId,
    sessionLabel: summary.sessionLabel,
    exercisesCompleted: summary.exercisesCompleted,
    totalExercises: summary.totalExercises,
    completionPercent: summary.completionPercent,
    durationMinutes: Math.round(summary.durationSeconds / 60),
    completedAt: summary.completedAt,
  };
}

describe("a fully completed session", () => {
  const exercises = [repsExercise("e1"), repsExercise("e2"), timedExercise("e3")];

  it("reaches COMPLETE with every exercise recorded as done", () => {
    const s = playThrough(exercises);

    expect(s.phase).toBe("COMPLETE");
    expect(s.results).toHaveLength(3);
    expect(s.results.every((r) => !r.skipped)).toBe(true);
  });

  it("builds a summary that reads 100%, not 'Keep going'", () => {
    const summary = service.buildSummary(playThrough(exercises));

    expect(summary.exercisesCompleted).toBe(3);
    expect(summary.totalExercises).toBe(3);
    expect(summary.completionPercent).toBe(100);
    expect(Number.isFinite(summary.completionPercent)).toBe(true);
    expect(summary.setsCompleted).toBe(3 + 3 + 2);
    expect(summary.totalReps).toBeGreaterThan(0);
  });

  it("produces a log entry the dashboard counts toward this week", () => {
    const summary = service.buildSummary(playThrough(exercises));
    const entry = toLogEntry(summary);
    const today = summary.date;

    // The Fitness dashboard's weekStats filter, verbatim.
    const start = weekStartOf(today);
    const thisWeek = [entry].filter((l) => l.date >= start && l.date <= today);

    expect(thisWeek).toHaveLength(1);
    expect(workoutStreakDays([entry], today)).toBe(1);
  });

  it("moves every number on the Progress screen", () => {
    const summary = service.buildSummary(playThrough(exercises));
    const entry = toLogEntry(summary);

    const snap = buildProgressSnapshot({
      workoutLog: [entry],
      sessionHistory: [summary],
      today: summary.date,
      weeklyTargetDays: 3,
    });

    expect(snap.totalWorkouts).toBe(1);
    expect(snap.thisWeekWorkouts).toBe(1);
    expect(snap.currentStreakDays).toBe(1);
    expect(snap.weeklyGoalProgress).toBeCloseTo(1 / 3);
  });
});

describe("a session with no exercises (the NaN trap)", () => {
  it("never produces a NaN completion percent", () => {
    const s = service.createSession("w1", "Empty", []);
    const summary = service.buildSummary({ ...s, phase: "COMPLETE" });

    // NaN survives neither JSON nor a comparison: `NaN >= 50` is false, so the
    // summary screen falls through to the red "Keep going" ring at 0 for a
    // session the athlete just finished.
    expect(Number.isFinite(summary.completionPercent)).toBe(true);
    expect(summary.completionPercent).toBe(0);
  });

  it("survives the JSON round-trip the summary screen does", () => {
    const s = service.createSession("w1", "Empty", []);
    const summary = service.buildSummary({ ...s, phase: "COMPLETE" });
    const revived = JSON.parse(JSON.stringify(summary));

    // JSON.stringify(NaN) === "null" — a NaN here reaches the screen as null
    // and every downstream `|| 0` silently reads it as zero.
    expect(revived.completionPercent).not.toBeNull();
    expect(Number.isFinite(revived.completionPercent)).toBe(true);
  });
});

describe("a partially completed session", () => {
  it("counts the finished exercises and excludes the skipped ones", () => {
    const exercises = [repsExercise("e1"), repsExercise("e2"), repsExercise("e3")];
    const summary = service.buildSummary(playThrough(exercises, { skip: ["e2"] }));

    expect(summary.exercisesCompleted).toBe(2);
    expect(summary.totalExercises).toBe(3);
    expect(summary.completionPercent).toBe(67);
  });

  it("still counts as a workout for the week even when stopped early", () => {
    const exercises = [repsExercise("e1"), repsExercise("e2")];
    let s = service.createSession("w1", "Stopped", exercises);
    s = service.beginFirstSet(service.startSession(s));
    for (let r = 0; r < 10; r++) s = service.addRep(s);
    s = service.completeSet(s); // one set in, then quit
    s = service.stopSession(s);

    const summary = service.buildSummary(s);
    const entry = toLogEntry(summary);

    expect(s.phase).toBe("COMPLETE");
    expect(Number.isFinite(summary.completionPercent)).toBe(true);
    // The workout happened — it must appear in the log regardless of completion.
    const snap = buildProgressSnapshot({
      workoutLog: [entry],
      sessionHistory: [summary],
      today: summary.date,
      weeklyTargetDays: 3,
    });
    expect(snap.thisWeekWorkouts).toBe(1);
  });
});

/* ────────────────────────── the full catalog audit ──────────────────────────
 * "Check every single exercise/workout — are they recorded and counted?"
 *
 * `buildExerciseList` in the player resolves each id against EXERCISE_DATABASE,
 * falling back to the AI plan, and SILENTLY DROPS anything it can't resolve
 * (`return null` → `.filter(Boolean)`). A workout whose ids don't resolve
 * therefore reaches the engine short — or empty — and logs a completion the
 * athlete didn't get. These walk every authored workout and every catalogued
 * exercise all the way to the Progress numbers.
 */

const DB_BY_ID = new Map(EXERCISE_DATABASE.map((e) => [e.id, e]));

/** The player's resolution step, for ids that live in the local DB. */
function resolveFromDb(
  idsStr: string,
  setsStr: string,
  repsStr: string,
): { resolved: SessionExerciseInfo[]; requested: number } {
  const ids = idsStr.split(",").map((s) => s.trim());
  const setsArr = setsStr.split(",").map((s) => parseInt(s.trim(), 10));
  const repsArr = repsStr.split(",").map((s) => s.trim());

  const resolved = ids
    .map((id, i) => {
      const e = DB_BY_ID.get(id);
      if (!e) return null;
      return {
        exerciseId: e.id,
        name: e.name,
        category: e.category,
        difficulty: e.difficulty,
        exerciseType: e.exerciseType,
        sets: setsArr[i] || e.defaultSets,
        reps: repsArr[i] || e.defaultReps,
        restSeconds: e.restSeconds,
        transitionSeconds: 30,
        setupPosition: e.setupPosition,
        instructions: e.instructions,
        coachCues: e.coachCues,
        icon: e.icon,
      } as SessionExerciseInfo;
    })
    .filter(Boolean) as SessionExerciseInfo[];

  return { resolved, requested: ids.length };
}

describe("every library workout is fully recorded and counted", () => {
  it("has workouts to audit", () => {
    expect(WORKOUTS.length).toBeGreaterThan(0);
  });

  it.each(WORKOUTS.map((w) => [w.id, w.name] as const))(
    "%s (%s) plays through to a 100%% counted session",
    (id) => {
      const def = WORKOUTS.find((w) => w.id === id)!;
      const params = workoutToPlayerParams(def);
      const { resolved, requested } = resolveFromDb(params.exerciseIds, params.sets, params.reps);

      // Nothing may be silently dropped on the way into the player.
      expect(resolved).toHaveLength(requested);
      expect(resolved.length).toBeGreaterThan(0);

      const final = playThrough(resolved);
      expect(final.phase).toBe("COMPLETE");

      const summary = service.buildSummary(final);
      expect(summary.totalExercises).toBe(requested);
      expect(summary.exercisesCompleted).toBe(requested);
      expect(summary.completionPercent).toBe(100);
      expect(Number.isFinite(summary.completionPercent)).toBe(true);
      expect(summary.setsCompleted).toBeGreaterThan(0);
      expect(summary.durationSeconds).toBeGreaterThanOrEqual(0);

      // And it lands in the week's numbers.
      const entry = toLogEntry(summary);
      const snap = buildProgressSnapshot({
        workoutLog: [entry],
        sessionHistory: [summary],
        today: summary.date,
        weeklyTargetDays: 3,
      });
      expect(snap.thisWeekWorkouts).toBe(1);
      expect(snap.totalWorkouts).toBe(1);
      expect(snap.currentStreakDays).toBe(1);
    },
  );
});

describe("every catalogued exercise is playable as a single-exercise session", () => {
  // The app/exercise/[id].tsx path: `exerciseIds: id` with no sets/reps params,
  // so the engine falls back to the DB entry's own defaults.
  it.each(EXERCISE_DATABASE.map((e) => [e.id, e.name] as const))(
    "%s (%s) completes and counts",
    (id) => {
      const { resolved } = resolveFromDb(id, "", "");
      expect(resolved).toHaveLength(1);

      const summary = service.buildSummary(playThrough(resolved));

      expect(summary.exercisesCompleted).toBe(1);
      expect(summary.completionPercent).toBe(100);
      expect(summary.setsCompleted).toBe(resolved[0].sets);
      // A timed exercise records seconds as reps; a rep exercise records reps.
      expect(summary.totalReps).toBeGreaterThan(0);
    },
  );
});
