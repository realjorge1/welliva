/**
 * LATE IS INFORMATION (2026-11-20, Fix 3).
 *
 * Before: ten days late on a 28-day history it still said "next period in 16
 * days" and "ovulation in 2 days" — the calendar and the phone calendar kept
 * projecting from the date she had already passed. Now, past the window she
 * was given with no new period: the forward window rolls ("any day now", from
 * today), nothing is projected a cycle on, this cycle's ovulation is
 * unconfirmed unless a test or her temperature dated it — and "late by", the
 * reminders, the receipt and the pregnancy-test advice all keep counting
 * against the window she was GIVEN.
 */
import { describe, expect, it } from "vitest";

import { cycleEventSpecs } from "../../calendar/events";
import { classifyFlowDay } from "../bleeding";
import { cycleHeadline, glanceConfidence } from "../copy";
import { addDays, daysBetween } from "../dates";
import { lateContext, PREGNANCY_TEST_LINE } from "../late";
import { shareDatesLine, startReceipt } from "../nextDates";
import { givenWindow, LATE_WINDOW_AHEAD, predict, todayStatus, type CycleProfile } from "../predict";
import { planCycleReminders } from "../reminderPlan";
import type { CycleSettings, PeriodEpisode } from "../types";
import { computeView } from "../view";
import { dialModel, paintDays } from "../visual";
import { day, days, history, settings } from "./helpers";

const ADULT: CycleProfile = { age: 30, conditions: [] };
const EPS = history("2026-03-04", [28, 28, 28, 28, 28, 28]); // last start 2026-08-19
const LAST = "2026-08-19";
const S: CycleSettings = settings({ usualCycleDays: 28, usualPeriodDays: 5, showFertileWindow: true });
const view = (today: string, extra: Partial<{ periods: PeriodEpisode[]; set: CycleSettings; profile: CycleProfile }> = {}) =>
  computeView(
    { settings: extra.set ?? S, periods: extra.periods ?? EPS, days: {} },
    { today, profile: extra.profile ?? ADULT },
  );
const SIGNALS = { mind: [], workouts: [], intake: [], weighIns: [], events: [] };

describe.each([3, 10, 40])("%i days late", (late) => {
  const onTime = view(addDays(LAST, 20)).prediction!;
  const today = addDays(onTime.latest, late);
  const v = view(today);
  const p = v.prediction!;

  it("late by counts from the window she was given", () => {
    expect(v.status.lateBy).toBe(late);
    expect(p.overdue).toEqual({ days: late, original: { earliest: onTime.earliest, likely: onTime.likely, latest: onTime.latest } });
    expect(givenWindow(p)).toEqual({ earliest: onTime.earliest, likely: onTime.likely, latest: onTime.latest });
  });

  it("the forward window is 'any day now': from today, never earlier", () => {
    expect([p.earliest, p.likely, p.latest]).toEqual([today, addDays(today, 1), addDays(today, LATE_WINDOW_AHEAD)]);
    expect(cycleHeadline(v, true).title).toBe(`Late by ${late} ${late === 1 ? "day" : "days"}`);
    expect(glanceConfidence(v)).toBeNull();
    expect(shareDatesLine(p)).toBeNull();
  });

  it("nothing projected a cycle on, and no fertile window this cycle", () => {
    expect(p.afterNext).toBeNull();
    expect(p.fertileKnown).toBe(false);
    const paint = paintDays({ episodes: EPS, days: {}, view: v, today, showFertile: true });
    const ahead = Array.from({ length: 80 }, (_, i) => addDays(today, i));
    expect(ahead.filter((d) => paint(d).period === "predicted").every((d) => daysBetween(today, d) <= LATE_WINDOW_AHEAD + p.periodLength)).toBe(true);
    expect(ahead.some((d) => paint(d).fertile)).toBe(false);
    const dial = dialModel({ episodes: EPS, view: v, today, showFertile: true });
    expect(dial.arcs.some((a) => a.kind === "fertile")).toBe(false);
    expect(dial.ovulation).toBeNull();
    // The window she was given still shows on the dial, behind her.
    const given = dial.arcs.find((a) => a.kind === "predicted")!;
    expect(given.to).toBeLessThan(v.status.cycleDay!);
  });

  it("the phone calendar: one 'any day now' block, never the rough mark or the window", () => {
    const plain = cycleEventSpecs({ prediction: p, discreet: false, fertileWindow: true, today });
    expect(plain.map((x) => x.key)).toEqual(["c:p1"]);
    expect(plain[0].title).toBe("Period any day now");
    const discreet = cycleEventSpecs({ prediction: p, discreet: true, fertileWindow: true, today });
    expect(`${discreet[0].title} ${discreet[0].notes}`).not.toMatch(/period|fertil|late/i);
  });

  it("the check-in isn't laid again each morning: it was timed off the window she was given", () => {
    for (const offset of [0, 1, 2]) {
      const d = addDays(today, offset);
      const vv = view(d);
      const now = new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), 8);
      expect(planCycleReminders({ settings: S, status: vv.status, prediction: vv.prediction, now })).toEqual([]);
    }
  });

  it("the lean reminder path reads the same as the view", () => {
    const lean = { episodes: EPS, days: {}, settings: S, today, profile: ADULT };
    const prediction = predict(lean);
    expect(prediction).toEqual(v.prediction);
    expect(todayStatus(lean, prediction)).toEqual(v.status);
  });

  it("never softens the late-period advice: the pregnancy-test line is there", () => {
    const ctx = lateContext({ mode: v.mode, status: v.status, cycles: v.cycles, today, signals: SIGNALS })!;
    expect(ctx.nextSteps).toContain(PREGNANCY_TEST_LINE);
    expect(PREGNANCY_TEST_LINE).toMatch(/reliable from the day your period was due/);
  });

  it("the trip check and the hungrier-week plan stand down", () => {
    expect(v.comingUp).toEqual([]);
    expect(v.hungryOffer).toBeNull();
  });

  it("any flow now can be her period", () => {
    expect(
      classifyFlowDay({ date: today, flow: "light", episodes: EPS, days: {}, prediction: p, mode: "normal", today, typicalBleed: 5 }),
    ).toBe("starts");
  });
});

describe("late, with a positive test this cycle", () => {
  it("the test dated ovulation, so its window can still show; late counts from the test's window", () => {
    const logs = days(day(addDays(LAST, 15), { ovulationTest: "positive" }));
    const atTest = predict({ episodes: EPS, days: logs, settings: S, today: addDays(LAST, 17), profile: ADULT })!;
    const today = addDays(atTest.latest, 4);
    const p = predict({ episodes: EPS, days: logs, settings: S, today, profile: ADULT })!;
    expect(p.overdue?.original.latest).toBe(atTest.latest);
    expect(p.fertileKnown).toBe(true);
    expect(todayStatus({ episodes: EPS, days: logs, settings: S, today, profile: ADULT }, p).lateBy).toBe(4);
  });
});

describe("then the period comes", () => {
  it("the next forecast counts from it, and the receipt says how late it was", () => {
    const onTime = view(addDays(LAST, 20)).prediction!;
    const start = addDays(onTime.latest, 6);
    // Saved on the day it started (the receipt is said on the day she logs it).
    const arrived: PeriodEpisode = { id: "arrived", start, end: null, updatedAt: `${start}T12:00:00.000Z` };
    const v = view(start, { periods: [...EPS, arrived] });
    expect(v.prediction!.lastStart).toBe(start);
    expect(v.prediction!.overdue).toBeNull();
    expect(v.status.lateBy).toBe(0);
    expect(v.prediction!.afterNext).not.toBeNull();
    const receipt = startReceipt({ episodes: [...EPS, arrived], days: {}, settings: S, profile: ADULT, today: start });
    expect(receipt?.startsWith(`It came 6 days after the window we gave (${receiptRange(onTime.earliest, onTime.latest)}).`)).toBe(
      true,
    );
  });
});

function receiptRange(a: string, b: string): string {
  // ./dates formatRange, spelled out so the test doesn't hide behind the function it checks.
  const m = (iso: string) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(iso.slice(5, 7)) - 1];
  const d = (iso: string) => Number(iso.slice(8, 10));
  return m(a) === m(b) ? `${d(a)}–${d(b)} ${m(b)}` : `${d(a)} ${m(a)} – ${d(b)} ${m(b)}`;
}

describe("modes", () => {
  const today = addDays(LAST, 45);

  it("postpartum predicts, so it can be late", () => {
    const set = settings({ usualCycleDays: 28, postpartumSince: "2026-01-01" });
    expect(view(today, { set, profile: { age: 30, conditions: ["postpartum"] } }).prediction!.overdue).not.toBeNull();
  });

  it("hormonal, pregnancy and menopause are never 'late'", () => {
    const hormonal = settings({ usualCycleDays: 28, contraception: { answer: "hormonal", since: "2026-01-01", restartFrom: null } });
    expect(view(today, { set: hormonal }).prediction).toBeNull();
    expect(view(today, { profile: { conditions: ["pregnancy"] } }).prediction).toBeNull();
    const meno = view(today, { profile: { age: 52, conditions: ["menopause"] } });
    expect(meno.prediction?.overdue ?? null).toBeNull();
    expect(meno.status.lateBy).toBe(0);
  });
});
