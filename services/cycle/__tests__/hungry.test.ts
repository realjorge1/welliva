/**
 * THE HUNGRIER WEEK — offered from her own logs, and the total stays the same.
 *
 * What a test can hold, and what would quietly rot without one:
 *   · the patterns standard: recorded days only, two cycles at least, the
 *     denominator is the cycles with enough logs;
 *   · the arithmetic of "the total stays the same": cuts pay for the extra, no
 *     day loses more than 150, none goes below the floor, and when a floor bites
 *     she gets less extra rather than a deeper cut;
 *   · always an offer, never by default; "No thanks" is final; never in the
 *     modes that need their calories where they are, never under 18;
 *   · when the period starts the extra stops, and the past stays as it was;
 *   · every reader of a day's target agrees;
 *   · it never says "make up for", "compensate", "earn", "burn off", "cheat" or
 *     "damage", and the reading page quotes the numbers the code acts on.
 */
import { describe, expect, it } from "vitest";

import { buildNutritionTrend } from "../../../components/diet/nutritionTrend";
import type { DietHistoryEntry } from "../../../models/diet";
import { generateCoachInsights } from "../../intelligence/CoachInsightEngine";
import { buildTwin } from "../../gozlin/GozlinTwin";
import {
  dayCalorieDelta,
  dayCalorieTarget,
  dayTargetNote,
  dayAdjustmentsSnapshot,
  publishDayAdjustments,
  subscribeDayAdjustments,
} from "../../nutrition/dayTargets";
import { buildCycleBrief, cycleStateLines } from "../brief";
import { addDays } from "../dates";
import { cycleCsv } from "../exportData";
import {
  HUNGRY_MAX_CUT,
  HUNGRY_MAX_EXTRA,
  HUNGRY_MIN_BMI,
  HUNGRY_MIN_DIFF,
  HUNGRY_MIN_PRE_DAYS,
  HUNGRY_MIN_REST_DAYS,
  HUNGRY_MIN_SHARE,
  HUNGRY_PRE_DAYS,
  HUNGRY_SPREAD_DAYS,
  hungryAllowed,
  hungryForCoach,
  hungryPattern,
  hungrySplit,
  hungryTodayLine,
  mergeHungryLedger,
  type IntakePoint,
} from "../hungry";
import { CYCLE_LIBRARY } from "../library";
import { buildCycles } from "../predict";
import { normalizeSettings, type CycleSettings, type PeriodEpisode } from "../types";
import { computeView } from "../view";
import { history, period, settings } from "./helpers";

/** Starts 8 Apr … 23 Sep, 28 days apart. Next: most likely 21 Oct, window 19–23 Oct. */
const PERIODS = history("2026-04-08", [28, 28, 28, 28, 28, 28]);
const STARTS = PERIODS.map((p) => p.start);
const S = settings({ usualCycleDays: 28 });
const TARGET = { targetKcal: 2000, floorKcal: 1200 };

/** A cycle's food log: `rest` kcal on days 6 to 22 of 28, `pre` on the last 5. */
function eating(start: string, next: string, rest: number, pre: number): IntakePoint[] {
  const out: IntakePoint[] = [];
  for (let i = 5; i <= 21; i += 1) out.push({ date: addDays(start, i), kcal: rest });
  for (let i = 1; i <= 5; i += 1) out.push({ date: addDays(next, -i), kcal: pre });
  return out;
}
/** 3 of the last 4 logged cycles eat 250 more; the 4th doesn't. */
const LOGS = [
  ...eating(STARTS[2], STARTS[3], 1800, 1800),
  ...eating(STARTS[3], STARTS[4], 1800, 2050),
  ...eating(STARTS[4], STARTS[5], 1800, 2050),
  ...eating(STARTS[5], STARTS[6], 1800, 2050),
];

const cycles = buildCycles(PERIODS, S, "2026-10-01");

function viewOf(
  today: string,
  opts: {
    set?: CycleSettings;
    conditions?: string[];
    age?: number | null;
    bmi?: number | null;
    periods?: PeriodEpisode[];
    calories?: { targetKcal: number; floorKcal: number } | null;
    intake?: IntakePoint[];
  } = {},
) {
  return computeView(
    { settings: opts.set ?? S, periods: opts.periods ?? PERIODS, days: {} },
    {
      today,
      profile: { age: opts.age === undefined ? 30 : opts.age, bmi: opts.bmi, conditions: opts.conditions ?? [] },
      intake: opts.intake ?? LOGS,
      calories: opts.calories === undefined ? TARGET : opts.calories,
    },
  );
}

describe("the pattern", () => {
  it("states the extra and the exact scope", () => {
    const p = hungryPattern(cycles, LOGS)!;
    expect(p).toEqual({
      extraKcal: 250,
      hits: 3,
      observed: 4,
      scope: "3 of your last 4 cycles with enough logs",
    });
  });

  it(`needs a difference of ${HUNGRY_MIN_DIFF} kcal`, () => {
    const small = [...eating(STARTS[4], STARTS[5], 1800, 1949), ...eating(STARTS[5], STARTS[6], 1800, 1949)];
    expect(hungryPattern(cycles, small)).toBeNull();
    const enough = [...eating(STARTS[4], STARTS[5], 1800, 1950), ...eating(STARTS[5], STARTS[6], 1800, 1950)];
    expect(hungryPattern(cycles, enough)?.extraKcal).toBe(150);
  });

  it("needs two cycles: one month is an anecdote", () => {
    expect(hungryPattern(cycles, eating(STARTS[5], STARTS[6], 1800, 2300))).toBeNull();
  });

  it(`must show in at least ${HUNGRY_MIN_SHARE * 100}% of the cycles with enough logs`, () => {
    const rare = [
      ...eating(STARTS[0], STARTS[1], 1800, 2100),
      ...eating(STARTS[1], STARTS[2], 1800, 2100),
      ...eating(STARTS[2], STARTS[3], 1800, 1800),
      ...eating(STARTS[3], STARTS[4], 1800, 1800),
      ...eating(STARTS[4], STARTS[5], 1800, 1800),
      ...eating(STARTS[5], STARTS[6], 1800, 1800),
    ];
    expect(hungryPattern(cycles, rare)).toBeNull();
  });

  it(`reads recorded days only: ${HUNGRY_MIN_PRE_DAYS} before, ${HUNGRY_MIN_REST_DAYS} in the rest, and unlogged days aren't zeros`, () => {
    const thinPre = (s: string, n: string) => eating(s, n, 1800, 2200).filter((x) => x.date < addDays(n, -3));
    expect(hungryPattern(cycles, [...thinPre(STARTS[4], STARTS[5]), ...thinPre(STARTS[5], STARTS[6])])).toBeNull();
    const thinRest = (s: string, n: string) =>
      eating(s, n, 1800, 2200).filter((x) => x.date >= addDays(n, -5) || x.date < addDays(s, 10));
    expect(hungryPattern(cycles, [...thinRest(STARTS[4], STARTS[5]), ...thinRest(STARTS[5], STARTS[6])])).toBeNull();
    // Zeros from a closed day that logged nothing never drag the rest down.
    const zeros = (s: string, n: string) => [
      ...eating(s, n, 1800, 1800),
      ...[8, 9, 10].map((i) => ({ date: addDays(s, 30 + i), kcal: 0 })),
    ];
    expect(hungryPattern(cycles, [...zeros(STARTS[4], STARTS[5]), ...zeros(STARTS[5], STARTS[6])])).toBeNull();
  });

  it(`rounds to the nearest 50 and caps at ${HUNGRY_MAX_EXTRA}`, () => {
    const at = (pre: number) => [...eating(STARTS[4], STARTS[5], 1800, pre), ...eating(STARTS[5], STARTS[6], 1800, pre)];
    expect(hungryPattern(cycles, at(1800 + 220))?.extraKcal).toBe(200);
    expect(hungryPattern(cycles, at(1800 + 230))?.extraKcal).toBe(250);
    expect(hungryPattern(cycles, at(1800 + 700))?.extraKcal).toBe(HUNGRY_MAX_EXTRA);
  });
});

describe("the total stays the same", () => {
  const split = (over: Partial<Parameters<typeof hungrySplit>[0]> = {}) =>
    hungrySplit({
      likely: "2026-10-21",
      cycleStart: "2026-09-23",
      from: "2026-10-01",
      wantedKcal: 250,
      targetKcal: 2000,
      floorKcal: 1200,
      ...over,
    });
  const sum = (s: NonNullable<ReturnType<typeof split>>) => [
    s.extraKcal * s.hungryDays.length,
    s.cutKcal * s.cutDays.length,
  ];

  it(`spreads ${HUNGRY_PRE_DAYS} days' extra over the ${HUNGRY_SPREAD_DAYS} days before them, to the kcal`, () => {
    const s = split()!;
    expect(s).toMatchObject({ extraKcal: 250, cutKcal: 125 });
    expect(s.hungryDays).toEqual(["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"]);
    expect(s.cutDays[0]).toBe("2026-10-06");
    expect(s.cutDays[9]).toBe("2026-10-15");
    expect(sum(s)).toEqual([1250, 1250]);
  });

  it(`never takes more than ${HUNGRY_MAX_CUT} off a day, even at the most extra`, () => {
    const s = split({ wantedKcal: HUNGRY_MAX_EXTRA })!;
    expect(s.cutKcal).toBe(HUNGRY_MAX_CUT);
    expect(s.extraKcal).toBe(HUNGRY_MAX_EXTRA);
  });

  it("gives less extra when a floor bites, rather than cutting deeper", () => {
    const s = split({ targetKcal: 1250, floorKcal: 1200 })!;
    expect(s.cutKcal).toBe(50);
    expect(s.extraKcal).toBe(100);
    expect(1250 - s.cutKcal).toBeGreaterThanOrEqual(1200);
    expect(sum(s)).toEqual([500, 500]);
  });

  it("offers nothing to someone already at the floor", () => {
    expect(split({ targetKcal: 1200, floorKcal: 1200 })).toBeNull();
    expect(split({ targetKcal: 1205, floorKcal: 1200 })).toBeNull();
  });

  it("said yes late, the first time gets what the days left can pay for", () => {
    const s = split({ from: "2026-10-13" })!;
    expect(s.cutDays).toEqual(["2026-10-13", "2026-10-14", "2026-10-15"]);
    expect(s).toMatchObject({ cutKcal: 150, extraKcal: 90 });
    expect(sum(s)).toEqual([450, 450]);
  });

  it("has nothing to offer once the spread days have gone", () => {
    expect(split({ from: "2026-10-16" })).toBeNull();
  });

  it("never cuts a period, or the days just after it, in a short cycle", () => {
    const s = split({ likely: "2026-10-12", cycleStart: "2026-09-23", from: "2026-09-01" })!;
    expect(s.cutDays[0]).toBe("2026-09-28");
    expect(s.cutDays).not.toContain("2026-09-27");
  });
});

describe("the offer", () => {
  it("opens when the spread days begin, in the words of the brief", () => {
    expect(viewOf("2026-10-05").hungryOffer).toBeNull();
    const offer = viewOf("2026-10-06").hungryOffer!;
    expect(offer.text).toBe(
      "You usually eat about 250 kcal more in the 5 days before your period (in 3 of your last 4 cycles with enough logs). Want me to plan for it?",
    );
    expect(offer.detail).toBe(
      "Your total stays the same: about 125 kcal less a day for 10 days, then 250 more on those 5 days.",
    );
    expect(offer.window).toBe("Predicted 19–23 Oct · Fairly sure");
  });

  it("says what a late yes does, and what the next cycle gets", () => {
    expect(viewOf("2026-10-13").hungryOffer!.detail).toBe(
      "Your total stays the same: about 150 kcal less a day for 3 days, then 90 more on those 5 days. From your next cycle, about 250.",
    );
  });

  it("is gone once the spread days are", () => {
    expect(viewOf("2026-10-16").hungryOffer).toBeNull();
  });

  it("is only ever an offer: no plan until she says yes", () => {
    expect(viewOf("2026-10-06").hungryPlan).toEqual({});
  });

  it("'No thanks' is final, and a yes doesn't ask again", () => {
    expect(viewOf("2026-10-06", { set: settings({ usualCycleDays: 28, hungryDeclined: true }) }).hungryOffer).toBeNull();
    expect(
      viewOf("2026-10-06", {
        set: settings({ usualCycleDays: 28, planHungryWeek: true, hungryPlanFrom: "2026-10-06" }),
      }).hungryOffer,
    ).toBeNull();
  });

  it("isn't offered in any mode but the ordinary one, under 18, or to anyone underweight", () => {
    expect(hungryAllowed("normal", { age: 30 })).toBe(true);
    expect(hungryAllowed("normal", { age: null })).toBe(true);
    expect(hungryAllowed("normal", { age: 17 })).toBe(false);
    expect(hungryAllowed("normal", { age: 30, bmi: HUNGRY_MIN_BMI })).toBe(true);
    expect(hungryAllowed("normal", { age: 30, bmi: HUNGRY_MIN_BMI - 0.1 })).toBe(false);
    for (const m of ["pregnancy", "postpartum", "menopause", "hormonal"] as const) {
      expect(hungryAllowed(m, { age: 30 })).toBe(false);
    }
    expect(viewOf("2026-10-06", { age: 17 }).hungryOffer).toBeNull();
    expect(viewOf("2026-10-06", { bmi: 18 }).hungryOffer).toBeNull();
    expect(viewOf("2026-10-06", { bmi: 18 }).hungryAllowed).toBe(false);
    expect(viewOf("2026-10-06", { bmi: 22 }).hungryOffer).not.toBeNull();
    for (const conditions of [["pregnancy"], ["postpartum"], ["menopause"]]) {
      const v = viewOf("2026-10-06", { conditions });
      expect(v.hungry).toBeNull();
      expect(v.hungryOffer).toBeNull();
    }
    const onMethod = settings({
      usualCycleDays: 28,
      contraception: { answer: "hormonal", since: "2026-01-01", restartFrom: null },
    });
    expect(viewOf("2026-10-06", { set: onMethod }).hungryOffer).toBeNull();
  });

  it("stays away during a period and once she's late", () => {
    const bleeding = [...PERIODS, { ...period("2026-10-05"), end: null }];
    expect(viewOf("2026-10-06", { periods: bleeding }).hungryOffer).toBeNull();
    expect(viewOf("2026-10-30").hungryOffer).toBeNull();
  });

  it("needs a target to plan around", () => {
    expect(viewOf("2026-10-06", { calories: null }).hungryOffer).toBeNull();
  });

  it("with tracking off, nothing is offered or planned, and nothing shapes the coach's trend", () => {
    const off = settings({ usualCycleDays: 28, enabled: false, planHungryWeek: true, hungryPlanFrom: "2026-10-06" });
    const v = viewOf("2026-10-06", { set: off });
    expect(v.hungry).toBeNull();
    expect(v.hungryOffer).toBeNull();
    expect(v.hungryPlan).toEqual({});
    expect(v.weightPattern).toBeNull();
    expect(v.water).toBeNull();
    expect(v.noisyWeightDates).toEqual([]);
  });
});

describe("the plan", () => {
  const on = settings({ usualCycleDays: 28, planHungryWeek: true, hungryPlanFrom: "2026-10-06" });

  it("names the days, cuts and extra, and applies to every cycle from then on", () => {
    const plan = viewOf("2026-10-06", { set: on }).hungryPlan;
    expect(plan["2026-10-06"]).toBe(-125);
    expect(plan["2026-10-15"]).toBe(-125);
    expect(plan["2026-10-16"]).toBe(250);
    expect(plan["2026-10-20"]).toBe(250);
    expect(plan["2026-10-21"]).toBeUndefined();
    expect(Object.values(plan).reduce((a, b) => a + b, 0)).toBe(0);
    // The cycle after next, from a yes given long ago: the full spread.
    const next = [...PERIODS, period("2026-10-21")];
    const later = viewOf("2026-11-01", { set: on, periods: next }).hungryPlan;
    expect(Object.keys(later)).toHaveLength(15);
    expect(Object.values(later).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("when her period actually starts, the prediction moves on and the extra stops", () => {
    const early = [...PERIODS, { ...period("2026-10-17"), end: null }];
    expect(viewOf("2026-10-17", { set: on, periods: early }).hungryPlan["2026-10-17"]).toBeUndefined();
  });

  it("switched off or in a mode that shouldn't have it, plans nothing", () => {
    const off = settings({ usualCycleDays: 28, planHungryWeek: false, hungryPlanFrom: null });
    expect(viewOf("2026-10-06", { set: off }).hungryPlan).toEqual({});
    expect(viewOf("2026-10-06", { set: on, conditions: ["pregnancy"] }).hungryPlan).toEqual({});
    expect(viewOf("2026-10-06", { set: on, age: 17 }).hungryPlan).toEqual({});
  });
});

describe("the ledger", () => {
  const today = "2026-10-17";

  it("freezes the past, and today and the future follow the plan", () => {
    const prev = { "2026-10-16": 250, "2026-10-17": 250, "2026-10-18": 250 };
    expect(mergeHungryLedger(prev, {}, today)).toEqual({ "2026-10-16": 250 });
    expect(mergeHungryLedger(prev, { "2026-10-17": 100 }, today)).toEqual({ "2026-10-16": 250, "2026-10-17": 100 });
  });

  it("drops what no chart can show any more", () => {
    expect(mergeHungryLedger({ "2026-05-01": 250, "2026-10-01": -125 }, {}, today)).toEqual({ "2026-10-01": -125 });
  });

  it("returns the same object when nothing changed, so nothing is written", () => {
    const prev = { "2026-10-16": 250, "2026-10-17": 250 };
    expect(mergeHungryLedger(prev, { "2026-10-17": 250 }, today)).toBe(prev);
  });

  it("survives a round trip through storage, and drops what it can't trust", () => {
    const n = normalizeSettings({
      planHungryWeek: true,
      hungryPlanFrom: "2026-10-06",
      hungryDeclined: true,
      hungryLedger: { "2026-10-06": -125, soon: 5, "2026-10-07": "lots" },
    });
    expect(n.planHungryWeek).toBe(true);
    expect(n.hungryPlanFrom).toBe("2026-10-06");
    expect(n.hungryDeclined).toBe(true);
    expect(n.hungryLedger).toEqual({ "2026-10-06": -125 });
    expect(normalizeSettings({}).planHungryWeek).toBe(false);
  });

  it("goes out with the export, like everything else stored", () => {
    const data = {
      settings: settings({ planHungryWeek: true, hungryPlanFrom: "2026-10-06", hungryLedger: { "2026-10-06": -125, "2026-10-16": 250 } }),
      periods: [],
      days: {},
    };
    const csv = cycleCsv(data);
    expect(csv).toContain("hungrier_week_plan,2026-10-06,,,,,,,on");
    expect(csv).toContain("target_change,2026-10-06,,,,,,,calorie target -125 kcal");
    expect(csv).toContain("target_change,2026-10-16,,,,,,,calorie target +250 kcal");
  });
});

describe("every reader agrees", () => {
  const adjustments = { "2026-10-16": { kcal: 250, reason: "cycle" as const }, "2026-10-06": { kcal: -125, reason: "cycle" as const } };

  it("reads a date's target through one place", () => {
    expect(dayCalorieTarget(2000, "2026-10-16", adjustments)).toBe(2250);
    expect(dayCalorieTarget(2000, "2026-10-06", adjustments)).toBe(1875);
    expect(dayCalorieTarget(2000, "2026-10-10", adjustments)).toBe(2000);
    expect(dayCalorieDelta("2026-10-10", adjustments)).toBe(0);
  });

  it("is published and read live, and clears on sign-out", () => {
    let heard = 0;
    const off = subscribeDayAdjustments(() => {
      heard += 1;
    });
    publishDayAdjustments(adjustments);
    expect(dayAdjustmentsSnapshot()).toBe(adjustments);
    expect(dayCalorieTarget(2000, "2026-10-16")).toBe(2250);
    publishDayAdjustments({});
    expect(dayCalorieTarget(2000, "2026-10-16")).toBe(2000);
    expect(heard).toBe(2);
    off();
  });

  it("shows a small note, and never a debt", () => {
    expect(dayTargetNote(250)).toBe("+250 · hungrier week");
    expect(dayTargetNote(-125)).toBe("−125 · evened out");
    expect(dayTargetNote(0)).toBeNull();
  });

  it("the trend measures a planned day against its own target", () => {
    const row = (date: string): DietHistoryEntry =>
      ({ date, consumedCalories: 2250, consumedProteinG: 90, consumedCarbsG: 200, consumedFatG: 70 }) as never;
    const trend = buildNutritionTrend(
      [row("2026-10-16"), row("2026-10-17")],
      "2026-10-20",
      7,
      { calories: 2000, proteinG: 100, carbsG: 250, fatG: 70 },
      (d) => dayCalorieDelta(d, adjustments),
    );
    const byDate = new Map(trend.days.map((d) => [d.date, d]));
    expect(byDate.get("2026-10-16")?.pct.calories).toBe(100);
    expect(byDate.get("2026-10-17")?.pct.calories).toBe(113);
    // Only calories move.
    expect(byDate.get("2026-10-16")?.pct.protein).toBe(90);
  });

  const twin = (over: object) =>
    buildTwin({
      bio: null,
      targets: { calories: 2000, proteinG: 100 } as never,
      consumed: { calories: 2300, proteinG: 90, fatG: 0, carbsG: 0, waterMl: 0 },
      waterGoalMl: 2500,
      todayDiet: { hasScheduledDiet: true } as never,
      workoutSession: null,
      workoutDoneToday: false,
      workoutPlan: null,
      workoutLog: [],
      sessionHistory: [],
      dietHistory: [],
      bodyLogs: [],
      streak: { currentStreak: 0, totalActiveDays: 0 } as never,
      goals: {} as never,
      now: new Date(2026, 9, 16, 12),
      ...over,
    });

  it("the coach reads today's own target, and doesn't flag going over on a planned day", () => {
    expect(twin({}).flags).toContain("OVER_CALORIES");
    const planned = twin({ dayCalorieTarget: 2250, easyOnCalories: true });
    expect(planned.today.calories.target).toBe(2250);
    expect(planned.flags).not.toContain("OVER_CALORIES");
    // A big overshoot on a planned day still isn't told off.
    expect(twin({ dayCalorieTarget: 2250, easyOnCalories: true, consumed: { calories: 2600, proteinG: 90, fatG: 0, carbsG: 0, waterMl: 0 } }).flags).not.toContain("OVER_CALORIES");
  });

  it("the coach insight never says 'lighter tomorrow' on a planned day", () => {
    const base = {
      bio: { primaryGoal: "lose_weight" } as never,
      targets: { calories: 2000, proteinG: 100 } as never,
      consumed: { calories: 2500, proteinG: 90, fatG: 0, carbsG: 0, waterMl: 0 },
      waterGoalMl: 2500,
      todayDiet: { hasScheduledDiet: true, schedule: {} } as never,
      workoutSession: null,
      workoutDoneToday: false,
      streak: { currentStreak: 0, totalActiveDays: 0 } as never,
      now: new Date(2026, 9, 16, 12),
    };
    const ids = (ctx: object) => generateCoachInsights({ ...base, ...ctx } as never).map((i) => i.id);
    expect(ids({})).toContain("over-cal");
    expect(ids({ easyOnCalories: true })).not.toContain("over-cal");
  });
});

describe("how it is said", () => {
  it("never says anything about making up for food", () => {
    const v = viewOf("2026-10-06");
    const page = CYCLE_LIBRARY["food-and-iron"].sections.find((s) => s.heading === "If your own logs show it")!;
    const said = [
      v.hungryOffer!.text,
      v.hungryOffer!.detail,
      viewOf("2026-10-13").hungryOffer!.detail,
      hungryTodayLine(250),
      hungryTodayLine(-125),
      dayTargetNote(250),
      dayTargetNote(-125),
      ...(page.body ?? []),
    ].join(" ");
    expect(said).not.toMatch(/make up for|compensate|earn|burn off|burn it|cheat|damage|penalty|pay for|deserve|guilt/i);
  });

  it("tells the coach what she chose, and how not to talk about it", () => {
    expect(hungryForCoach(false, 0)).toBeNull();
    const v = viewOf("2026-10-16");
    const lines = cycleStateLines(
      buildCycleBrief({ status: v.status, prediction: v.prediction, showFertileWindow: false, hungryPlan: { on: true, todayKcal: 250 } }),
    ).join(" ");
    expect(lines).toContain("she chose to plan for the hungrier days before her period, keeping her total the same");
    expect(lines).toContain("today's calorie target is 250 kcal higher for it");
    expect(lines).toContain("Never frame eating on those days as something to make up for");
  });
});

describe("the reading page says what the code does", () => {
  const section = CYCLE_LIBRARY["food-and-iron"].sections.find((s) => s.heading === "If your own logs show it")!;
  const text = (section.body ?? []).join(" ");

  it("quotes the same numbers the plan uses", () => {
    expect(text).toContain(`${HUNGRY_PRE_DAYS} days before a period`);
    expect(text).toContain(`at least ${HUNGRY_MIN_DIFF} kcal`);
    expect(text).toContain("at least two cycles");
    expect(text).toContain("at least half of the cycles");
    expect(text).toContain(`up to ${HUNGRY_MAX_EXTRA} kcal`);
    expect(text).toContain(`the ${HUNGRY_SPREAD_DAYS} days before them`);
    expect(text).toContain(`never more than ${HUNGRY_MAX_CUT} kcal less`);
    expect(text).toContain("Your total stays the same");
    expect(text).toContain("only ever an offer");
  });
});
