/**
 * A POSITIVE OVULATION TEST UPDATES THIS MONTH'S DATES (2026-11-13).
 *
 * Before this, a positive test only counted once two whole cycles had one
 * (personalLuteal), so the dial's ovulation dot could sit days away from the
 * test she had just logged. Now the test is evidence about THIS cycle: the
 * likely start becomes test + 1 + her luteal length, whatever the calendar said.
 */
import { describe, expect, it } from "vitest";

import { confidenceLine, confidenceWord, glanceConfidence } from "../copy";
import { addDays, daysBetween, formatDay } from "../dates";
import {
  DEFAULT_LUTEAL_DAYS,
  LIVE_TEST_MIN_DAY,
  predict,
  TEST_HALF_WIDTH,
  todayStatus,
  type CycleProfile,
  type PredictInput,
} from "../predict";
import { planCycleReminders } from "../reminderPlan";
import type { CycleDays } from "../types";
import { computeView } from "../view";
import { day, days, history, settings } from "./helpers";

/** Starts 1 Jul, 29 Jul, 26 Aug, 23 Sep: three 28-day cycles. Calendar: likely 21 Oct, 18–24 Oct. */
const PERIODS = history("2026-07-01", [28, 28, 28]);
const LAST_START = "2026-09-23";
const TODAY = "2026-10-12"; // cycle day 20

function input(logs: CycleDays = {}, profile: CycleProfile = { age: 30, conditions: [] }, today = TODAY): PredictInput {
  return { episodes: PERIODS, days: logs, settings: settings({ showFertileWindow: true }), today, profile };
}
const positive = (date: string) => day(date, { ovulationTest: "positive" });

describe("the calendar, before any test", () => {
  it("is what the test cases move from", () => {
    const p = predict(input())!;
    expect(p.likely).toBe("2026-10-21");
    expect([p.earliest, p.latest]).toEqual(["2026-10-18", "2026-10-24"]);
    expect(p.fromTest).toBeNull();
  });
});

describe("a positive test this cycle", () => {
  it("a regular cycle: ovulation the day after the test, the period a luteal phase later", () => {
    const p = predict(input(days(positive("2026-10-06"))))!;
    expect(p.fromTest).toBe("2026-10-06");
    expect(p.ovulation).toBe("2026-10-07");
    expect(p.likely).toBe(addDays("2026-10-07", DEFAULT_LUTEAL_DAYS));
    // On the textbook 14, the luteal phase's own 11–16 day spread: ±3.
    expect(p.halfWidth).toBe(TEST_HALF_WIDTH.default);
    expect([p.earliest, p.latest]).toEqual(["2026-10-18", "2026-10-24"]);
  });

  it("a late ovulation moves the period later, and the fertile window with it", () => {
    const p = predict(input(days(positive("2026-10-12"))))!;
    expect(p.ovulation).toBe("2026-10-13");
    expect(p.likely).toBe("2026-10-27");
    expect([p.earliest, p.latest]).toEqual(["2026-10-24", "2026-10-30"]);
    expect([p.fertileStart, p.fertileEnd]).toEqual(["2026-10-08", "2026-10-14"]);
    // The dial's circle is this cycle's expected length, so the top is still the likely start.
    const s = todayStatus(input(days(positive("2026-10-12"))), p);
    expect(s.ringDays).toBe(daysBetween(LAST_START, "2026-10-27"));
    // Her usual length still spaces the cycles after this one.
    expect(p.cycleLength).toBe(28);
  });

  it("replaces a narrower calendar window: the test is evidence about this cycle", () => {
    const p = predict(input(days(positive("2026-10-12"))))!;
    expect(p.likely).not.toBe(predict(input())!.likely);
  });

  it("uses her own luteal length once she has one, with a narrower window", () => {
    // Positive tests in two completed cycles, each 12 days before the next start.
    const logs = days(positive("2026-08-13"), positive("2026-09-10"), positive("2026-10-06"));
    const p = predict(input(logs))!;
    expect(p.lutealPersonal).toBe(true);
    expect(p.lutealDays).toBe(12);
    expect(p.likely).toBe("2026-10-19");
    expect(p.halfWidth).toBe(TEST_HALF_WIDTH.personal);
  });

  it("uses the same anchor as the luteal learning: the last positive in the cycle", () => {
    const p = predict(input(days(positive("2026-10-05"), positive("2026-10-06"))))!;
    expect(p.fromTest).toBe("2026-10-06");
  });

  it("ignores a test before day 6 of the cycle: too early to be this cycle's surge", () => {
    const early = addDays(LAST_START, LIVE_TEST_MIN_DAY - 1);
    expect(predict(input(days(positive(early))))!.fromTest).toBeNull();
    const first = addDays(LAST_START, LIVE_TEST_MIN_DAY);
    expect(predict(input(days(positive(first))))!.fromTest).toBe(first);
  });

  it("ignores a test dated in the future (another phone's clock, say)", () => {
    expect(predict(input(days(positive("2026-10-14"))))!.fromTest).toBeNull();
  });

  it("ignores a negative test", () => {
    expect(predict(input(days(day("2026-10-06", { ovulationTest: "negative" }))))!.fromTest).toBeNull();
  });

  it("with PCOS, doesn't move the dates: these tests can read positive without ovulation", () => {
    const pcos = { age: 30, conditions: ["pcos"] };
    const withTest = predict(input(days(positive("2026-10-12")), pcos))!;
    const without = predict(input({}, pcos))!;
    expect(withTest.fromTest).toBeNull();
    expect(withTest.likely).toBe(without.likely);
    expect([withTest.earliest, withTest.latest]).toEqual([without.earliest, without.latest]);
  });

  it("a late period now counts from the new window", () => {
    // Ovulation on day 8 puts the window at 11–17 Oct; on the 20th she's 3 days past it.
    const logs = days(positive("2026-09-29"));
    const late = input(logs, undefined, "2026-10-20");
    const s = todayStatus(late, predict(late));
    expect(s.lateBy).toBe(3);
    expect(s.phase).toBe("late");
    // The calendar alone would still be inside its window.
    const plain = input({}, undefined, "2026-10-20");
    expect(todayStatus(plain, predict(plain)).lateBy).toBe(0);
  });
});

describe("modes", () => {
  it("postpartum: the test counts", () => {
    const p = predict({ ...input(days(positive("2026-10-12"))), profile: { age: 30, conditions: ["postpartum"] } });
    expect(p?.fromTest).toBe("2026-10-12");
  });

  it("menopause: nothing is anchored", () => {
    const p = predict({ ...input(days(positive("2026-10-12"))), profile: { age: 50, conditions: ["menopause"] } });
    expect(p?.fromTest ?? null).toBeNull();
  });

  it("hormonal contraception and pregnancy: nothing is predicted at all", () => {
    const hormonal = { ...input(days(positive("2026-10-12"))) };
    hormonal.settings = settings({ contraception: { answer: "hormonal", since: "2026-06-01", restartFrom: null } });
    expect(predict(hormonal)).toBeNull();
    expect(predict({ ...input(days(positive("2026-10-12"))), profile: { conditions: ["pregnancy"] } })).toBeNull();
  });
});

describe("every reader says where the window came from", () => {
  const p = predict(input(days(positive("2026-10-06"))))!;

  it("the Next period card's line", () => {
    expect(confidenceLine(p)).toBe(`Updated from your ovulation test on ${formatDay("2026-10-06", { weekday: true })}.`);
  });

  it("the glance word on Home, and the trip and hungry-week lines", () => {
    const view = computeView(
      { settings: settings({ showFertileWindow: true }), periods: PERIODS, days: days(positive("2026-10-06")) },
      { today: TODAY, profile: { age: 30, conditions: [] } },
    );
    expect(glanceConfidence(view)).toBe("From your test");
    expect(confidenceWord(p)).toBe("From your test");
  });
});

describe("the lock-screen reminders read the same dates as the screen", () => {
  it("the lean path (predict + todayStatus) and the view agree, test and all", () => {
    const logs = days(positive("2026-10-12"));
    const data = { settings: settings({ showFertileWindow: true }), periods: PERIODS, days: logs };
    const ctx = { today: TODAY, profile: { age: 30, conditions: [] } };
    const view = computeView(data, ctx);
    const lean = { episodes: data.periods, days: data.days, settings: data.settings, ...ctx };
    const prediction = predict(lean);
    expect(prediction).toEqual(view.prediction);
    expect(todayStatus(lean, prediction)).toEqual(view.status);
    const now = new Date(2026, 9, 12, 9, 0, 0);
    expect(planCycleReminders({ settings: data.settings, status: todayStatus(lean, prediction), prediction, now })).toEqual(
      planCycleReminders({ settings: data.settings, status: view.status, prediction: view.prediction, now }),
    );
  });
});
