import { describe, expect, it } from "vitest";

import {
  detectHabitPatterns,
  scoreBehavior,
  type HabitReportInput,
} from "../GozlinHabitEngine";
import type { GozlinCheckin, GozlinTwin } from "../gozlin.types";

const NOW = new Date(2026, 8, 24); // 2026-09-24, local

/** The slice of the Twin the behaviour scorer actually reads. */
const twin = {
  goal: "lose_weight",
  momentum: { trainingLoad7d: 2, adherence7d: 70, streak: 4, trend: "steady" },
  today: { water: { target: 2000, pct: 0.5 }, calories: { target: 2000 } },
} as unknown as GozlinTwin;

function input(
  checkins: GozlinCheckin[],
  dietHistory: HabitReportInput["dietHistory"] = [],
): HabitReportInput {
  return {
    twin,
    dietHistory,
    workoutLog: [],
    workoutPlan: null,
    checkins,
    weeklyWorkoutTarget: 3,
    now: NOW,
  };
}

function day(offset: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - offset);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function entry(
  offset: number,
  patch: Partial<GozlinCheckin> = {},
): GozlinCheckin {
  return {
    id: `daily:${day(offset)}`,
    date: day(offset),
    kind: "daily",
    createdAt: 1000 + offset,
    ...patch,
  };
}

const mood = (scores: BehaviorScoreLike[]) => scores.find((s) => s.domain === "mood");
type BehaviorScoreLike = ReturnType<typeof scoreBehavior>[number];

/** A day of eating, `eaten` of 4 meals on plan. */
function hist(offset: number, eaten: number): HabitReportInput["dietHistory"][number] {
  return {
    date: day(offset),
    dietId: "d",
    dietName: "d",
    status: eaten === 4 ? "completed" : eaten === 0 ? "skipped" : "partial",
    mealsConsumed: eaten,
    totalMeals: 4,
  };
}

describe("mood domain score reads valence", () => {
  it("puts Neutral at the middle of the scale", () => {
    const scores = scoreBehavior(
      input([entry(1, { valence: 0 }), entry(2, { valence: 0 })]),
    );
    expect(mood(scores)?.score).toBe(50);
  });

  it("puts Very Pleasant at the top and Very Unpleasant at the bottom", () => {
    expect(
      mood(scoreBehavior(input([entry(1, { valence: 1 }), entry(2, { valence: 1 })])))
        ?.score,
    ).toBe(100);
    expect(
      mood(scoreBehavior(input([entry(1, { valence: -1 }), entry(2, { valence: -1 })])))
        ?.score,
    ).toBe(0);
  });

  it("names the stop in the driver line instead of printing a figure", () => {
    const scores = scoreBehavior(
      input([entry(1, { valence: 1 }), entry(2, { valence: 1 })]),
    );
    const driver = mood(scores)?.drivers[0] ?? "";
    // "avg 3.4/5" was a scale nobody ever logged against once the slider
    // replaced it, so no /5 may reappear here.
    expect(driver).not.toMatch(/\/5/);
    expect(driver).toContain("very pleasant");
    expect(driver).toContain("2 days");
  });

  it("needs two days before it reports anything", () => {
    expect(mood(scoreBehavior(input([entry(1, { valence: 1 })])))).toBeUndefined();
  });

  it("still scores pre-004 records on the 1–5 dial", () => {
    // mood 5 maps to Very Pleasant, so this must read as the top of the scale.
    const scores = scoreBehavior(input([entry(1, { mood: 5 }), entry(2, { mood: 5 })]));
    expect(mood(scores)?.score).toBe(100);
  });

  it("counts a day once however many moments it holds", () => {
    // Three entries on one day plus one on another is TWO days. If the engine
    // counted entries, a talkative day would outvote a quiet one and the driver
    // line's "N days" would be a lie.
    const scores = scoreBehavior(
      input([
        { ...entry(1, { valence: 1 }), id: "m1", kind: "momentary" },
        { ...entry(1, { valence: 1 }), id: "m2", kind: "momentary" },
        { ...entry(1, { valence: 1 }), id: "m3", kind: "momentary" },
        entry(2, { valence: -1 }),
      ]),
    );
    expect(mood(scores)?.drivers[0]).toContain("2 days");
    // Averaged per day: (+1 and −1) → 0 → the middle of the scale.
    expect(mood(scores)?.score).toBe(50);
  });

  it("averages several moments within one day", () => {
    const scores = scoreBehavior(
      input([
        { ...entry(1, { valence: 1 }), id: "a", kind: "momentary" },
        { ...entry(1, { valence: -1 }), id: "b", kind: "momentary" },
        entry(2, { valence: 0 }),
      ]),
    );
    expect(mood(scores)?.score).toBe(50);
  });

  it("ignores a sleep-only entry, rather than scoring it as Neutral", () => {
    const scores = scoreBehavior(
      input([entry(1, { sleepHours: 7 }), entry(2, { sleepHours: 8 })]),
    );
    expect(mood(scores)).toBeUndefined();
  });
});

describe("the mood link reads labels, not a dead stress dial", () => {
  /** Hard days eat badly, calm days eat well — a gap the detector should find. */
  function linkedHistory() {
    return [
      hist(1, 1),
      hist(2, 1),
      hist(3, 4),
      hist(4, 4),
    ];
  }

  it("treats a pressure LABEL as a hard day", () => {
    const patterns = detectHabitPatterns(
      input(
        [
          entry(1, { valence: 0.5, labels: ["Stressed"] }),
          entry(2, { valence: 0.5, labels: ["Overwhelmed"] }),
          entry(3, { valence: 0.8, labels: ["Calm"] }),
          entry(4, { valence: 0.8, labels: ["Content"] }),
        ],
        linkedHistory(),
      ),
    );
    const link = patterns.find((p) => p.kind === "mood_link");
    // Valence is PLEASANT on the hard days — only the labels say otherwise, so
    // finding the link proves the words are being read.
    expect(link).toBeDefined();
    expect(link?.domain).toBe("mood");
  });

  it("treats an unpleasant valence as a hard day even with no labels", () => {
    const patterns = detectHabitPatterns(
      input(
        [
          entry(1, { valence: -1 }),
          entry(2, { valence: -0.5 }),
          entry(3, { valence: 1 }),
          entry(4, { valence: 0.5 }),
        ],
        linkedHistory(),
      ),
    );
    expect(patterns.find((p) => p.kind === "mood_link")).toBeDefined();
  });

  it("does not count Sad as pressure", () => {
    // Sad is unpleasant but is not the under-load state that drives stress
    // eating. With a pleasant valence and only Sad as a label, these days are
    // neither hard nor calm, so there is nothing to compare and no link.
    const patterns = detectHabitPatterns(
      input(
        [
          entry(1, { valence: 0.5, labels: ["Sad"] }),
          entry(2, { valence: 0.5, labels: ["Lonely"] }),
          entry(3, { valence: 0.8, labels: ["Calm"] }),
          entry(4, { valence: 0.8, labels: ["Content"] }),
        ],
        linkedHistory(),
      ),
    );
    expect(patterns.find((p) => p.kind === "mood_link")).toBeUndefined();
  });

  it("still honours a pre-004 stress dial", () => {
    const patterns = detectHabitPatterns(
      input(
        [
          entry(1, { mood: 4, stress: 5 }),
          entry(2, { mood: 4, stress: 4 }),
          entry(3, { mood: 5, stress: 1 }),
          entry(4, { mood: 5, stress: 1 }),
        ],
        linkedHistory(),
      ),
    );
    expect(patterns.find((p) => p.kind === "mood_link")).toBeDefined();
  });

  it("reports nothing when hard and calm days eat the same", () => {
    const flat = [
      hist(1, 4),
      hist(2, 4),
      hist(3, 4),
      hist(4, 4),
    ];
    const patterns = detectHabitPatterns(
      input(
        [
          entry(1, { valence: -1 }),
          entry(2, { valence: -1 }),
          entry(3, { valence: 1 }),
          entry(4, { valence: 1 }),
        ],
        flat,
      ),
    );
    expect(patterns.find((p) => p.kind === "mood_link")).toBeUndefined();
  });

  it("leaves the three middle stops out of the comparison", () => {
    // Slightly unpleasant / neutral / slightly pleasant are neither hard nor
    // calm. With every day in that band there are fewer than two on each side,
    // so no link may be claimed however different the eating was.
    const patterns = detectHabitPatterns(
      input(
        [
          entry(1, { valence: -0.2 }),
          entry(2, { valence: -0.1 }),
          entry(3, { valence: 0.2 }),
          entry(4, { valence: 0.1 }),
        ],
        linkedHistory(),
      ),
    );
    expect(patterns.find((p) => p.kind === "mood_link")).toBeUndefined();
  });
});
