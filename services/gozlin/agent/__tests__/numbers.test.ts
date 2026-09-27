/**
 * What counts as a number, and what counts as rounding it.
 *
 * Both were measured loose by the 2026-09-27 audit against a realistic twin:
 * a spelled-out "three hundred and forty" walked straight past the gate, and
 * the old ±2% / ±1 tolerance accepted 42% of invented whole numbers between 11
 * and 100 — including an 81 kg weigh-in for a real 82.6, which it then gave a
 * receipt. These pin the replacement.
 */

import { describe, expect, it } from "vitest";
import {
  collectAllowedNumbers,
  extractNumbers,
  isRoundingOf,
  numberSpans,
  validateNumbers,
} from "../grounding";

describe("numbers written as words", () => {
  it("reads the ones a coach would write", () => {
    expect(extractNumbers("three hundred and forty calories")).toEqual([340]);
    expect(extractNumbers("sixty-four grams to go")).toEqual([64]);
    expect(extractNumbers("a hundred and twenty minutes")).toEqual([120]);
    expect(extractNumbers("one thousand eight hundred forty")).toEqual([1840]);
    expect(extractNumbers("fifteen hundred a day")).toEqual([1500]);
  });

  it("keeps separate numbers separate", () => {
    expect(extractNumbers("one or two sessions")).toEqual([1, 2]);
    expect(extractNumbers("sets of ten and twelve")).toEqual([10, 12]);
  });

  it("drops ordinals, the same as '27th' is dropped", () => {
    expect(extractNumbers("on the twenty-seventh")).toEqual([]);
    expect(extractNumbers("your third week")).toEqual([]);
  });

  it("closes the spelling loophole in the gate", () => {
    const allowed = collectAllowedNumbers({ consumed: 1840, target: 2200 });
    expect(validateNumbers("Three hundred and forty calories over.", allowed).ok).toBe(false);
    expect(validateNumbers("Eighteen hundred and forty so far.", allowed).ok).toBe(true);
  });

  it("reports where each figure sits, digits and words alike", () => {
    const text = "You're at 1,840 — sixty-four grams short.";
    const spans = numberSpans(text);
    expect(spans.map((s) => text.slice(s.start, s.end))).toEqual(["1,840", "sixty-four"]);
  });
});

describe("dates are not claims", () => {
  it("ignores ISO datetimes, including the twin's own asOf", () => {
    expect(extractNumbers("as of 2026-09-27T14:10:00.000Z")).toEqual([]);
    expect(extractNumbers("at 2026-09-27T15:10:00+01:00")).toEqual([]);
  });

  it("ignores written dates", () => {
    expect(extractNumbers("since Sep 27")).toEqual([]);
    expect(extractNumbers("on 27 September 2026")).toEqual([]);
    expect(extractNumbers("the 3rd of March")).toEqual([]);
  });
});

describe("rounding, tested as rounding", () => {
  it("accepts a figure rounded or truncated at the precision written", () => {
    expect(isRoundingOf(83, 82.6)).toBe(true);
    expect(isRoundingOf(82, 82.6)).toBe(true);
    expect(isRoundingOf(82.6, 82.63)).toBe(true);
    expect(isRoundingOf(0.4, 0.4083)).toBe(true);
  });

  it("rejects a figure a whole unit away — the invented-weigh-in case", () => {
    expect(isRoundingOf(81, 82.6)).toBe(false);
    expect(isRoundingOf(84, 82.6)).toBe(false);
  });

  it("never lets rounding add a digit", () => {
    expect(isRoundingOf(1841, 1840)).toBe(false);
    expect(isRoundingOf(6.6, 6)).toBe(false);
  });

  it("accepts a round number no coarser than a tenth of itself", () => {
    expect(isRoundingOf(1800, 1840)).toBe(true);
    expect(isRoundingOf(100, 96)).toBe(true);
    expect(isRoundingOf(300, 340)).toBe(false);
    expect(isRoundingOf(2000, 2200)).toBe(false);
  });

  it("is not fooled by floating-point noise at the boundary", () => {
    expect(isRoundingOf(0.2, 0.3)).toBe(false);
  });

  it("accepts a stored negative said as its magnitude, and a rate said as a percentage", () => {
    const allowed = collectAllowedNumbers({ change: -0.4083, rate: 0.7156 });
    expect(validateNumbers("down 0.4 kg a week", allowed).ok).toBe(true);
    expect(validateNumbers("about 72% of days", allowed).ok).toBe(true);
    expect(validateNumbers("71.6% of days", allowed).ok).toBe(true);
  });
});

describe("the looseness the audit measured is gone", () => {
  it("rejects most invented whole numbers 11–100 against a realistic evidence set", () => {
    // The shape of evidence one real turn carries: today's figures, momentum,
    // recovery, body, gaps. The old tolerance passed 42% of this range.
    const allowed = collectAllowedNumbers({
      calories: { consumed: 1840, target: 2200, pct: 0.84 },
      protein: { consumed: 86.4, target: 150, pct: 0.58 },
      water: { consumed: 1800, target: 3000, pct: 0.6 },
      streak: 6,
      adherence: 74,
      recovery: 92,
      weight: { current: 82.6, start: 84, goal: 76, rate: -0.45 },
      minutes: 45,
      gaps: [360, 63.6, 1200],
    });
    let passed = 0;
    for (let n = 11; n <= 100; n++) if (validateNumbers(`${n}`, allowed).ok) passed++;
    expect(passed / 90).toBeLessThan(0.25);
  });
});
