/**
 * SESSION CHART — the strip under the player's clock. What is protected: a
 * column only lights for time somebody worked, "now" is where the athlete
 * actually is in every phase, and the strip always fits the card it is in.
 */
import { describe, expect, it } from "vitest";

import {
  axisLabels,
  blockStops,
  chartColumns,
  chartDots,
  chartGeometry,
  chartPills,
  chartTally,
  cursorOf,
  markerX,
  type ChartInput,
} from "@/fitness/components/sessionChartLayout";
import type {
  ExerciseSessionResult,
  SessionBlock,
  SessionExerciseInfo,
  SetResult,
} from "@/models/session";

function move(id: string, block: SessionBlock, sets: number, reps = "10"): SessionExerciseInfo {
  return {
    exerciseId: id,
    name: id,
    category: "legs",
    difficulty: "beginner",
    exerciseType: "reps",
    sets,
    reps,
    restSeconds: 45,
    transitionSeconds: 30,
    block,
    setupPosition: "",
    instructions: [],
    coachCues: [],
    icon: "body",
  };
}

function banked(id: string, durations: number[]): ExerciseSessionResult {
  const sets: SetResult[] = durations.map((d, i) => ({
    setNumber: i + 1,
    repsCompleted: 10,
    durationSeconds: d,
    skipped: false,
  }));
  return {
    exerciseId: id,
    exerciseName: id,
    category: "legs",
    difficulty: "beginner",
    targetSets: durations.length,
    targetReps: "10",
    setsCompleted: sets,
    totalReps: 10 * sets.length,
    totalTimeSeconds: durations.reduce((a, b) => a + b, 0),
    skipped: false,
  };
}

const EXERCISES = [
  move("w1", "warmup", 1),
  move("m1", "main", 3),
  move("m2", "main", 3),
  move("c1", "cooldown", 1),
];

const base = (over: Partial<ChartInput>): ChartInput => ({
  exercises: EXERCISES,
  results: [],
  phase: "ACTIVE_SET",
  exerciseIndex: 0,
  set: 1,
  timer: 0,
  ...over,
});

const states = (input: ChartInput) => chartColumns(input).map((c) => c.state);

describe("cursorOf — where now is", () => {
  it("is the set being worked, or about to be", () => {
    expect(cursorOf({ phase: "ACTIVE_SET", exerciseIndex: 1, set: 2 })).toEqual({ exercise: 1, set: 2 });
    expect(cursorOf({ phase: "COUNTDOWN", exerciseIndex: 0, set: 1 })).toEqual({ exercise: 0, set: 1 });
  });

  it("moves past the set just banked during a rest, and to the next move during a hand-over", () => {
    expect(cursorOf({ phase: "REST", exerciseIndex: 1, set: 2 })).toEqual({ exercise: 1, set: 3 });
    expect(cursorOf({ phase: "TRANSITION", exerciseIndex: 1, set: 3 })).toEqual({ exercise: 2, set: 1 });
  });

  it("is nowhere once the session is over", () => {
    expect(cursorOf({ phase: "COMPLETE", exerciseIndex: 3, set: 1 })).toBeNull();
  });
});

describe("chartColumns", () => {
  it("has one column per set, in session order", () => {
    const cols = chartColumns(base({}));
    expect(cols.map((c) => `${c.exercise}.${c.set}`)).toEqual([
      "0.1", "1.1", "1.2", "1.3", "2.1", "2.2", "2.3", "3.1",
    ]);
  });

  it("lights the live set with the clock and leaves everything after it to do", () => {
    const cols = chartColumns(
      base({ exerciseIndex: 1, set: 2, timer: 17, results: [banked("w1", [30]), banked("m1", [40])] }),
    );
    expect(cols.map((c) => c.state)).toEqual([
      "done", "done", "live", "todo", "todo", "todo", "todo", "todo",
    ]);
    expect(cols[2].worked).toBe(17);
    expect(cols[1].worked).toBe(40);
  });

  it("during a rest, the banked set is done and nothing is live", () => {
    expect(
      states(base({ phase: "REST", exerciseIndex: 1, set: 1, results: [banked("w1", [30]), banked("m1", [40])] })),
    ).toEqual(["done", "done", "todo", "todo", "todo", "todo", "todo", "todo"]);
  });

  it("a move skipped part-way keeps its banked sets and darkens the rest", () => {
    const skipped: ExerciseSessionResult = { ...banked("m1", []), skipped: true };
    expect(
      states(
        base({
          phase: "TRANSITION",
          exerciseIndex: 1,
          set: 2,
          results: [banked("w1", [30]), banked("m1", [40]), skipped],
        }),
      ),
    ).toEqual(["done", "done", "skipped", "skipped", "todo", "todo", "todo", "todo"]);
  });

  it("at the end, a set that was never done stays dark — the card can't claim it", () => {
    const cols = chartColumns(
      base({ phase: "COMPLETE", exerciseIndex: 3, set: 1, results: [banked("w1", [30]), banked("m1", [40, 41, 39])] }),
    );
    expect(cols.map((c) => c.state)).toEqual([
      "done", "done", "done", "done", "skipped", "skipped", "skipped", "skipped",
    ]);
    expect(chartTally(cols)).toEqual({ done: 4, total: 8 });
  });
});

describe("chartGeometry — it fits", () => {
  const widths = [180, 264, 300, 360, 420];

  it("never runs wider than its card, for short sessions and long ones", () => {
    const long = Array.from({ length: 10 }, (_, i) => move(`m${i}`, "main", 5));
    for (const exercises of [EXERCISES, [move("solo", "main", 3)], long]) {
      const cols = chartColumns(base({ exercises }));
      for (const w of widths) {
        const g = chartGeometry(cols, w, 40);
        expect(g, `${w}`).not.toBeNull();
        if (!g) continue;
        const last = g.offsetX + (g.starts[g.starts.length - 1] + g.colWidth) * g.pitch;
        expect(last).toBeLessThanOrEqual(w + 0.01);
        expect(g.rows * g.pitch).toBeLessThanOrEqual(40 + 0.01);
        expect(g.planRows).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("keeps a move's sets closer to each other than to the next move", () => {
    const cols = chartColumns(base({}));
    const g = chartGeometry(cols, 300, 40)!;
    const gap = (k: number) => g.starts[k] - (g.starts[k - 1] + g.colWidth);
    expect(gap(2)).toBeLessThan(gap(4)); // m1.1→m1.2 vs m1.3→m2.1
    expect(gap(4)).toBeLessThan(gap(1)); // m1.3→m2.1 vs w1→m1 (a new block)
  });

  it("returns nothing to draw before it has been measured", () => {
    expect(chartGeometry(chartColumns(base({})), 0, 40)).toBeNull();
    expect(chartGeometry([], 300, 40)).toBeNull();
  });
});

describe("chartDots — a lamp is a reading", () => {
  const cols = (over: Partial<ChartInput>) => chartColumns(base(over));

  it("draws a live column empty at the start of the set and filling with the clock", () => {
    const at = (timer: number) => {
      const c = cols({ exerciseIndex: 1, set: 1, timer, results: [banked("w1", [30])] });
      return chartDots(c, chartGeometry(c, 300, 40)!).live.length;
    };
    expect(at(0)).toBe(0);
    expect(at(20)).toBeGreaterThan(0);
    expect(at(40)).toBeGreaterThan(at(20));
  });

  it("puts time past the box on top, in its own layer", () => {
    const c = cols({ exerciseIndex: 1, set: 1, timer: 200, results: [banked("w1", [30])] });
    const d = chartDots(c, chartGeometry(c, 300, 40)!);
    expect(d.over.length).toBeGreaterThan(0);
  });

  it("lights nothing at all before anything has been done", () => {
    const c = cols({ phase: "COUNTDOWN" });
    const d = chartDots(c, chartGeometry(c, 300, 40)!);
    expect(d.done.length + d.live.length + d.over.length).toBe(0);
    expect(d.ghost.length).toBeGreaterThan(0);
  });
});

describe("pills, stops, marker and axis", () => {
  it("one pill per move; the move on now is live, finished ones done, the rest to do", () => {
    const c = chartColumns(base({ phase: "REST", exerciseIndex: 1, set: 1, results: [banked("w1", [30]), banked("m1", [40])] }));
    const g = chartGeometry(c, 300, 40)!;
    const pills = chartPills(c, g, cursorOf({ phase: "REST", exerciseIndex: 1, set: 1 }));
    expect(pills.map((p) => p.state)).toEqual(["done", "live", "todo", "todo"]);
    for (let i = 1; i < pills.length; i++) {
      expect(pills[i].x).toBeGreaterThan(pills[i - 1].x + pills[i - 1].w);
    }
  });

  it("puts an orange stop between blocks, and only there", () => {
    const c = chartColumns(base({}));
    expect(blockStops(c, chartGeometry(c, 300, 40)!)).toHaveLength(2);
  });

  it("puts the marker over the column that is now", () => {
    const c = chartColumns(base({ exerciseIndex: 1, set: 2, results: [banked("w1", [30]), banked("m1", [40])] }));
    const g = chartGeometry(c, 300, 40)!;
    const x = markerX(c, g, { exercise: 1, set: 2 })!;
    const k = 2;
    expect(x).toBeGreaterThan(g.offsetX + g.starts[k] * g.pitch);
    expect(x).toBeLessThan(g.offsetX + (g.starts[k] + g.colWidth) * g.pitch);
    expect(markerX(c, g, null)).toBeNull();
  });

  it("names each block once, in order, without overlapping or leaving the card", () => {
    const c = chartColumns(base({}));
    for (const w of [200, 264, 360]) {
      const g = chartGeometry(c, w, 40)!;
      const charW = 6;
      const labels = axisLabels(c, g, charW);
      expect(labels.length).toBeGreaterThan(0);
      for (let i = 0; i < labels.length; i++) {
        const end = labels[i].x + labels[i].text.length * charW;
        expect(end).toBeLessThanOrEqual(w + 0.01);
        if (i > 0) {
          const prevEnd = labels[i - 1].x + labels[i - 1].text.length * charW;
          expect(labels[i].x).toBeGreaterThanOrEqual(prevEnd);
        }
      }
    }
  });

  it("names nothing when the session is one block", () => {
    const flat = [move("a", "main", 3), move("b", "main", 3)];
    const c = chartColumns(base({ exercises: flat }));
    expect(axisLabels(c, chartGeometry(c, 300, 40)!, 6)).toEqual([]);
  });
});
