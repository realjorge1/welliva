/**
 * HER OWN SIGNS (2026-11-20: Fixes 5 and 7).
 *
 *   · an ovulation test dates the surge from its FIRST positive; a run of
 *     negatives past the estimate moves the dates later (never with PCOS)
 *   · a sustained temperature rise CONFIRMS ovulation after the fact, moves
 *     this cycle's dates, and teaches her own second half — with PCOS too
 *   · clear, stretchy discharge marks that day fertile, and moves nothing
 */
import { describe, expect, it } from "vitest";

import {
  COVER_LOOKBACK_DAYS,
  COVER_READINGS,
  cToF,
  fToC,
  HIGH_DAYS,
  normalizeTemperatureC,
  RISE_MIN_C,
  TEMPERATURE_LOGGING,
  temperatureRise,
} from "../bbt";
import { confidenceLine, confidenceWord, FERTILE_NOW_LINE, NEGATIVES_LINE } from "../copy";
import { addDays, daysBetween } from "../dates";
import { applyDayPatch } from "../dayWrite";
import { CSV_COLUMNS, cycleCsv } from "../exportData";
import { CYCLE_ARTICLES, CYCLE_LIBRARY, findArticle } from "../library";
import {
  buildCycles,
  lutealFor,
  NEGATIVE_SHIFT_MAX_DAYS,
  predict,
  surgeStart,
  TEST_HALF_WIDTH,
  todayStatus,
  type CycleProfile,
  type PredictInput,
} from "../predict";
import { planCycleReminders } from "../reminderPlan";
import { isEmptyDayLog, normalizeDayLog, type CycleDays } from "../types";
import { computeView } from "../view";
import { dialModel, paintDays } from "../visual";
import { day, days, history, settings } from "./helpers";

const ADULT: CycleProfile = { age: 30, conditions: [] };
const PCOS: CycleProfile = { age: 30, conditions: ["pcos"] };
const EPS = history("2026-04-01", [28, 28, 28, 28, 28]); // last start 2026-08-19
const LAST = "2026-08-19";
const cd = (n: number) => addDays(LAST, n - 1);
const S = settings({ usualCycleDays: 28, showFertileWindow: true });

function input(logs: CycleDays, today: string, profile = ADULT): PredictInput {
  return { episodes: EPS, days: logs, settings: S, today, profile };
}
const pos = (date: string) => day(date, { ovulationTest: "positive" });
const neg = (date: string) => day(date, { ovulationTest: "negative" });

/** A textbook chart: low readings, then a sustained rise from `firstHigh`. */
function chart(firstHighDay: number, lastDay: number, low = 36.4, high = 36.8): CycleDays {
  const out: CycleDays = {};
  for (let n = 3; n <= lastDay; n += 1) {
    const t = n < firstHighDay ? low + (n % 2) * 0.05 : high + (n % 2) * 0.05;
    out[cd(n)] = day(cd(n), { temperatureC: Number(t.toFixed(2)) });
  }
  return out;
}

/* ───────────────────────────── Fix 5 ───────────────────────────── */

describe("the surge starts at the FIRST positive", () => {
  it("one positive, a run, and two runs", () => {
    expect(surgeStart(days(pos(cd(14))), cd(7), cd(20))).toBe(cd(14));
    expect(surgeStart(days(pos(cd(13)), pos(cd(14)), pos(cd(15))), cd(7), cd(20))).toBe(cd(13));
    // Three days apart is still one surge; more than that is a second.
    expect(surgeStart(days(pos(cd(10)), pos(cd(13))), cd(7), cd(20))).toBe(cd(10));
    expect(surgeStart(days(pos(cd(9)), pos(cd(14)), pos(cd(15))), cd(7), cd(20))).toBe(cd(14));
  });

  it("her own second half is measured from it too", () => {
    const eps = history("2026-06-01", [28, 28, 28]);
    const logs: CycleDays = {};
    for (const start of [eps[0].start, eps[1].start]) {
      for (const n of [13, 14, 15]) logs[addDays(start, n - 1)] = pos(addDays(start, n - 1));
    }
    const cycles = buildCycles(eps, S, "2026-09-01");
    // Surge day 13 → ovulation day 14 → next start (day 29) is 15 days later.
    expect(lutealFor(cycles, logs)).toMatchObject({ days: 15, personal: true });
  });

  it("with PCOS, positives teach nothing and move nothing", () => {
    const eps = history("2026-06-01", [28, 28, 28]);
    const logs = days(pos(addDays(eps[0].start, 14)), pos(addDays(eps[1].start, 14)));
    expect(lutealFor(buildCycles(eps, S, "2026-09-01"), logs, true).personal).toBe(false);
    expect(predict(input(days(pos(cd(14))), cd(16), PCOS))!.fromTest).toBeNull();
  });
});

describe("a run of negatives past the estimate", () => {
  const calendar = predict(input({}, cd(19)))!;
  const run = (from: number, to: number) => {
    const out: CycleDays = {};
    for (let n = from; n <= to; n += 1) out[cd(n)] = neg(cd(n));
    return out;
  };

  it("moves ovulation to the day after the last of them, and the period with it", () => {
    const p = predict(input(run(14, 18), cd(19)))!;
    expect(p.testBasis).toBe("negatives");
    expect(p.ovulation).toBe(cd(19));
    expect(p.likely).toBe(addDays(cd(19), p.lutealDays));
    expect(p.likely > calendar.likely).toBe(true);
    expect(p.halfWidth).toBe(TEST_HALF_WIDTH.default);
    expect(p.fromTest).toBeNull();
  });

  it("says why, everywhere the window is described", () => {
    const p = predict(input(run(14, 18), cd(19)))!;
    expect(confidenceLine(p)).toBe(NEGATIVES_LINE);
    expect(NEGATIVES_LINE).toBe("Your tests haven't shown a surge yet, so I've moved your dates back.");
    expect(confidenceWord(p)).toBe("From your tests");
  });

  it(`moves it at most ${NEGATIVE_SHIFT_MAX_DAYS} days`, () => {
    const p = predict(input(run(14, 34), cd(35)))!;
    expect(daysBetween(calendar.ovulation, p.ovulation)).toBe(NEGATIVE_SHIFT_MAX_DAYS);
  });

  it("needs two negatives in three days, at or past the estimate less a day", () => {
    expect(predict(input(days(neg(cd(17))), cd(19)))!.testBasis).toBeNull();
    expect(predict(input(run(8, 12), cd(19)))!.testBasis).toBeNull();
    expect(predict(input(days(neg(cd(16)), neg(cd(18))), cd(19)))!.ovulation).toBe(cd(19));
  });

  it("a positive after them wins", () => {
    const logs = { ...run(14, 17), [cd(18)]: pos(cd(18)) };
    const p = predict(input(logs, cd(19)))!;
    expect([p.testBasis, p.fromTest, p.ovulation]).toEqual(["positive", cd(18), cd(19)]);
  });

  it("with PCOS, negatives move nothing either", () => {
    expect(predict(input(run(14, 18), cd(19), PCOS))!.testBasis).toBeNull();
  });
});

/* ───────────────────────────── Fix 7: temperature ───────────────────────────── */

describe("a temperature rise (the three-over-six rule)", () => {
  it("is found on a textbook chart: ovulation the day before the first high day", () => {
    const rise = temperatureRise(chart(16, 20), cd(7), cd(20))!;
    expect(rise.firstHigh).toBe(cd(16));
    expect(rise.ovulation).toBe(cd(15));
  });

  it(`needs ${HIGH_DAYS} high days logged: it can't predict, only confirm`, () => {
    expect(temperatureRise(chart(16, 17), cd(7), cd(17))).toBeNull();
    expect(temperatureRise(chart(16, 18), cd(7), cd(18))).not.toBeNull();
  });

  it(`needs ${COVER_READINGS} readings in the ${COVER_LOOKBACK_DAYS} days before`, () => {
    const sparse = chart(16, 20);
    for (const n of [6, 7, 9, 11, 13]) delete sparse[cd(n)];
    expect(temperatureRise(sparse, cd(7), cd(20))).toBeNull();
  });

  it(`the third high day must clear the cover line by ${RISE_MIN_C} °C`, () => {
    expect(temperatureRise(chart(16, 20, 36.4, 36.5), cd(7), cd(20))).toBeNull();
  });

  it("a noisy chart with no sustained shift gives no rise", () => {
    const noisy: CycleDays = {};
    const wobble = [0, 0.15, -0.1, 0.2, -0.05, 0.1, -0.15, 0.25, 0, -0.1, 0.2, 0.05, -0.2, 0.15, 0, 0.1, -0.05, 0.2];
    wobble.forEach((w, i) => {
      noisy[cd(i + 3)] = day(cd(i + 3), { temperatureC: Number((36.5 + w).toFixed(2)) });
    });
    expect(temperatureRise(noisy, cd(7), cd(20))).toBeNull();
  });

  it("ignores a fever or a typo", () => {
    const fever = chart(16, 20);
    fever[cd(17)] = day(cd(17), { temperatureC: 38.9 });
    expect(temperatureRise(fever, cd(7), cd(20))).toBeNull();
    const typo = chart(16, 20);
    typo[cd(12)] = day(cd(12), { temperatureC: 34.2 });
    expect(temperatureRise(typo, cd(7), cd(20))?.firstHigh).toBe(cd(16));
  });
});

describe("a confirmed rise dates this cycle", () => {
  it("ovulation from the rise, the period a second half later, the test-dated width", () => {
    const p = predict(input(chart(18, 21), cd(21)))!;
    expect(p.testBasis).toBe("temperature");
    expect(p.ovulation).toBe(cd(17));
    expect(p.likely).toBe(addDays(cd(17), p.lutealDays));
    expect(p.halfWidth).toBe(TEST_HALF_WIDTH.default);
    expect(confidenceWord(p)).toBe("From your temperature");
    // Shown with the fertile window off too, so it names no ovulation date.
    expect(confidenceLine(p)).toBe("Updated from your temperature: its rise confirmed ovulation this cycle.");
  });

  it("with PCOS too: a rise reflects ovulation, where a test may not", () => {
    expect(predict(input(chart(18, 21), cd(21), PCOS))!.testBasis).toBe("temperature");
  });

  it("a positive test outranks it", () => {
    const logs = { ...chart(18, 21), [cd(15)]: { ...chart(18, 21)[cd(15)], ovulationTest: "positive" as const } };
    expect(predict(input(logs, cd(21)))!.testBasis).toBe("positive");
  });

  it("teaches her own second half: one sample per cycle, the test first, else the rise", () => {
    const eps = history("2026-06-01", [28, 28, 28]);
    const logs: CycleDays = {};
    for (const start of [eps[0].start, eps[1].start]) {
      for (let n = 3; n <= 27; n += 1) {
        const d = addDays(start, n - 1);
        logs[d] = day(d, { temperatureC: n < 17 ? 36.4 : 36.8 });
      }
    }
    // First high day 17 → ovulation day 16 → next start (day 29) is 13 days later.
    const cycles = buildCycles(eps, S, "2026-09-01");
    expect(lutealFor(cycles, logs)).toMatchObject({ days: 13, personal: true });
    expect(lutealFor(cycles, logs, true)).toMatchObject({ days: 13, personal: true });
  });

  it("not in the modes that don't predict a cycle", () => {
    const hormonal = settings({ contraception: { answer: "hormonal", since: "2026-01-01", restartFrom: null } });
    expect(predict({ ...input(chart(18, 21), cd(21)), settings: hormonal })).toBeNull();
    expect(predict(input(chart(18, 21), cd(21), { conditions: ["pregnancy"] }))).toBeNull();
    expect(predict(input(chart(18, 21), cd(21), { age: 50, conditions: ["menopause"] }))!.testBasis).toBeNull();
  });

  it("the lean reminder path reads the same dates as the view", () => {
    const logs = chart(18, 21);
    const view = computeView({ settings: S, periods: EPS, days: logs }, { today: cd(21), profile: ADULT });
    const lean = input(logs, cd(21));
    const prediction = predict(lean);
    expect(prediction).toEqual(view.prediction);
    const now = new Date(2026, 8, 8, 8);
    expect(planCycleReminders({ settings: S, status: todayStatus(lean, prediction), prediction, now })).toEqual(
      planCycleReminders({ settings: S, status: view.status, prediction: view.prediction, now }),
    );
  });
});

describe("storing a temperature", () => {
  it("in °C, 34–42, to 0.05", () => {
    expect(normalizeTemperatureC(36.57)).toBe(36.55);
    expect(normalizeTemperatureC(36.58)).toBe(36.6);
    expect(normalizeTemperatureC(33.9)).toBeNull();
    expect(normalizeTemperatureC(42.1)).toBeNull();
    expect(normalizeTemperatureC("36.5")).toBeNull();
    expect(normalizeDayLog(cd(3), { temperatureC: 36.57, updatedAt: "x" })?.temperatureC).toBe(36.55);
    expect(normalizeDayLog(cd(3), { temperatureC: 98.2, updatedAt: "x" })?.temperatureC).toBeUndefined();
  });

  it("a day holding only a temperature is not empty", () => {
    expect(isEmptyDayLog({ date: cd(3), temperatureC: 36.5, updatedAt: "x" })).toBe(false);
  });

  it("through the day sheet's write path: kept, refused when out of range, cleared with null", () => {
    const data = { settings: S, periods: EPS, days: {} };
    const ctx = { today: cd(5), now: "2026-08-23T07:00:00.000Z", profile: ADULT };
    const kept = applyDayPatch(data, cd(5), { temperatureC: 36.62 }, ctx);
    expect(kept.days[cd(5)].temperatureC).toBe(36.6);
    expect(applyDayPatch(data, cd(5), { temperatureC: 97.5 }, ctx)).toBe(data);
    expect(applyDayPatch(kept, cd(5), { temperatureC: null }, ctx).days[cd(5)].temperatureC).toBeUndefined();
  });

  it("°F is only how she types and reads it", () => {
    expect(cToF(36.6)).toBe(97.9);
    expect(normalizeTemperatureC(fToC(97.9))).toBe(36.6);
  });

  it("goes out in her export, in its own column at the end", () => {
    const csv = cycleCsv({ settings: S, periods: [], days: days(day(cd(5), { temperatureC: 36.55 })) }).split("\n");
    expect(CSV_COLUMNS[CSV_COLUMNS.length - 1]).toBe("temperature_c");
    expect(csv[1].split(",").pop()).toBe("36.55");
  });
});

describe("the temperature page", () => {
  const page = CYCLE_LIBRARY.temperature;
  const text = page.sections.flatMap((s) => [...(s.body ?? []), ...(s.points ?? [])]).join(" ");

  it("quotes the same rule the app acts on, and its limits", () => {
    expect(text).toContain(`${HIGH_DAYS} days in a row`);
    expect(text).toContain(`${COVER_READINGS} readings`);
    expect(text).toContain(`${RISE_MIN_C} °C`);
    expect(text).toContain(`${COVER_LOOKBACK_DAYS} days`);
    expect(text).toContain("confirms ovulation after it happens; it can't predict it");
    expect(text).toMatch(/Illness, alcohol/);
    expect(text).toMatch(/not birth control/);
  });

  it("is in the library now that temperature can be logged (LEGAL_VERSION 7, 2026-11-20)", () => {
    expect(TEMPERATURE_LOGGING).toBe(true);
    expect(findArticle("temperature")).toBe(CYCLE_LIBRARY.temperature);
    expect(CYCLE_ARTICLES.map((a) => a.id)).toContain("temperature");
  });

  it("the Privacy Policy and the disclaimer say what the app now holds and does", async () => {
    const { LEGAL_DOCS, LEGAL_VERSION } = await import("../../../constants/legal");
    const words = (doc: (typeof LEGAL_DOCS)[keyof typeof LEGAL_DOCS]) =>
      doc.sections.flatMap((s) => [...(s.body ?? []), ...(s.bullets ?? [])]).join(" ");
    expect(LEGAL_VERSION).toBeGreaterThanOrEqual(7);
    expect(words(LEGAL_DOCS.privacy)).toContain("your resting temperature on waking");
    expect(words(LEGAL_DOCS.privacy)).toContain("whether it is the combined pill");
    expect(words(LEGAL_DOCS.disclaimer)).toContain("It cannot predict ovulation");
    expect(words(LEGAL_DOCS.disclaimer)).toContain("from your pack schedule");
  });
});

/* ───────────────────────────── Fix 7: discharge ───────────────────────────── */

describe("clear, stretchy discharge marks that day fertile (owner, 2026-11-20)", () => {
  const today = cd(9); // well before the estimated window
  const logs = days(day(today, { discharge: "clear_stretchy" }));

  it("today counts as fertile, whatever the estimate says, and the screen says so", () => {
    const view = computeView({ settings: S, periods: EPS, days: logs }, { today, profile: ADULT });
    expect(view.fertileNow).toBe(true);
    expect(FERTILE_NOW_LINE).toMatch(/counts as fertile, whatever the estimate says/);
    const paint = paintDays({ episodes: EPS, days: logs, view, today, showFertile: true });
    expect(paint(today).fertile).toBe(true);
    expect(dialModel({ episodes: EPS, view, today, showFertile: true }).arcs).toContainEqual({
      kind: "fertile",
      from: 9,
      to: 9,
    });
  });

  it("moves no date", () => {
    const withIt = computeView({ settings: S, periods: EPS, days: logs }, { today, profile: ADULT });
    const without = computeView({ settings: S, periods: EPS, days: {} }, { today, profile: ADULT });
    expect(withIt.prediction).toEqual(without.prediction);
  });

  it("only with the fertile window on, and only in the modes that show one", () => {
    const off = settings({ usualCycleDays: 28, showFertileWindow: false });
    expect(computeView({ settings: off, periods: EPS, days: logs }, { today, profile: ADULT }).fertileNow).toBe(false);
    const hormonal = settings({
      showFertileWindow: true,
      contraception: { answer: "hormonal", since: "2026-01-01", restartFrom: null },
    });
    expect(computeView({ settings: hormonal, periods: EPS, days: logs }, { today, profile: ADULT }).fertileNow).toBe(false);
    const paint = paintDays({
      episodes: EPS,
      days: logs,
      view: computeView({ settings: off, periods: EPS, days: logs }, { today, profile: ADULT }),
      today,
      showFertile: false,
    });
    expect(paint(today).fertile).toBe(false);
  });
});
