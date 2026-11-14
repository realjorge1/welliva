import { describe, expect, it } from "vitest";
import {
  EATING_MIN_FULL_DAYS,
  MOOD_LOW_DAYS,
  healthNotes,
  isFullDay,
  visibleNotes,
  type HealthNotesInput,
} from "../checks/doctorNotes";
import { addDays } from "../cycle/dates";

const TODAY = "2026-11-14";

function input(over: Partial<HealthNotesInput> = {}): HealthNotesInput {
  return {
    today: TODAY,
    bio: { sex: "female", medicalConditions: [], primaryGoal: "better_health", goals: ["better_health"] },
    targetWeightKg: null,
    weighIns: [],
    intake: {},
    slotsByDate: {},
    calorieFloor: 1200,
    moods: [],
    pain: [],
    ...over,
  };
}

const ids = (i: HealthNotesInput) => healthNotes(i).map((n) => n.id);
const FULL = ["breakfast", "lunch", "dinner"];

describe("weight down without trying", () => {
  const weighIns = [
    { date: "2026-07-01", kg: 70 },
    { date: "2026-09-01", kg: 68 },
    { date: "2026-11-10", kg: 66.4 },
    { date: "2026-11-13", kg: 66.2 },
  ];

  it("raises it at 5% when losing weight isn't a goal", () => {
    const notes = healthNotes(input({ weighIns }));
    const n = notes.find((x) => x.id === "weight-unplanned");
    expect(n).toBeDefined();
    expect(n!.body).toContain("from 70 kg on 1 Jul 2026 to about 66.3 kg now, 5% lower");
    expect(n!.body).not.toMatch(/cancer|thyroid|diabetes/i);
  });

  it("stays quiet when they are trying to lose", () => {
    expect(ids(input({ weighIns, bio: { sex: "female", primaryGoal: "lose_weight" } }))).not.toContain("weight-unplanned");
    expect(ids(input({ weighIns, targetWeightKg: 65 }))).not.toContain("weight-unplanned");
  });

  it("stays quiet postpartum, under 5%, or over too short a span", () => {
    expect(ids(input({ weighIns, bio: { sex: "female", medicalConditions: ["postpartum"] } }))).not.toContain(
      "weight-unplanned",
    );
    expect(ids(input({ weighIns: [{ date: "2026-07-01", kg: 70 }, { date: TODAY, kg: 67 }] }))).not.toContain(
      "weight-unplanned",
    );
    expect(ids(input({ weighIns: [{ date: "2026-10-01", kg: 70 }, { date: TODAY, kg: 65 }] }))).not.toContain(
      "weight-unplanned",
    );
  });
});

describe("losing weight fast", () => {
  const fast = [
    { date: "2026-09-01", kg: 95 },
    { date: "2026-10-25", kg: 90 },
    { date: "2026-10-31", kg: 88.6 },
    { date: "2026-11-07", kg: 87.1 },
    { date: "2026-11-13", kg: 85.4 },
  ];

  it("raises it past 1 kg (or 1%) a week across three weeks", () => {
    const n = healthNotes(input({ weighIns: fast, bio: { sex: "male", primaryGoal: "lose_weight" } })).find(
      (x) => x.id === "weight-fast",
    );
    expect(n).toBeDefined();
    expect(n!.body).toMatch(/losing about 1\.\d kg a week, from 90 kg on 25 Oct to 85\.4 kg on 13 Nov/);
  });

  it("waits out the first weeks of a plan", () => {
    const fresh = fast.slice(1);
    expect(ids(input({ weighIns: fresh }))).not.toContain("weight-fast");
  });

  it("uses 1% of body weight for heavier people", () => {
    // 150 kg, 1.3 kg a week: under 1.5 (1%), so not raised.
    const heavy = [
      { date: "2026-09-01", kg: 160 },
      { date: "2026-10-24", kg: 153 },
      { date: "2026-10-31", kg: 151.7 },
      { date: "2026-11-07", kg: 150.4 },
      { date: "2026-11-14", kg: 149.1 },
    ];
    expect(ids(input({ weighIns: heavy }))).not.toContain("weight-fast");
  });
});

describe("eating less than you need", () => {
  function days(n: number, kcal: number, slots = FULL) {
    const intake: Record<string, number> = {};
    const slotsByDate: Record<string, string[]> = {};
    for (let i = 1; i <= n; i++) {
      const d = addDays(TODAY, -i);
      intake[d] = kcal;
      slotsByDate[d] = slots;
    }
    return { intake, slotsByDate };
  }

  it("raises it when most fully logged days are under the floor", () => {
    const n = healthNotes(input(days(10, 1000))).find((x) => x.id === "eating-low");
    expect(n).toBeDefined();
    expect(n!.body).toContain("On 10 of the 10 days");
    expect(n!.body).toContain("less than 1,200 calories");
    expect(n!.body).toContain("If that's everything you ate");
  });

  it("never counts a day with a main meal missing (a missed log is not a missed meal)", () => {
    expect(ids(input(days(14, 900, ["breakfast", "lunch"])))).not.toContain("eating-low");
  });

  it("needs enough full days", () => {
    expect(ids(input(days(EATING_MIN_FULL_DAYS - 1, 900)))).not.toContain("eating-low");
  });

  it("uses the floor it is given (higher in pregnancy)", () => {
    expect(ids(input({ ...days(10, 1500), calorieFloor: 1800 }))).toContain("eating-low");
    expect(ids(input({ ...days(10, 1500), calorieFloor: 1200 }))).not.toContain("eating-low");
  });

  it("knows a full day", () => {
    expect(isFullDay(["dinner", "breakfast", "snack", "lunch"])).toBe(true);
    expect(isFullDay(["breakfast", null, "dinner"])).toBe(false);
    expect(isFullDay(undefined)).toBe(false);
  });
});

describe("low on most days", () => {
  function moods(lowDays: number, total = 14) {
    const out: HealthNotesInput["moods"][number][] = [];
    for (let i = 0; i < total; i++) out.push({ date: addDays(TODAY, -i), valence: i < lowDays ? -2 / 3 : 1 / 3 });
    return out;
  }

  it("raises it on more than half of the last 14 days", () => {
    const n = healthNotes(input({ moods: moods(MOOD_LOW_DAYS) })).find((x) => x.id === "mood-low");
    expect(n).toBeDefined();
    expect(n!.body).toContain(`on ${MOOD_LOW_DAYS} of the last 14 days`);
    expect(n!.body).toContain("crisis line");
  });

  it("stays quiet below that, and a day with no feeling is not a low day", () => {
    expect(ids(input({ moods: moods(MOOD_LOW_DAYS - 1) }))).not.toContain("mood-low");
    const gaps = moods(MOOD_LOW_DAYS - 1).concat([{ date: addDays(TODAY, -13), valence: null }]);
    expect(ids(input({ moods: gaps }))).not.toContain("mood-low");
  });

  it("averages a day's entries", () => {
    const mixed = moods(MOOD_LOW_DAYS).concat([{ date: TODAY, valence: 1 }]);
    expect(ids(input({ moods: mixed }))).not.toContain("mood-low");
  });
});

describe("pain that keeps coming back", () => {
  it("raises it after three sessions with the same spot", () => {
    const pain = ["2026-11-03", "2026-11-08", "2026-11-12"].map((date, i) => ({
      runId: `r${i}`,
      date,
      answer: "pain" as const,
      areas: ["back"],
      at: "x",
    }));
    const n = healthNotes(input({ pain })).find((x) => x.id === "pain-recurring");
    expect(n!.body).toContain("Your lower back hurt after 3 workouts since 3 Nov.");
  });
});

describe("Got it", () => {
  const weighIns = [
    { date: "2026-07-01", kg: 70 },
    { date: "2026-11-13", kg: 66 },
  ];

  it("hides a note while its evidence is the same", () => {
    const notes = healthNotes(input({ weighIns }));
    const n = notes.find((x) => x.id === "weight-unplanned")!;
    const dismissed = { "weight-unplanned": { signature: n.signature, on: TODAY } };
    expect(visibleNotes(notes, dismissed, addDays(TODAY, 200))).toHaveLength(0);
  });

  it("brings it back on new evidence, but not inside the quiet days", () => {
    const notes = healthNotes(input({ weighIns }));
    const dismissed = { "weight-unplanned": { signature: "old", on: TODAY } };
    expect(visibleNotes(notes, dismissed, addDays(TODAY, 10))).toHaveLength(0);
    expect(visibleNotes(notes, dismissed, addDays(TODAY, 60))).toHaveLength(1);
  });
});
