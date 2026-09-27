/**
 * investigate_progress's `focus` decides the root cause.
 *
 * The tool has always taken a focus — weight, strength, energy, adherence —
 * and the report ignored it: it echoed the word back and named whichever
 * candidate scored highest overall. So "why isn't my bench going up?" could be
 * answered with "A genuine plateau — the scale's held flat".
 */

import { describe, expect, it } from "vitest";
import { buildDetectiveReport } from "../GozlinDetectiveEngine";
import type { GozlinCheckin } from "../gozlin.types";

const NOW = new Date(2026, 8, 27, 12, 0, 0);

function daysAgo(n: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A user losing weight, 60/100 adherence, on plan for training.
const TWIN = {
  goal: "lose_weight",
  momentum: { adherence7d: 60, trainingLoad7d: 3 },
  body: { goalWeightKg: 70, currentWeightKg: 80, goalProgress: 0.2 },
} as never;

// The scale flat for two weeks…
const FLAT_SCALE = [
  { date: daysAgo(13), weightKg: 80 },
  { date: daysAgo(7), weightKg: 80.1 },
  { date: daysAgo(1), weightKg: 80 },
];

// …and session output down 25% on the fortnight before.
const FALLING_OUTPUT = [
  { date: daysAgo(20), totalReps: 100, completionPercent: 100 },
  { date: daysAgo(17), totalReps: 100, completionPercent: 100 },
  { date: daysAgo(6), totalReps: 75, completionPercent: 100 },
  { date: daysAgo(2), totalReps: 75, completionPercent: 100 },
] as never[];

const base = {
  twin: TWIN,
  dietHistory: [],
  workoutLog: [],
  sessionHistory: FALLING_OUTPUT,
  bodyLogs: FLAT_SCALE,
  weeklyWorkoutTarget: 3,
  now: NOW,
};

describe("investigate_progress focus", () => {
  it("unfocused, still names the strongest read overall (unchanged behaviour)", () => {
    const r = buildDetectiveReport(base);
    expect(r.rootCause?.title).toBe("A genuine plateau");
  });

  it("answers a strength question with a strength cause, not the plateau", () => {
    const r = buildDetectiveReport({ ...base, focus: "strength" });
    expect(r.rootCause?.title).toBe("Your session output is down");
    // Off-focus candidates are dropped, not demoted into the findings.
    expect(r.findings.map((f) => f.title)).not.toContain("A genuine plateau");
    // The strip leads with what was asked about.
    expect(r.metrics[0].label).toBe("Performance");
  });

  it("answers a weight question with the plateau", () => {
    const r = buildDetectiveReport({ ...base, focus: "weight" });
    expect(r.rootCause?.title).toBe("A genuine plateau");
    expect(r.metrics[0].label).toBe("Weight");
  });

  it("says so honestly when nothing explains the asked-about outcome", () => {
    const steady = [
      { date: daysAgo(20), totalReps: 100, completionPercent: 100 },
      { date: daysAgo(17), totalReps: 100, completionPercent: 100 },
      { date: daysAgo(6), totalReps: 101, completionPercent: 100 },
      { date: daysAgo(2), totalReps: 100, completionPercent: 100 },
    ] as never[];
    const r = buildDetectiveReport({ ...base, sessionHistory: steady, focus: "strength" });
    expect(r.rootCause).toBeNull();
    expect(r.headline).toBe("Nothing in your logs is holding your training back.");
    expect(r.findings[0].title).toBe("Your output is holding steady");
  });

  it("reads energy off the check-in log", () => {
    const checkins: GozlinCheckin[] = [1, 2, 3, 4].map((n) => ({
      date: daysAgo(n),
      kind: "daily",
      sleepHours: 5.5,
      labels: n % 2 === 0 ? ["Drained"] : [],
      createdAt: NOW.getTime() - n * 86_400_000,
    }));
    const r = buildDetectiveReport({ ...base, focus: "energy", checkins });
    expect(r.rootCause?.title).toBe("Short sleep is the likeliest drain");
    expect(r.rootCause?.evidence).toContain("4 nights logged, averaging 5.5h");
    expect(r.metrics[0]).toMatchObject({ label: "Sleep", value: "5.5h avg" });
  });

  it("does not guess at energy when nothing about it was logged", () => {
    const quiet = { ...base, sessionHistory: [], focus: "energy" as const };
    const r = buildDetectiveReport(quiet);
    expect(r.rootCause).toBeNull();
    expect(r.findings[0].title).toBe("Energy isn't in your logs");
  });
});
