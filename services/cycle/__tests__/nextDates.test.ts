/**
 * "We said the 14th. It came on the 15th.", sharing the next dates, and when
 * to start ovulation tests (2026-11-13).
 */
import { describe, expect, it } from "vitest";

import { formatDay } from "../dates";
import { shareDatesLine, startReceipt, testingStartLine } from "../nextDates";
import { predict, type CycleProfile } from "../predict";
import type { CycleDays, PeriodEpisode } from "../types";
import { day, days, history, settings } from "./helpers";

/** Starts 1 Jul, 29 Jul, 26 Aug, 23 Sep. On 20 Oct the window was 18–24 Oct, likeliest 21 Oct. */
const PERIODS = history("2026-07-01", [28, 28, 28]);
const ADULT: CycleProfile = { age: 30, conditions: [] };

/** A period started on `start`, saved on the local day `savedOn`. */
function started(start: string, savedOn: string = start): PeriodEpisode {
  const [y, m, d] = savedOn.split("-").map(Number);
  return { id: `s-${start}`, start, end: null, updatedAt: new Date(y, m - 1, d, 9, 30).toISOString() };
}

function receipt(start: string, today: string, opts: { savedOn?: string; profile?: CycleProfile; logs?: CycleDays } = {}) {
  return startReceipt({
    episodes: [...PERIODS, started(start, opts.savedOn ?? today)],
    days: opts.logs ?? {},
    settings: settings(),
    profile: opts.profile ?? ADULT,
    today,
  });
}

const WEEKDAY = (iso: string) => formatDay(iso, { weekday: true });

describe("the receipt", () => {
  it("on the likeliest day", () => {
    expect(receipt("2026-10-21", "2026-10-21")).toBe(
      "Right on the day we said. Your next window now includes this cycle.",
    );
  });

  it("inside the window, a day after the likeliest day", () => {
    expect(receipt("2026-10-22", "2026-10-22")).toBe(
      `We said around ${WEEKDAY("2026-10-21")} (18–24 Oct). It came on ${WEEKDAY("2026-10-22")}: inside the window, 1 day after the likeliest day. Your next window now includes this cycle.`,
    );
  });

  it("outside it, said as a miss", () => {
    expect(receipt("2026-10-28", "2026-10-28")).toBe(
      "It came 4 days after the window we gave (18–24 Oct). Your next window now includes this cycle.",
    );
    expect(receipt("2026-10-15", "2026-10-15")).toBe(
      "It came 3 days before the window we gave (18–24 Oct). Your next window now includes this cycle.",
    );
  });

  it("answers a start logged a few days late, on the day it's logged", () => {
    expect(receipt("2026-10-21", "2026-10-23")).toMatch(/^Right on the day we said\./);
    expect(receipt("2026-10-21", "2026-10-24")).toBeNull();
  });

  it("only on the day she logged it", () => {
    expect(receipt("2026-10-21", "2026-10-22", { savedOn: "2026-10-21" })).toBeNull();
  });

  it("says nothing when there was no prediction: a first log", () => {
    expect(
      startReceipt({ episodes: [started("2026-10-21")], days: {}, settings: settings(), profile: ADULT, today: "2026-10-21" }),
    ).toBeNull();
  });

  it("never says the window 'includes' a gap that doesn't count", () => {
    const line = receipt("2026-12-15", "2026-12-15");
    expect(line).toMatch(/^It came \d+ days after the window/);
    expect(line).not.toContain("includes this cycle");
  });

  it("used the dates as they stood, test and all", () => {
    // A positive test on 12 Oct moved the window to 23–29 Oct, likeliest 26 Oct.
    const logs = days(day("2026-10-12", { ovulationTest: "positive" }));
    expect(receipt("2026-10-26", "2026-10-26", { logs })).toMatch(/^Right on the day we said\./);
  });

  it("only where a cycle is predicted: never on hormonal contraception or for the first period after a birth", () => {
    const hormonal = startReceipt({
      episodes: [...PERIODS, started("2026-10-21")],
      days: {},
      settings: settings({ contraception: { answer: "hormonal", since: "2026-06-01", restartFrom: null } }),
      profile: ADULT,
      today: "2026-10-21",
    });
    expect(hormonal).toBeNull();
    const afterBirth = startReceipt({
      episodes: [...PERIODS, started("2026-10-21")],
      days: {},
      settings: settings({ postpartumSince: "2026-10-01" }),
      profile: { age: 30, conditions: ["postpartum"] },
      today: "2026-10-21",
    });
    expect(afterBirth).toBeNull();
  });
});

describe("sharing the dates", () => {
  it("names the likeliest day only when the screen says 'Fairly sure'", () => {
    const sure = predict({ episodes: PERIODS, days: {}, settings: settings(), today: "2026-10-12", profile: ADULT })!;
    expect(sure.confidence).toBe("confident");
    expect(shareDatesLine(sure)).toBe(`My next period is likely 18–24 Oct, most likely ${WEEKDAY("2026-10-21")}.`);
    const early = predict({
      episodes: history("2026-09-23", []),
      days: {},
      settings: settings(),
      today: "2026-10-12",
      profile: ADULT,
    })!;
    expect(shareDatesLine(early)).toMatch(/^My next period is likely [^,]+\.$/);
  });

  it("has nothing to share with no window", () => {
    expect(shareDatesLine(null)).toBeNull();
  });
});

describe("when to start testing", () => {
  const p = (logs: CycleDays = {}, today = "2026-09-26") =>
    predict({ episodes: PERIODS, days: logs, settings: settings({ showFertileWindow: true }), today, profile: ADULT });
  const tested = days(day("2026-09-10", { ovulationTest: "negative" }));

  it("from the window's earliest edge, less the luteal length and 3 days", () => {
    // Earliest 18 Oct − 16 days (13 + 3) = 2 Oct.
    expect(testingStartLine({ prediction: p(tested), days: tested, showFertile: true, today: "2026-09-26" })).toBe(
      `Test daily from ${WEEKDAY("2026-10-02")} until you get a positive.`,
    );
  });

  it("'now' once that day has come", () => {
    expect(testingStartLine({ prediction: p(tested, "2026-10-03"), days: tested, showFertile: true, today: "2026-10-03" })).toBe(
      "Test daily now until you get a positive.",
    );
  });

  it("only for someone who has logged a test, with the fertile window on", () => {
    expect(testingStartLine({ prediction: p(), days: {}, showFertile: true, today: "2026-09-26" })).toBeNull();
    expect(testingStartLine({ prediction: p(tested), days: tested, showFertile: false, today: "2026-09-26" })).toBeNull();
  });

  it("stops at a positive this cycle, and after the estimated ovulation", () => {
    const pos = days(day("2026-10-05", { ovulationTest: "positive" }));
    expect(testingStartLine({ prediction: p(pos, "2026-10-06"), days: pos, showFertile: true, today: "2026-10-06" })).toBeNull();
    expect(testingStartLine({ prediction: p(tested, "2026-10-10"), days: tested, showFertile: true, today: "2026-10-10" })).toBeNull();
  });
});
