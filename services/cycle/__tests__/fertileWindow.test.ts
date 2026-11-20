/**
 * AN HONEST FERTILE WINDOW (2026-11-20, Fix 2).
 *
 * Before: always exactly 7 days, from day one, whatever her cycles did. Now
 * ovulation is a distribution (./predict fertileSpan): the window is every day
 * a plausible ovulation would make fertile, so it widens with uncertainty and
 * never narrows; its core is the days more likely fertile than not; her own
 * signs this cycle narrow it; and each cycle further ahead is wider still.
 */
import { describe, expect, it } from "vitest";

import { cycleEventSpecs } from "../../calendar/events";
import { fertileWindowNote, phaseLabel } from "../copy";
import { addDays, daysBetween } from "../dates";
import {
  fertileSpan,
  predict,
  projectAhead,
  todayStatus,
  WIDE_WINDOW_DAYS,
  type CycleProfile,
  type Prediction,
} from "../predict";
import { computeView } from "../view";
import { paintDays } from "../visual";
import { day, days, history, period, settings } from "./helpers";

const ADULT: CycleProfile = { age: 30, conditions: [] };
const S = settings({ usualCycleDays: 28, usualPeriodDays: 5, showFertileWindow: true });
const width = (x: { fertileStart: string; fertileEnd: string } | { start: string; end: string }) =>
  "start" in x ? daysBetween(x.start, x.end) + 1 : daysBetween(x.fertileStart, x.fertileEnd) + 1;

function at(lengths: number[], logs = {}, profile = ADULT): { p: Prediction; last: string; today: string } {
  const eps = history("2026-01-04", lengths);
  const last = eps[eps.length - 1].start;
  const today = addDays(last, 2);
  return { p: predict({ episodes: eps, days: logs, settings: S, today, profile })!, last, today };
}

describe("the window widens with uncertainty", () => {
  it("never narrows as the spread grows, and the core sits inside it", () => {
    const ov = "2026-06-20";
    let previous = 0;
    for (let sd = 0.5; sd <= 12; sd += 0.25) {
      const span = fertileSpan(ov, sd, null);
      expect(width(span)).toBeGreaterThanOrEqual(previous);
      previous = width(span);
      if (span.core) {
        expect(span.core.start >= span.start && span.core.end <= span.end).toBe(true);
      }
    }
    expect(previous).toBeGreaterThan(7);
  });

  it("is 7 days around a well-known ovulation, all of them likely", () => {
    const span = fertileSpan("2026-06-20", 1, null);
    expect([span.start, span.end]).toEqual(["2026-06-15", "2026-06-21"]);
    expect(span.core).toEqual({ start: "2026-06-15", end: "2026-06-21" });
  });

  it("a very uncertain ovulation: wide, and no day more likely fertile than not", () => {
    const span = fertileSpan("2026-06-20", 8, null);
    expect(width(span)).toBeGreaterThanOrEqual(17);
    expect(span.core).toBeNull();
  });

  it("never reaches back into the period it follows", () => {
    const span = fertileSpan("2026-06-10", 6, "2026-06-06");
    expect(span.start).toBe("2026-06-06");
    expect(span.core === null || span.core.start >= "2026-06-06").toBe(true);
  });
});

describe("her cycles decide it", () => {
  it("regular (six 28s): 7 days; variable (24–40): 14+; told only: wide", () => {
    expect(width(at([28, 28, 28, 28, 28, 28]).p)).toBe(7);
    expect(width(at([24, 35, 27, 40, 26, 33]).p)).toBeGreaterThanOrEqual(14);
    const told = predict({ episodes: [period("2026-10-01")], days: {}, settings: S, today: "2026-10-03", profile: ADULT })!;
    expect(width(told)).toBeGreaterThan(7);
  });

  it("says why when it is wide, and calls a told-only window rough — never 'safe'", () => {
    const variable = at([24, 35, 27, 40, 26, 33]).p;
    expect(width(variable)).toBeGreaterThan(WIDE_WINDOW_DAYS);
    expect(fertileWindowNote(variable)).toBe("Wide because your cycles vary. Ovulation tests narrow it.");
    const told = predict({ episodes: [period("2026-10-01")], days: {}, settings: S, today: "2026-10-03", profile: ADULT })!;
    expect(fertileWindowNote(told)).toMatch(/^A rough window/);
    expect(fertileWindowNote(at([28, 28, 28, 28, 28, 28]).p)).toBeNull();
    for (const line of [fertileWindowNote(variable), fertileWindowNote(told)]) expect(line).not.toMatch(/safe/i);
  });

  it("a positive test this cycle narrows it back to 7 days", () => {
    const { p: plain, last } = at([24, 35, 27, 40, 26, 33]);
    const tested = at([24, 35, 27, 40, 26, 33], days(day(addDays(last, 13), { ovulationTest: "positive" }))).p;
    expect(width(plain)).toBeGreaterThan(7);
    // The test is in the future relative to `at`'s today (last + 2), so date it from a later today.
    const later = predict({
      episodes: history("2026-01-04", [24, 35, 27, 40, 26, 33]),
      days: days(day(addDays(last, 13), { ovulationTest: "positive" })),
      settings: S,
      today: addDays(last, 15),
      profile: ADULT,
    })!;
    expect(later.testBasis).toBe("positive");
    expect(width(later)).toBe(7);
    expect(tested.testBasis).toBeNull();
  });

  it("hormonal contraception and pregnancy: no window at all", () => {
    const hormonal = settings({ showFertileWindow: true, contraception: { answer: "hormonal", since: "2026-01-01", restartFrom: null } });
    const eps = history("2026-01-04", [28, 28, 28]);
    expect(predict({ episodes: eps, days: {}, settings: hormonal, today: "2026-04-01", profile: ADULT })).toBeNull();
    expect(predict({ episodes: eps, days: {}, settings: S, today: "2026-04-01", profile: { conditions: ["pregnancy"] } })).toBeNull();
  });
});

describe("each cycle further ahead is wider", () => {
  const { p } = at([25, 32, 27, 34, 24, 31]);

  it("the period window and the fertile window both widen, and the core never grows", () => {
    const one = projectAhead(p, 1);
    const two = projectAhead(p, 2);
    expect(daysBetween(one.period.earliest, one.period.latest)).toBeGreaterThanOrEqual(2 * p.halfWidth);
    expect(daysBetween(two.period.earliest, two.period.latest)).toBeGreaterThanOrEqual(
      daysBetween(one.period.earliest, one.period.latest),
    );
    expect(width(one.fertile)).toBeGreaterThanOrEqual(width(p));
    expect(width(two.fertile)).toBeGreaterThanOrEqual(width(one.fertile));
  });

  it("afterNext is the first of them: the phone calendar's rough mark and the trip check read it", () => {
    expect(p.afterNext).toEqual(projectAhead(p, 1).period);
  });

  it("the calendar draws the likeliest days strongest and the rest lighter", () => {
    const { p: wide, last, today } = at([24, 35, 27, 40, 26, 33]);
    const eps = history("2026-01-04", [24, 35, 27, 40, 26, 33]);
    const view = computeView({ settings: S, periods: eps, days: {} }, { today, profile: ADULT });
    const paint = paintDays({ episodes: eps, days: {}, view, today, showFertile: true });
    const inWindow = [];
    for (let d = wide.fertileStart; d <= wide.fertileEnd; d = addDays(d, 1)) inWindow.push(paint(d));
    expect(inWindow.every((x) => x.fertile)).toBe(true);
    expect(inWindow.some((x) => !x.fertileCore)).toBe(true);
    expect(last < wide.fertileStart).toBe(true);
  });

  it("the phone calendar's fertile note says why a wide window is wide", () => {
    const { p: wide, today } = at([24, 35, 27, 40, 26, 33]);
    const specs = cycleEventSpecs({ prediction: wide, discreet: false, fertileWindow: true, today });
    expect(specs.find((x) => x.key === "c:w1")?.notes).toMatch(/wide because your cycles vary/);
    const rough = specs.find((x) => x.key === "c:p2")!;
    const after = wide.afterNext!;
    expect(rough.notes).toContain(`anywhere from ${after.earliest} to ${after.latest}`);
  });
});

describe("the phase follows the best estimate; the label follows the window", () => {
  const eps = history("2026-01-04", [24, 35, 27, 40, 26, 33]);
  const last = eps[eps.length - 1].start;

  it("two days after the estimated ovulation, inside a wide window", () => {
    const probe = predict({ episodes: eps, days: {}, settings: S, today: addDays(last, 2), profile: ADULT })!;
    const today = addDays(probe.ovulation, 2);
    const input = { episodes: eps, days: {}, settings: S, today, profile: ADULT };
    const p = predict(input)!;
    const st = todayStatus(input, p);
    expect(today <= p.fertileEnd).toBe(true);
    expect(st.phase).toBe("luteal");
    expect(st.inFertileWindow).toBe(true);
    expect(phaseLabel({ status: st }, true)).toBe("Fertile window (estimate)");
    expect(phaseLabel({ status: st }, false)).toMatch(/^Luteal phase/);
  });
});
