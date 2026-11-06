/**
 * THE MODES AUDIT — what each smart feature does in each mode, in one table.
 *
 * Each feature's own tests say why. This says WHAT, all together, so a new
 * feature or mode can't slip past the rules by accident:
 *
 *   normal      everything
 *   hormonal    logging only: no window, no fertile days, no "late", no reminders;
 *               "what helped?" still asks, because a symptom is a symptom
 *   pregnancy   paused: nothing at all
 *   postpartum  predictions restart after the birth, so the windows return; the
 *               hungrier-week plan stays off, because calories stay where they are
 *   menopause   logging only, like hormonal
 *
 * docs/cycle/smart-cycle.md prints this same table.
 */
import { describe, expect, it } from "vitest";

import { addDays } from "../dates";
import { lateContext } from "../late";
import { predict } from "../predict";
import { planCycleReminders } from "../reminderPlan";
import { topSuggestion, TRIP_SOON_DAYS, SUGGESTION_ORDER } from "../suggest";
import type { CycleSettings } from "../types";
import type { LifeMoment } from "../upcoming";
import { computeView } from "../view";
import { day, history, period, settings } from "./helpers";

/** Starts 8 Apr … 23 Sep, 28 days apart. Next most likely 21 Oct, window 19–23 Oct. */
const PERIODS = history("2026-04-08", [28, 28, 28, 28, 28, 28]);
const STARTS = PERIODS.map((p) => p.start);

/** Everything each feature needs to have something to say. */
const LOGS = {
  // Cramps on day 1 of every completed cycle, and yesterday's for "what helped?".
  days: Object.fromEntries(
    STARTS.slice(0, 6).map((s) => [s, day(s, { symptoms: ["cramps"] })]),
  ),
  weighIns: STARTS.slice(0, 6).flatMap((s, i) => {
    const next = STARTS[i + 1];
    return [
      { date: addDays(s, 6), kg: 60 },
      { date: addDays(s, 9), kg: 60 },
      { date: addDays(next, -3), kg: 61.2 },
      { date: addDays(next, -1), kg: 61 },
      { date: addDays(next, 3), kg: 60.1 },
    ];
  }),
  intake: STARTS.slice(0, 6).flatMap((s, i) => {
    const next = STARTS[i + 1];
    return [
      ...Array.from({ length: 17 }, (_, k) => ({ date: addDays(s, 5 + k), kcal: 1800 })),
      ...Array.from({ length: 5 }, (_, k) => ({ date: addDays(next, -1 - k), kcal: 2050 })),
    ];
  }),
  moments: [
    { id: "trip", kind: "travel", title: "Lagos trip", start: "2026-10-19", end: "2026-10-24" },
  ] as LifeMoment[],
};

type Mode = "normal" | "hormonal" | "pregnancy" | "postpartum" | "menopause";

function setup(mode: Mode): { set: CycleSettings; conditions: string[] } {
  const base = { usualCycleDays: 28, showFertileWindow: true };
  switch (mode) {
    case "normal":
      return { set: settings(base), conditions: [] };
    case "hormonal":
      return {
        set: settings({ ...base, contraception: { answer: "hormonal", since: "2026-01-01", restartFrom: null } }),
        conditions: [],
      };
    case "pregnancy":
      return { set: settings(base), conditions: ["pregnancy"] };
    case "postpartum":
      return { set: settings({ ...base, postpartumSince: "2026-01-01" }), conditions: ["postpartum"] };
    case "menopause":
      return { set: settings(base), conditions: ["menopause"] };
  }
}

function view(mode: Mode, today: string, extra: Partial<CycleSettings> = {}) {
  const { set, conditions } = setup(mode);
  return computeView(
    { settings: { ...set, ...extra }, periods: PERIODS, days: LOGS.days },
    {
      today,
      profile: { age: 30, conditions },
      moments: LOGS.moments,
      weighIns: LOGS.weighIns,
      intake: LOGS.intake,
      calories: { targetKcal: 2000, floorKcal: 1200 },
    },
  );
}

/** Whether each feature has something to say, on a day it could. */
function features(mode: Mode) {
  const mid = view(mode, "2026-10-06");
  const rising = view(mode, "2026-10-16");
  const lateDay = "2026-10-28";
  const late = view(mode, lateDay);
  const { set, conditions } = setup(mode);
  const input = { episodes: PERIODS, days: LOGS.days, settings: set, today: "2026-10-06", profile: { age: 30, conditions } };
  // A cramp logged the day before, so "what helped?" has something to ask about.
  const asked = computeView(
    { settings: set, periods: PERIODS, days: { "2026-10-05": day("2026-10-05", { symptoms: ["cramps"] }) } },
    { today: "2026-10-06", profile: { age: 30, conditions } },
  );
  return {
    window: mid.status.predicting,
    fertile: mid.showFertile,
    late:
      lateContext({
        mode: late.mode,
        status: late.status,
        cycles: late.cycles,
        today: lateDay,
        signals: { mind: [], workouts: [], intake: [], weighIns: [], events: [] },
      }) !== null,
    trip: rising.comingUp.length > 0,
    water: view(mode, "2026-10-16", {}).weightPattern !== null,
    helped: asked.reliefAsk !== null,
    hungry: mid.hungryOffer !== null,
    reminders:
      planCycleReminders({
        settings: set,
        status: mid.status,
        prediction: predict(input),
        now: new Date(2026, 9, 6, 8),
        moments: LOGS.moments,
      }).length > 0,
  };
}

const ALL = { window: true, fertile: true, late: true, trip: true, water: true, helped: true, hungry: true, reminders: true };
const NONE = { window: false, fertile: false, late: false, trip: false, water: false, helped: false, hungry: false, reminders: false };

describe("what each mode does", () => {
  it("normal: everything", () => {
    expect(features("normal")).toEqual(ALL);
  });

  it("hormonal contraception: logging only, and 'what helped?' still asks", () => {
    expect(features("hormonal")).toEqual({ ...NONE, helped: true });
  });

  it("pregnancy: paused, nothing at all", () => {
    expect(features("pregnancy")).toEqual(NONE);
  });

  it("postpartum: the windows return, the hungrier-week plan doesn't", () => {
    expect(features("postpartum")).toEqual({ ...ALL, hungry: false });
  });

  it("menopause: logging only, and 'what helped?' still asks", () => {
    expect(features("menopause")).toEqual({ ...NONE, helped: true });
  });
});

describe("one suggestion at a time", () => {
  const all = { late: true, trip: true, water: true, relief: true, hungry: true, "trip-later": true };

  it("takes them in the order of the brief", () => {
    expect(SUGGESTION_ORDER).toEqual(["late", "trip", "water", "relief", "hungry", "trip-later"]);
    expect(topSuggestion(all)).toBe("late");
    expect(topSuggestion({ ...all, late: false })).toBe("trip");
    expect(topSuggestion({ water: true, relief: true, hungry: true })).toBe("water");
    expect(topSuggestion({ relief: true, hungry: true })).toBe("relief");
    expect(topSuggestion({ hungry: true })).toBe("hungry");
    expect(topSuggestion({})).toBeNull();
  });

  it(`lets a trip further off than ${TRIP_SOON_DAYS} days wait behind everything else`, () => {
    expect(topSuggestion({ relief: true, "trip-later": true })).toBe("relief");
    expect(topSuggestion({ "trip-later": true })).toBe("trip-later");
  });

  it("on the fullest possible day, still only one wins", () => {
    // Late, with everything else also true: the late section takes the slot.
    const v = view("normal", "2026-10-28");
    expect(v.status.lateBy).toBeGreaterThan(0);
    expect(topSuggestion({ late: true, trip: v.comingUp.length > 0, water: !!v.water, relief: !!v.reliefAsk })).toBe("late");
    // And a period under way keeps the logging surfaces, not a second card.
    const bleeding = computeView(
      { settings: setup("normal").set, periods: [...PERIODS, { ...period("2026-10-20"), end: null }], days: {} },
      { today: "2026-10-21", profile: { age: 30, conditions: [] } },
    );
    expect(bleeding.hungryOffer).toBeNull();
  });
});
