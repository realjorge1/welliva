/**
 * SESSION TOTALS — reps are reps and held time is time. The engine stores a
 * hold's seconds in `repsCompleted`, so a card adding that field up would call a
 * 45-second plank "45 reps".
 */
import { describe, expect, it } from "vitest";

import { formatClock, sessionTotals } from "@/fitness/components/sessionTotals";
import type { ExerciseSessionResult } from "@/models/session";

function result(id: string, sets: [reps: number, secs: number][], skipped = false): ExerciseSessionResult {
  return {
    exerciseId: id,
    exerciseName: id,
    category: "core",
    difficulty: "beginner",
    targetSets: sets.length,
    targetReps: "10",
    setsCompleted: sets.map(([reps, secs], i) => ({
      setNumber: i + 1,
      repsCompleted: reps,
      durationSeconds: secs,
      skipped: false,
    })),
    totalReps: sets.reduce((s, [r]) => s + r, 0),
    totalTimeSeconds: sets.reduce((s, [, t]) => s + t, 0),
    skipped,
  };
}

describe("sessionTotals", () => {
  const results = [
    result("squat", [
      [12, 40],
      [10, 38],
    ]),
    // A plank: the engine banks the seconds held as "reps".
    result("plank", [
      [45, 45],
      [45, 45],
    ]),
    result("lunge", [], true),
  ];
  const timed = (id: string) => id === "plank";

  it("counts reps from rep sets and time from holds, never one as the other", () => {
    const t = sessionTotals(results, timed, { setsTotal: 6, movesTotal: 3 });
    expect(t.reps).toBe(22);
    expect(t.heldSeconds).toBe(90);
  });

  it("counts sets and moves done against the plan", () => {
    const t = sessionTotals(results, timed, { setsTotal: 6, movesTotal: 3 });
    expect(t.setsDone).toBe(4);
    expect(t.setsTotal).toBe(6);
    expect(t.movesDone).toBe(2);
    expect(t.movesTotal).toBe(3);
  });
});

describe("formatClock", () => {
  it("reads like a stopwatch", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(24)).toBe("0:24");
    expect(formatClock(1960)).toBe("32:40");
    expect(formatClock(3760)).toBe("1:02:40");
    expect(formatClock(-5)).toBe("0:00");
  });
});
