/**
 * HOW MUCH SHE IS BELIEVED (2026-11-20: Fixes 4, 6 and 9).
 *
 *   · her setup answer is worth PRIOR_CYCLES cycles and fades by PRIOR_FADE
 *     with each cycle she logs, whatever her spread (Fix 4)
 *   · the textbook second half is 13 days (Fix 6)
 *   · a long gap she hasn't answered about is left out of the forecast but
 *     counts toward the long-cycle note "as if real"; two in her last four are
 *     a pattern and count; the missed-log line starts at 60 days (Fix 9)
 */
import { describe, expect, it } from "vitest";

import { addDays, daysBetween } from "../dates";
import { gapQuestions } from "../flags";
import {
  buildCycles,
  DEFAULT_LUTEAL_DAYS,
  GAP_MIN_DAYS,
  gapThreshold,
  predict,
  PRIOR_CYCLES,
  PRIOR_FADE,
  todayStatus,
  type CycleProfile,
} from "../predict";
import { planCycleReminders } from "../reminderPlan";
import { computeView } from "../view";
import { history, settings } from "./helpers";

const ADULT: CycleProfile = { age: 30, conditions: [] };
const told = (usualCycleDays: number | null) => settings({ usualCycleDays });

function at(lengths: number[], usual: number | null, profile = ADULT) {
  const eps = history("2025-06-01", lengths);
  const today = addDays(eps[eps.length - 1].start, 3);
  return predict({ episodes: eps, days: {}, settings: told(usual), today, profile })!;
}

describe("Fix 4: her setup answer fades", () => {
  it("with nothing logged, it is what she said (or the population's 29 when she wasn't sure)", () => {
    expect(at([], 28).meanLength).toBe(28);
    expect(at([], null).meanLength).toBe(29);
    expect(at([], 28).confidence).toBe("told");
  });

  it("after one cycle it still matters, sensibly: told 28, a 33 → about halfway", () => {
    const w = PRIOR_CYCLES.told * PRIOR_FADE;
    const p = at([33], 28);
    expect(p.meanLength).toBeCloseTo((w * 28 + 33) / (w + 1), 6);
    expect(p.meanLength).toBeGreaterThan(29.5);
    expect(p.meanLength).toBeLessThan(31.5);
    expect(p.confidence).toBe("learning");
  });

  it("after two it matters less", () => {
    const one = at([33], 28).meanLength;
    const two = at([33, 33], 28).meanLength;
    expect(two).toBeGreaterThan(one);
    expect(two).toBeLessThan(33);
  });

  it("'not sure' is worth less than a number from the start", () => {
    expect(Math.abs(at([33], null).meanLength - 33)).toBeLessThan(Math.abs(at([33], 28).meanLength - 33));
  });

  it("when what she told us was right, it stays right", () => {
    expect(at([28, 28, 28], 28).cycleLength).toBe(28);
    expect(at([31, 30, 31, 32, 31, 30], 31).cycleLength).toBe(31);
  });

  it("the weight never depends on her spread: PCOS or age move the window, never the middle", () => {
    const lengths = [38, 42, 36, 44, 39, 41];
    const plain = at(lengths, 28);
    const pcos = at(lengths, 28, { age: 30, conditions: ["pcos"] });
    const teen = at(lengths, 28, { age: 17, conditions: [] });
    expect(pcos.meanLength).toBeCloseTo(plain.meanLength, 6);
    expect(teen.meanLength).toBeCloseTo(plain.meanLength, 6);
    expect(pcos.halfWidth).toBeGreaterThanOrEqual(plain.halfWidth);
  });

  it("never says 'told' once anything is logged", () => {
    for (const lengths of [[28], [28, 28], [30, 26, 33]]) expect(at(lengths, 28).confidence).not.toBe("told");
  });
});

describe("Fix 6: the textbook second half", () => {
  it("is 13 days: ovulation sits 13 days before the likely start", () => {
    const p = at([28, 28, 28], 28);
    expect(DEFAULT_LUTEAL_DAYS).toBe(13);
    expect(p.lutealDays).toBe(13);
    expect(daysBetween(p.ovulation, p.likely)).toBe(13);
  });
});

describe("Fix 9: long gaps", () => {
  const S = told(28);

  it(`the missed-log line is max(${GAP_MIN_DAYS}, 1.75 × usual)`, () => {
    expect(gapThreshold(28)).toBe(GAP_MIN_DAYS);
    expect(gapThreshold(40)).toBe(70);
  });

  it("one 70-day gap: out of the forecast, still asked about", () => {
    const eps = history("2026-01-01", [28, 28, 70, 28]);
    const today = addDays(eps[eps.length - 1].start, 5);
    const cycles = buildCycles(eps, S, today);
    expect(cycles.map((c) => c.status)).toEqual(["counted", "counted", "gap", "counted"]);
    expect(predict({ episodes: eps, days: {}, settings: S, today, profile: ADULT })!.recentLengths).not.toContain(70);
    expect(gapQuestions(cycles).map((c) => c.length)).toEqual([70]);
  });

  it("two unanswered gaps in her last four: counted, flagged, and still asked about", () => {
    const eps = history("2025-10-01", [28, 28, 64, 28, 66]);
    const today = addDays(eps[eps.length - 1].start, 5);
    const cycles = buildCycles(eps, S, today);
    const long = cycles.filter((c) => c.length > 60);
    expect(long.every((c) => c.status === "counted" && c.assumedLong)).toBe(true);
    expect(predict({ episodes: eps, days: {}, settings: S, today, profile: ADULT })!.recentLengths).toEqual(
      expect.arrayContaining([64, 66]),
    );
    expect(gapQuestions(cycles).map((c) => c.length)).toEqual([64, 66]);
  });

  it("an older gap outside her last four stays a gap", () => {
    const eps = history("2025-01-01", [70, 28, 28, 28, 28, 65, 28, 66]);
    const today = addDays(eps[eps.length - 1].start, 5);
    const cycles = buildCycles(eps, S, today);
    expect(cycles[0].status).toBe("gap");
    expect(cycles.filter((c) => c.assumedLong).map((c) => c.length)).toEqual([65, 66]);
  });

  it("an answered gap behaves as before: 'long' counts, 'pause' never does, and neither is asked again", () => {
    const eps = history("2026-01-01", [28, 28, 70, 28]);
    const today = addDays(eps[eps.length - 1].start, 5);
    const start = eps[2].start;
    const long = buildCycles(eps, told(28), today);
    expect(long[2].status).toBe("gap");
    const yes = buildCycles(eps, settings({ usualCycleDays: 28, gapNotes: { [start]: "long" } }), today);
    expect([yes[2].status, yes[2].confirmedLong, yes[2].assumedLong]).toEqual(["counted", true, false]);
    expect(gapQuestions(yes)).toEqual([]);
    const pause = buildCycles(eps, settings({ usualCycleDays: 28, gapNotes: { [start]: "pause" } }), today);
    expect(pause[2].status).toBe("pause");
    expect(gapQuestions(pause)).toEqual([]);
  });

  it("a 45–59 day cycle counts, as it should with PCOS or in the first years", () => {
    const eps = history("2025-06-01", [40, 52, 44, 58, 41]);
    const cycles = buildCycles(eps, told(null), addDays(eps[eps.length - 1].start, 5));
    expect(cycles.every((c) => c.status === "counted")).toBe(true);
  });

  it("the lean reminder path reads the same cycles as the view", () => {
    const eps = history("2025-10-01", [28, 28, 64, 28, 66]);
    const today = addDays(eps[eps.length - 1].start, 20);
    const data = { settings: S, periods: eps, days: {} };
    const view = computeView(data, { today, profile: ADULT });
    const lean = { episodes: data.periods, days: data.days, settings: data.settings, today, profile: ADULT };
    const prediction = predict(lean);
    expect(prediction).toEqual(view.prediction);
    const now = new Date(2026, 4, 1, 8);
    expect(planCycleReminders({ settings: S, status: todayStatus(lean, prediction), prediction, now })).toEqual(
      planCycleReminders({ settings: S, status: view.status, prediction: view.prediction, now }),
    );
  });
});
