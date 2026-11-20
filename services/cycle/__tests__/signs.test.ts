/**
 * The mid-cycle twinge and discharge (2026-11-13): explained where she logs
 * them, read as patterns under the standard, and never moving a date.
 */
import { describe, expect, it } from "vitest";

import { buildCycles, DEFAULT_LUTEAL_DAYS, predict } from "../predict";
import { dischargePattern, TWINGE_CALM_LINE, TWINGE_SAFETY_LINE, twingeLines, twingePattern } from "../signs";
import { isEmptyDayLog, normalizeDayLog, type CycleDayLog, type CycleDays } from "../types";
import { day, history, NOW, settings } from "./helpers";

/** Starts 1 Jul, 29 Jul, 26 Aug, 23 Sep: three completed 28-day cycles. */
const PERIODS = history("2026-07-01", [28, 28, 28]);
const TODAY = "2026-10-12";
const CYCLES = buildCycles(PERIODS, settings(), TODAY);
/** Estimated ovulation in each completed cycle: the next start less 14. */
const OVULATIONS = ["2026-07-15", "2026-08-12", "2026-09-09"];

function logs(...entries: [string, Partial<CycleDayLog>][]): CycleDays {
  const out: CycleDays = {};
  for (const [date, patch] of entries) out[date] = { ...(out[date] ?? day(date, {})), ...patch };
  return out;
}
const twinge = { symptoms: ["mid_cycle_pain" as const] };

describe("the twinge, where she logs it", () => {
  const prediction = predict({ episodes: PERIODS, days: {}, settings: settings(), today: TODAY });
  const lines = (date: string, mode: "normal" | "hormonal" | "menopause" = "normal") =>
    twingeLines({ date, log: day(date, twinge), mode, prediction, cycles: CYCLES });

  it("explains a twinge near the estimated ovulation, then the safety line", () => {
    expect(lines("2026-08-14")).toEqual([TWINGE_CALM_LINE, TWINGE_SAFETY_LINE]);
  });

  it("away from it: the safety line alone", () => {
    expect(lines("2026-08-20")).toEqual([TWINGE_SAFETY_LINE]);
  });

  it("where nothing is estimated, the safety line alone", () => {
    expect(lines("2026-08-12", "hormonal")).toEqual([TWINGE_SAFETY_LINE]);
    expect(lines("2026-08-12", "menopause")).toEqual([TWINGE_SAFETY_LINE]);
  });

  it("names no date, so it's the same with the fertile window off", () => {
    expect(`${TWINGE_CALM_LINE} ${TWINGE_SAFETY_LINE}`).not.toMatch(/\d/);
  });

  it("says nothing unless the twinge is ticked", () => {
    expect(twingeLines({ date: "2026-08-12", log: day("2026-08-12", { symptoms: ["cramps"] }), mode: "normal", prediction, cycles: CYCLES })).toEqual([]);
  });
});

describe("the twinge pattern", () => {
  it("in 2 or more of the cycles she logged it in, around the middle", () => {
    const d = logs(["2026-07-16", twinge], ["2026-08-11", twinge], ["2026-09-01", twinge]);
    const off = twingePattern(CYCLES, d, DEFAULT_LUTEAL_DAYS, false)!;
    expect(off.body).toBe("Your mid-cycle twinges came around the middle of your cycle in 2 of your last 3 cycles.");
    const on = twingePattern(CYCLES, d, DEFAULT_LUTEAL_DAYS, true)!;
    expect(on.body).toBe("Your mid-cycle twinges came within 2 days of your estimated ovulation in 2 of your last 3 cycles.");
  });

  it("names the cycles she logged it in, never the ones she didn't", () => {
    const d = logs(["2026-08-11", twinge], ["2026-09-10", twinge]);
    expect(twingePattern(CYCLES, d, DEFAULT_LUTEAL_DAYS, false)!.scope).toBe("2 of the 2 recent cycles you logged one in");
  });

  it("once is not a pattern", () => {
    expect(twingePattern(CYCLES, logs(["2026-08-11", twinge]), DEFAULT_LUTEAL_DAYS, false)).toBeNull();
  });
});

describe("discharge: a check on the estimate, never an input", () => {
  const stretchy = { discharge: "clear_stretchy" as const };

  it("says when her clear, stretchy days line up with the estimate", () => {
    const d = logs(["2026-07-12", stretchy], ["2026-07-13", stretchy], ["2026-08-10", stretchy], ["2026-09-08", stretchy]);
    expect(dischargePattern(CYCLES, d, DEFAULT_LUTEAL_DAYS)!.body).toBe(
      "Your clear, stretchy days came in the 5 days before your estimated ovulation in 3 of your last 3 cycles.",
    );
  });

  it("and says so when they come later than the estimate", () => {
    const d = logs(["2026-07-19", stretchy], ["2026-08-17", stretchy]);
    expect(dischargePattern(CYCLES, d, DEFAULT_LUTEAL_DAYS)!.body).toBe(
      "Your clear, stretchy days came later than my estimate in 2 of 2 cycles. An ovulation test would tell us more.",
    );
  });

  it("never moves a date", () => {
    const d = logs(["2026-07-19", stretchy], ["2026-08-17", stretchy], ["2026-09-15", stretchy]);
    const plain = predict({ episodes: PERIODS, days: {}, settings: settings(), today: TODAY })!;
    const withSigns = predict({ episodes: PERIODS, days: d, settings: settings(), today: TODAY })!;
    expect(withSigns.likely).toBe(plain.likely);
    expect(withSigns.ovulation).toBe(plain.ovulation);
  });

  it("is stored as a storage string, and a day holding only it is not empty", () => {
    expect(normalizeDayLog("2026-07-12", { discharge: "clear_stretchy", updatedAt: NOW })?.discharge).toBe("clear_stretchy");
    expect(normalizeDayLog("2026-07-12", { discharge: "watery", updatedAt: NOW })?.discharge).toBeUndefined();
    expect(isEmptyDayLog(day("2026-07-12", { discharge: "dry" }))).toBe(false);
  });

  it("needs two cycles", () => {
    expect(dischargePattern(CYCLES, logs(["2026-07-12", stretchy]), DEFAULT_LUTEAL_DAYS)).toBeNull();
  });

  it("the estimated ovulations these tests use", () => {
    expect(CYCLES.map((c) => c.nextStart).map((n, i) => [n, OVULATIONS[i]])).toEqual([
      ["2026-07-29", "2026-07-15"],
      ["2026-08-26", "2026-08-12"],
      ["2026-09-23", "2026-09-09"],
    ]);
  });
});

describe("discharge in the export", () => {
  it("has its own column, after the ones before it (later columns are appended after it)", async () => {
    const { cycleCsv, CSV_COLUMNS } = await import("../exportData");
    const csv = cycleCsv({
      settings: settings({ showFertileWindow: true }),
      periods: [],
      days: logs(["2026-07-12", { discharge: "clear_stretchy" }]),
    }).split("\n");
    const at = CSV_COLUMNS.indexOf("discharge");
    expect(at).toBe(10);
    expect(csv[0].split(",")[at]).toBe("discharge");
    expect(csv[1].split(",")[at]).toBe("Clear and stretchy");
  });
});
