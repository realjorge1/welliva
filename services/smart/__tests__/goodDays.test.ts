/**
 * What your good days have in common. Strict on purpose: every rule here is a
 * sentence the app would otherwise be wrong to say.
 */
import { describe, expect, it } from "vitest";

import type { DietHistoryEntry } from "../../../models/diet";
import type { WorkoutLogEntry } from "../../../models/workout";
import type { WaterHistoryEntry } from "../../OfflineStorage";
import { shiftDay, weekdayIndex } from "../../commitment";
import { insightKey, recordOpened, type InsightEntry } from "../../gozlin/InsightLedger";
import type { GozlinCheckin } from "../../gozlin/gozlin.types";
import type { IntakeLedger } from "../../nutrition/IntakeLedger";
import type { LogStore } from "../../nutrition/foodLogStore";
import {
  PATTERN_NOT_CAUSE,
  goodDayCard,
  goodDaySentence,
  nextGoodDay,
  readGoodDays,
  scoreDays,
  splitBestDays,
  type GoodDayFinding,
  type GoodDaysHabit,
  type GoodDaysInput,
} from "../goodDays";

const TODAY = "2026-11-20";
const ago = (i: number) => shiftDay(TODAY, -i);
const range = (from: number, to: number) => {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
};

/** Ten best days (1–10 days ago) and thirty ordinary ones (11–40 days ago). */
const BEST = range(1, 10);
const OTHER = range(11, 40);
const checkins = (): GozlinCheckin[] => [
  ...BEST.map((i) => ({ date: ago(i), valence: 1, createdAt: i })),
  ...OTHER.map((i) => ({ date: ago(i), valence: 0, createdAt: i })),
];

const workout = (i: number, time = "09:30", duration = 30): WorkoutLogEntry => ({
  id: `w${i}`,
  date: ago(i),
  sessionId: "s",
  sessionLabel: "Session",
  exercisesCompleted: 5,
  totalExercises: 5,
  completionPercent: 100,
  durationMinutes: duration,
  completedAt: `${ago(i)}T${time}:00+00:00`,
});

const water = (i: number, ml: number, goalMl?: number): WaterHistoryEntry => ({
  date: ago(i),
  ml,
  ...(goalMl ? { goalMl } : {}),
});

const diet = (i: number, mealsConsumed: number, totalMeals: number): DietHistoryEntry => ({
  date: ago(i),
  dietId: "d",
  dietName: "Diet",
  mealsConsumed,
  totalMeals,
  status: "partial",
});

const habit = (over: Partial<Omit<GoodDaysHabit, "done">> & { done: string[] }): GoodDaysHabit => ({
  id: "h1",
  name: "Vitamins",
  days: [0, 1, 2, 3, 4, 5, 6],
  weeklyGoal: null,
  createdAt: ago(100),
  ...over,
  done: new Set(over.done),
});

function input(over: Partial<GoodDaysInput> = {}): GoodDaysInput {
  return {
    today: TODAY,
    checkins: checkins(),
    workouts: [],
    waterHistory: [],
    dietHistory: [],
    intake: {} as IntakeLedger,
    foodLog: {} as LogStore,
    habits: [],
    ...over,
  };
}

const ids = (over: Partial<GoodDaysInput>) => readGoodDays(input(over))?.findings.map((f) => f.id);

describe("a day's score", () => {
  it("is the average of that day's check-ins", () => {
    const scores = scoreDays(
      [
        { date: ago(1), valence: 1, createdAt: 1 },
        { date: ago(1), valence: 0, createdAt: 2 },
      ],
      TODAY,
    );
    expect(scores.get(ago(1))).toBe(0.5);
  });

  it("leaves out a day with no feeling recorded: a gap is not neutral", () => {
    const scores = scoreDays([{ date: ago(1), sleepHours: 8, createdAt: 1 }], TODAY);
    expect(scores.size).toBe(0);
  });

  it("reads the old 1–5 mood through the same reader", () => {
    expect(scoreDays([{ date: ago(1), mood: 5, createdAt: 1 }], TODAY).get(ago(1))).toBe(1);
  });

  it("ignores today, which isn't over, and anything older than 60 days", () => {
    const scores = scoreDays(
      [
        { date: TODAY, valence: 1, createdAt: 1 },
        { date: ago(60), valence: 1, createdAt: 2 },
        { date: ago(61), valence: 1, createdAt: 3 },
      ],
      TODAY,
    );
    expect([...scores.keys()]).toEqual([ago(60)]);
  });

  it("leaves out a rough day: the app told them to take it easy", () => {
    expect(scoreDays([{ date: ago(1), valence: -1, createdAt: 1 }], TODAY, new Set([ago(1)])).size).toBe(0);
  });
});

describe("the gate", () => {
  const scored = (n: number) => checkins().slice(0, n);

  it("says nothing below 21 scored days", () => {
    expect(readGoodDays(input({ checkins: scored(20) }))).toBeNull();
  });

  it("reads at 21", () => {
    const report = readGoodDays(input({ checkins: scored(21) }));
    expect(report?.scoredDays).toBe(21);
    expect(report?.bestDays).toBe(10); // the ten days at valence 1, all above the rest
  });
});

describe("best days", () => {
  it("are the top quarter", () => {
    const scores = new Map(range(1, 40).map((i) => [ago(i), 1 - i / 100]));
    const split = splitBestDays(scores);
    expect(split?.best.length).toBe(10);
    expect(split?.others.length).toBe(30);
  });

  it("include every day tied at the cut-off", () => {
    const scores = new Map(range(1, 40).map((i) => [ago(i), i <= 12 ? 1 : 0]));
    expect(splitBestDays(scores)?.best.length).toBe(12);
  });

  it("mean nothing when ties swallow over half the days, so it stays silent", () => {
    const scores = new Map(range(1, 40).map((i) => [ago(i), i <= 25 ? 1 : 0]));
    expect(splitBestDays(scores)).toBeNull();
  });

  it("mean nothing when every day scores the same", () => {
    const scores = new Map(range(1, 40).map((i) => [ago(i), 0.3]));
    expect(splitBestDays(scores)).toBeNull();
  });
});

describe("the finding", () => {
  const morning = [...range(1, 7), 11, 12, 13].map((i) => workout(i));

  it("states both numbers, exactly", () => {
    const f = readGoodDays(input({ workouts: morning }))!.findings[0];
    expect(f.id).toBe("good-days:trained-before-noon");
    expect(goodDaySentence(f)).toBe(
      "Your best days have something in common: in 7 of your 10 best days, you trained before noon. On your other days: 3 of 30.",
    );
  });

  it("says a pattern, not a cause, on the card and in what the history keeps", () => {
    const f = readGoodDays(input({ workouts: morning }))!.findings[0];
    expect(goodDayCard(f).message).toBe(
      `In 7 of your 10 best days, you trained before noon. On your other days: 3 of 30. ${PATTERN_NOT_CAUSE}`,
    );
  });

  it("needs 60% of best days", () => {
    expect(ids({ workouts: range(1, 6).map((i) => workout(i)) })).toEqual(["good-days:trained-before-noon"]);
    expect(ids({ workouts: range(1, 5).map((i) => workout(i)) })).toEqual([]);
  });

  it("needs a gap of 25 points", () => {
    const best = range(1, 8).map((i) => workout(i));
    const close = range(11, 27).map((i) => workout(i)); // 17 of 30, a gap of 23 points
    const wide = range(11, 26).map((i) => workout(i)); // 16 of 30, a gap of 27 points
    expect(ids({ workouts: [...best, ...close] })).toEqual([]);
    expect(ids({ workouts: [...best, ...wide] })).toEqual(["good-days:trained-before-noon"]);
  });

  it("needs at least four best days, whatever the rate", () => {
    const sleepy = checkins().map((c, i) => {
      const n = i + 1;
      if (n <= 3) return { ...c, sleepHours: 8 };
      if (n >= 11 && n <= 16) return { ...c, sleepHours: 5 };
      return c;
    });
    expect(ids({ checkins: sleepy })).toEqual([]); // 3 of 3 is 100%, and still only three days
  });

  it("needs enough other days to compare with", () => {
    const sleepy = checkins().map((c, i) => {
      const n = i + 1;
      if (n <= 5) return { ...c, sleepHours: 8 };
      if (n >= 11 && n <= 15) return { ...c, sleepHours: 5 };
      return c;
    });
    expect(ids({ checkins: sleepy })).toEqual([]); // 5 of 5 against only five days
  });

  it("says nothing when nothing passes", () => {
    const everyDay = [...BEST, ...OTHER].map((i) => workout(i));
    expect(ids({ workouts: everyDay })).toEqual([]);
  });

  it("shows at most three, biggest gap first", () => {
    const report = readGoodDays(
      input({
        workouts: range(1, 10).map((i) => workout(i)), // 10/10 vs 0/30, a gap of 100
        waterHistory: [
          ...range(1, 9).map((i) => water(i, 2000, 2000)),
          water(10, 100, 2000),
          ...range(11, 40).map((i) => water(i, 100, 2000)),
        ], // 9/10 vs 0/30, a gap of 90
        dietHistory: [
          ...range(1, 8).map((i) => diet(i, 3, 3)),
          ...range(9, 10).map((i) => diet(i, 1, 3)),
          ...range(11, 40).map((i) => diet(i, 1, 3)),
        ], // 8/10 vs 0/30, a gap of 80
        habits: [habit({ done: range(1, 7).map(ago) })], // 7/10 vs 0/30, a gap of 70
      }),
    );
    expect(report?.findings.map((f) => f.id)).toEqual([
      "good-days:trained-before-noon",
      "good-days:water-goal",
      "good-days:all-meals",
    ]);
  });

  it("drops the broader finding when the narrower one says it already", () => {
    expect(ids({ workouts: range(1, 8).map((i) => workout(i)) })).toEqual(["good-days:trained-before-noon"]);
    expect(ids({ habits: [habit({ done: range(1, 8).map(ago) })] })).toEqual(["good-days:habit:h1"]);
  });

  it("keeps the broader finding when the narrower one doesn't pass", () => {
    const evening = range(1, 8).map((i) => workout(i, "19:00"));
    expect(ids({ workouts: evening })).toEqual(["good-days:trained"]);
  });

  it("stays gone once dismissed", () => {
    const dismissed = new Set(["good-days:trained-before-noon"]);
    const workouts = range(1, 8).map((i) => workout(i));
    expect(ids({ workouts, dismissed })).toEqual(["good-days:trained"]);
  });

  it("names no scope when every day could be known", () => {
    expect(readGoodDays(input({ workouts: morning }))!.findings[0].scope).toBeNull();
  });
});

describe("training before noon", () => {
  it("goes by when the session started", () => {
    const f = readGoodDays(input({ workouts: range(1, 8).map((i) => workout(i, "12:20", 45)) }));
    expect(f?.findings[0].id).toBe("good-days:trained-before-noon");
  });

  it("doesn't count a session that began the night before", () => {
    const f = readGoodDays(input({ workouts: range(1, 8).map((i) => workout(i, "00:20", 45)) }));
    expect(f?.findings[0].id).toBe("good-days:trained");
  });

  it("doesn't count a session with no real work in it", () => {
    const empty = range(1, 8).map((i) => ({ ...workout(i), completionPercent: 0 }));
    expect(ids({ workouts: empty })).toEqual([]);
  });

  it("leaves out a session whose time doesn't match its day", () => {
    const shifted = range(1, 8).map((i) => ({ ...workout(i), completedAt: `${ago(i - 1)}T09:30:00+00:00` }));
    const f = readGoodDays(input({ workouts: shifted }))!.findings[0];
    expect(f.id).toBe("good-days:trained");
  });
});

describe("unknown is not no", () => {
  it("counts sleep only on days it was recorded, and says so", () => {
    const logged = checkins().map((c, i) => {
      const n = i + 1;
      if (n <= 5) return { ...c, sleepHours: n <= 4 ? 8 : 5 };
      if (n >= 11 && n <= 18) return { ...c, sleepHours: 5 };
      return c;
    });
    const f = readGoodDays(input({ checkins: logged }))!.findings[0];
    expect(f.id).toBe("good-days:sleep");
    expect([f.bestYes, f.bestKnown, f.otherYes, f.otherKnown]).toEqual([4, 5, 0, 8]);
    expect(f.scope).toBe("Only counting days you recorded your sleep.");
    expect(goodDayCard(f).message).toContain("Only counting days you recorded your sleep. A pattern, not a cause.");
  });

  it("takes the latest sleep answer of a day", () => {
    const logged = checkins().map((c, i) => {
      const n = i + 1;
      if (n <= 4) return { ...c, sleepHours: 8 };
      if (n >= 11 && n <= 16) return { ...c, sleepHours: 5 };
      return c;
    });
    const correction = range(1, 4).map((i) => ({ date: ago(i), sleepHours: 5, createdAt: 1000 + i }));
    const f = readGoodDays(input({ checkins: [...logged, ...correction] }));
    expect(f?.findings).toEqual([]); // every "8" was corrected to "5"
  });

  it("counts water only on days with a row and that day's goal", () => {
    const rows = [
      ...range(1, 5).map((i) => water(i, 2000, 2000)),
      ...range(11, 16).map((i) => water(i, 100, 2000)),
      ...range(17, 30).map((i) => water(i, 2000)), // no goal recorded that day
    ];
    const f = readGoodDays(input({ waterHistory: rows }))!.findings[0];
    expect(f.id).toBe("good-days:water-goal");
    expect([f.bestYes, f.bestKnown, f.otherYes, f.otherKnown]).toEqual([5, 5, 0, 6]);
    expect(f.scope).toBe("Only counting days you logged water.");
  });

  it("counts planned meals only on days with a plan", () => {
    const rows = [
      ...range(1, 5).map((i) => diet(i, 3, 3)),
      ...range(11, 16).map((i) => diet(i, 1, 3)),
      ...range(17, 30).map((i) => diet(i, 0, 0)),
    ];
    const f = readGoodDays(input({ dietHistory: rows }))!.findings[0];
    expect(f.id).toBe("good-days:all-meals");
    expect([f.bestYes, f.bestKnown, f.otherYes, f.otherKnown]).toEqual([5, 5, 0, 6]);
    expect(f.scope).toBe("Only counting days you had a meal plan.");
  });

  it("counts dinner only when it was logged that day, at a believable hour", () => {
    const record = (i: number, time: string, date = ago(i)) => ({
      slot: "dinner" as const,
      name: "Dinner",
      calories: 1,
      proteinG: 1,
      carbsG: 1,
      fatG: 1,
      at: `${date}T${time}:00+00:00`,
    });
    const intake: IntakeLedger = {};
    for (const i of range(1, 5)) intake[ago(i)] = [record(i, "19:00")];
    for (const i of range(11, 16)) intake[ago(i)] = [record(i, "21:30")];
    // Logged the next morning: a record of remembering, not of eating.
    for (const i of range(17, 20)) intake[ago(i)] = [record(i, "19:00", ago(i - 1))];
    // Ticked at breakfast: says nothing about dinner time.
    for (const i of range(21, 24)) intake[ago(i)] = [record(i, "08:00")];
    const f = readGoodDays(input({ intake }))!.findings[0];
    expect(f.id).toBe("good-days:dinner-early");
    expect([f.bestYes, f.bestKnown, f.otherYes, f.otherKnown]).toEqual([5, 5, 0, 6]);
    expect(f.phrase).toBe("you logged dinner before 8:00 PM");
  });

  it("counts a weekday habit only on the days it was scheduled", () => {
    // One weekday falls on at most two of ten best days: it can't reach four.
    const weekday = weekdayIndex(ago(1));
    const bestDays = BEST.filter((i) => weekdayIndex(ago(i)) === weekday);
    const f = readGoodDays(
      input({
        habits: [habit({ days: [weekday], done: bestDays.map(ago) })],
      }),
    );
    expect(bestDays.length).toBeLessThan(4);
    expect(f?.findings).toEqual([]);

    const wide = readGoodDays(
      input({
        habits: [habit({ days: [0, 1, 2, 3, 4], done: BEST.map(ago) })],
      }),
    )!.findings[0];
    const weekdays = (from: number, to: number) => range(from, to).filter((i) => weekdayIndex(ago(i)) <= 4).length;
    expect(wide.id).toBe("good-days:habit:h1");
    expect(wide.bestKnown).toBe(weekdays(1, 10));
    expect(wide.otherKnown).toBe(weekdays(11, 40));
    expect(wide.scope).toBe("Only counting days this habit was scheduled.");
  });

  it("counts a habit only since it was added", () => {
    const f = readGoodDays(
      input({
        habits: [habit({ createdAt: ago(20), done: range(1, 8).map(ago) })],
      }),
    )!.findings[0];
    expect(f.id).toBe("good-days:habit:h1");
    expect([f.bestKnown, f.otherKnown]).toEqual([10, 10]);
    expect(f.scope).toBe("Only counting days this habit was scheduled.");
  });

  it("counts a quota habit on every day since it was added", () => {
    const f = readGoodDays(
      input({
        habits: [habit({ weeklyGoal: 3, createdAt: ago(20), done: range(1, 8).map(ago) })],
      }),
    )!.findings[0];
    expect([f.bestKnown, f.otherKnown]).toEqual([10, 10]);
    expect(f.scope).toBe("Only counting days since you added this habit.");
  });
});

describe("one new finding a week, never a repeat", () => {
  const finding = (id: string, bestYes = 7): GoodDayFinding => ({
    id: `good-days:${id}`,
    phrase: "you trained",
    bestYes,
    bestKnown: 10,
    otherYes: 3,
    otherKnown: 22,
    gap: 0.5,
    scope: null,
  });
  const opened = (f: GoodDayFinding, daysAgo: number): InsightEntry => {
    const [entry] = recordOpened([], goodDayCard(f), ago(daysAgo), new Date(`${ago(daysAgo)}T10:00:00Z`));
    return entry;
  };

  it("offers the biggest finding first", () => {
    const a = finding("a");
    expect(nextGoodDay([a, finding("b")], [], TODAY)).toBe(a);
  });

  it("holds the next one back for a week", () => {
    const a = finding("a");
    const b = finding("b");
    expect(nextGoodDay([a, b], [opened(a, 3)], TODAY)).toBeNull();
    expect(nextGoodDay([a, b], [opened(a, 8)], TODAY)).toBe(b);
  });

  it("doesn't call the same finding new because its numbers moved", () => {
    const old = opened(finding("a", 7), 30);
    expect(nextGoodDay([finding("a", 8)], [old], TODAY)).toBeNull();
  });

  it("isn't held back by other insights", () => {
    const other: InsightEntry = {
      key: "weekly:1",
      openedAt: `${TODAY}T08:00:00Z`,
      card: { id: "weekly", type: "motivation", tone: "positive", icon: "x", title: "t", message: "m", priority: 1 },
    };
    const a = finding("a");
    expect(nextGoodDay([a], [other], TODAY)).toBe(a);
  });

  it("files under the same key every day, and again from the history", () => {
    const card = goodDayCard(finding("a"));
    const reread = goodDayCard(finding("a", 9));
    expect(insightKey(card, "2026-11-01")).toBe(insightKey(reread, "2026-12-25"));
    const [entry] = recordOpened([], card, "2026-11-01");
    expect(insightKey(entry.card, "2026-12-25")).toBe(entry.key);
    expect(recordOpened([entry], entry.card, "2026-12-25").length).toBe(1);
  });
});
