/**
 * The three doctor checks of 2026-11-13: cramps that stop her day, heavy
 * periods, and bleeding between periods. What each counts, what it leaves
 * out, and the honest denominators — a period with nothing logged is unknown,
 * never "no cramps" or "a light one".
 */
import { describe, expect, it } from "vitest";

import { addDays } from "../dates";
import {
  betweenPeriods,
  completedPeriods,
  disruptiveCramps,
  heavyPeriods,
  nearOvulation,
  ofTheRecent,
  ofYourLast,
  OVULATION_SPOTTING_LINE,
  spottingNote,
} from "../doctorChecks";
import { cycleCsv, doctorSummary } from "../exportData";
import { doctorNotes, visibleNotes, type DoctorNoteId } from "../flags";
import { buildCycles, DEFAULT_LUTEAL_DAYS, predict, type CycleMode } from "../predict";
import { isEmptyDayLog, normalizeDayLog, type CycleDayLog, type CycleDays, type PeriodEpisode } from "../types";
import { day, history, NOW, period, settings } from "./helpers";

/** Starts 8 Apr, 6 May, 3 Jun, 1 Jul, 29 Jul — five 5-day periods, four 28-day cycles. */
const PERIODS = history("2026-04-08", [28, 28, 28, 28]);
const STARTS = ["2026-04-08", "2026-05-06", "2026-06-03", "2026-07-01", "2026-07-29"];
const TODAY = "2026-08-20";
const TYPICAL = 5;

const spans = (episodes: readonly PeriodEpisode[] = PERIODS, today = TODAY) =>
  completedPeriods(episodes, today, TYPICAL);

/** One log per date, merging patches for the same date. */
function logs(...entries: [string, Partial<CycleDayLog>][]): CycleDays {
  const out: CycleDays = {};
  for (const [date, patch] of entries) out[date] = { ...(out[date] ?? day(date, {})), ...patch };
  return out;
}

/** `n` days from `start`, each with `patch`. */
function run(start: string, n: number, patch: Partial<CycleDayLog>): [string, Partial<CycleDayLog>][] {
  return Array.from({ length: n }, (_, i) => [addDays(start, i), patch] as [string, Partial<CycleDayLog>]);
}

describe("completedPeriods", () => {
  it("leaves out a period still running: it hasn't said what it will be", () => {
    const open: PeriodEpisode = { id: "open", start: "2026-08-18", end: null, updatedAt: "" };
    const out = completedPeriods([...PERIODS, open], TODAY, TYPICAL);
    expect(out.map((p) => p.start)).toEqual(STARTS);
  });

  it("starts from a fresh start (after a birth, after stopping a method)", () => {
    const out = completedPeriods(PERIODS, TODAY, TYPICAL, "2026-06-01");
    expect(out.map((p) => p.start)).toEqual(STARTS.slice(2));
  });
});

describe("cramps that stop her day", () => {
  const cramps = { symptoms: ["cramps" as const] };
  const stopped = { symptoms: ["cramps" as const], stoppedDay: true as const };

  it("speaks at 2 of her last 3 periods with cramps, and counts every day", () => {
    const d = logs(
      ["2026-05-06", stopped],
      ["2026-05-07", stopped],
      ["2026-06-03", cramps],
      ["2026-07-01", stopped],
    );
    expect(disruptiveCramps(spans(), d)).toEqual({
      hits: 2,
      observed: 3,
      days: ["2026-05-06", "2026-05-07", "2026-07-01"],
    });
  });

  it("stays quiet when it happened once", () => {
    const d = logs(["2026-05-06", stopped], ["2026-06-03", cramps], ["2026-07-01", cramps]);
    expect(disruptiveCramps(spans(), d)).toBeNull();
  });

  it("never counts a period with no cramps logged as one without them", () => {
    // Only two periods had cramps at all: both stopped her day — "both of your last 2".
    const d = logs(["2026-06-03", stopped], ["2026-07-29", stopped]);
    const r = disruptiveCramps(spans(), d);
    expect(r).toMatchObject({ hits: 2, observed: 2 });
  });

  it("counts cramps on the day or two before the bleeding as that period's", () => {
    const d = logs(["2026-06-02", stopped], ["2026-06-30", stopped]);
    expect(disruptiveCramps(spans(), d)).toMatchObject({ hits: 2, observed: 2 });
  });

  it("reads only her last 3 periods with cramps", () => {
    const d = logs(
      ["2026-04-08", stopped],
      ["2026-05-06", stopped],
      ["2026-06-03", cramps],
      ["2026-07-01", cramps],
      ["2026-07-29", cramps],
    );
    expect(disruptiveCramps(spans(), d)).toBeNull();
  });

  it("waits for a period still running to end", () => {
    const open: PeriodEpisode = { id: "open", start: "2026-08-18", end: null, updatedAt: "" };
    const d = logs(["2026-07-29", stopped], ["2026-08-18", stopped]);
    expect(disruptiveCramps(completedPeriods([...PERIODS, open], TODAY, TYPICAL), d)).toBeNull();
  });
});

describe("heavy periods", () => {
  const heavy = { flow: "heavy" as const };
  const medium = { flow: "medium" as const };

  it("speaks when 2 of her last 3 periods had a heavy flow on 3 or more days", () => {
    const d = logs(
      ...run("2026-05-06", 3, heavy),
      ...run("2026-06-03", 2, medium),
      ...run("2026-07-01", 4, heavy),
    );
    const r = heavyPeriods(spans(), d);
    expect(r).toMatchObject({ hits: 2, observed: 3, heavyDays: [3, 4], starts: ["2026-05-06", "2026-07-01"] });
    expect(r?.tired).toBe(false);
  });

  it("two heavy days is a heavy day or two, not a heavy period", () => {
    const d = logs(...run("2026-05-06", 2, heavy), ...run("2026-06-03", 2, heavy), ...run("2026-07-01", 2, heavy));
    expect(heavyPeriods(spans(), d)).toBeNull();
  });

  it("a period with no flow logged is left out, never read as a light one", () => {
    // Flow logged in only two periods, both heavy: "both of your last 2".
    const d = logs(...run("2026-04-08", 3, heavy), ...run("2026-07-29", 3, heavy));
    expect(heavyPeriods(spans(), d)).toMatchObject({ hits: 2, observed: 2 });
  });

  it("one day of flow says too little about a period to count it", () => {
    const d = logs(["2026-07-29", heavy], ...run("2026-05-06", 3, heavy), ...run("2026-06-03", 3, heavy));
    expect(heavyPeriods(spans(), d)).toMatchObject({ hits: 2, observed: 2 });
  });

  it("adds the iron line when she also logged low energy on 2 or more of those days", () => {
    const d = logs(
      ...run("2026-05-06", 3, heavy),
      ["2026-05-07", { flow: "heavy", energy: "low" }],
      ...run("2026-07-01", 3, heavy),
      ["2026-07-03", { flow: "heavy", energy: "low" }],
    );
    expect(heavyPeriods(spans(), d)).toMatchObject({ tired: true, tiredDays: 2 });
  });
});

describe("bleeding between periods", () => {
  const cycles = buildCycles(PERIODS, settings(), TODAY);
  const spotting = { flow: "spotting" as const };
  // The 6 May cycle: period to 10 May, next start 3 Jun, ovulation estimated 20 May.

  it("speaks at 2 of her last 3 cycles, naming the first day in each", () => {
    const d = logs(["2026-05-14", spotting], ["2026-06-12", spotting], ["2026-06-13", spotting]);
    expect(betweenPeriods(cycles, spans(), d, DEFAULT_LUTEAL_DAYS)).toEqual({
      hits: 2,
      observed: 3,
      firsts: ["2026-05-14", "2026-06-12"],
      days: ["2026-05-14", "2026-06-12", "2026-06-13"],
    });
  });

  it("leaves out a little spotting either side of a period", () => {
    const d = logs(
      ["2026-05-12", spotting], // 2 days after the period ended
      ["2026-06-01", spotting], // 2 days before the next one
      ["2026-06-10", spotting], // 2 days after
      ["2026-06-29", spotting], // 2 days before
    );
    expect(betweenPeriods(cycles, spans(), d, DEFAULT_LUTEAL_DAYS)).toBeNull();
  });

  it("never counts spotting right around her estimated ovulation", () => {
    // Ovulation estimated 20 May and 17 Jun: a day either side is common, not a note.
    const d = logs(["2026-05-19", spotting], ["2026-05-21", spotting], ["2026-06-17", spotting]);
    expect(betweenPeriods(cycles, spans(), d, DEFAULT_LUTEAL_DAYS)).toBeNull();
  });

  it("estimates ovulation with the luteal length the prediction uses", () => {
    // With a learned 11-day luteal phase, 23 May is ovulation; with 14 days it would be a between-day.
    const d = logs(["2026-05-23", spotting], ["2026-06-20", spotting]);
    expect(betweenPeriods(cycles, spans(), d, 11)).toBeNull();
    expect(betweenPeriods(cycles, spans(), d, DEFAULT_LUTEAL_DAYS)).toMatchObject({ hits: 2 });
  });

  it("reads only her last 3 completed cycles", () => {
    const d = logs(["2026-04-16", spotting], ["2026-05-14", spotting]);
    // The April cycle is the oldest of four, so only the May one is read: once is not a pattern.
    expect(betweenPeriods(cycles, spans(), d, DEFAULT_LUTEAL_DAYS)).toBeNull();
  });

  it("needs two completed cycles at all", () => {
    const two = history("2026-06-03", [28]);
    const c = buildCycles(two, settings(), TODAY);
    expect(betweenPeriods(c, completedPeriods(two, TODAY, TYPICAL), logs(["2026-06-12", spotting]), 14)).toBeNull();
  });

  it("a day either side of ovulation is near it; two days is not", () => {
    expect(nearOvulation("2026-05-21", "2026-05-20")).toBe(true);
    expect(nearOvulation("2026-05-19", "2026-05-20")).toBe(true);
    expect(nearOvulation("2026-05-22", "2026-05-20")).toBe(false);
  });

  it("is built on periods, not red days: a closed period's own days never count", () => {
    const ep = [period("2026-05-06", 5), period("2026-06-03", 5), period("2026-07-01", 5)];
    const c = buildCycles(ep, settings(), TODAY);
    const d = logs(...run("2026-05-06", 5, { flow: "medium" }), ...run("2026-06-03", 5, { flow: "medium" }));
    expect(betweenPeriods(c, completedPeriods(ep, TODAY, TYPICAL), d, 14)).toBeNull();
  });
});

describe("the words", () => {
  it("says the denominator exactly", () => {
    expect(ofYourLast(2, 3, "periods with cramps")).toBe("in 2 of your last 3 periods with cramps");
    expect(ofYourLast(2, 2, "periods")).toBe("in both of your last 2 periods");
    expect(ofYourLast(3, 3, "cycles")).toBe("in all of your last 3 cycles");
  });
});

describe("the notes, in her numbers, in every mode", () => {
  const cramps = { symptoms: ["cramps" as const] };
  const stopped = { symptoms: ["cramps" as const], stoppedDay: true as const };
  /** Every check's evidence at once: stopped days, heavy periods with low energy, between-days. */
  const EVIDENCE = logs(
    ["2026-05-06", stopped],
    ["2026-06-03", cramps],
    ["2026-07-01", stopped],
    ["2026-07-02", stopped],
    ...run("2026-05-06", 3, { flow: "heavy" }),
    ["2026-05-07", { energy: "low" }],
    ...run("2026-07-01", 3, { flow: "heavy" }),
    ["2026-07-03", { energy: "low" }],
    ["2026-05-14", { flow: "spotting" }],
    ["2026-06-12", { flow: "spotting" }],
  );

  const notesIn = (mode: CycleMode, since: string | null = null) =>
    doctorNotes({
      cycles: buildCycles(PERIODS, settings(), TODAY, since),
      episodes: PERIODS,
      today: TODAY,
      mode,
      days: EVIDENCE,
      typicalBleed: TYPICAL,
      since,
    });
  const ids = (mode: CycleMode, since: string | null = null): DoctorNoteId[] =>
    notesIn(mode, since)
      .map((n) => n.id)
      .filter((id) => id === "cramps_disruptive" || id === "heavy_periods" || id === "between_periods");

  it("says what was seen, in her numbers, and that it's worth raising", () => {
    const byId = Object.fromEntries(notesIn("normal").map((n) => [n.id, n.body]));
    expect(byId.cramps_disruptive).toBe(
      "Cramps kept you from your day in 2 of your last 3 periods with cramps (3 days in all). Pain that stops your normal day is worth mentioning to a doctor. It's the sign they look for, and there's usually something that helps.",
    );
    expect(byId.heavy_periods).toContain("You logged a heavy flow on 3 or more days");
    expect(byId.heavy_periods).toContain("(3, 3 days)");
    expect(byId.heavy_periods).toContain("A simple blood test can check your iron.");
    expect(byId.between_periods).toMatch(/^Bleeding between periods in 2 of your last 3 cycles \(14 May, 12 Jun\)\./);
  });

  it("never names a condition", () => {
    for (const n of notesIn("normal")) {
      expect(n.body).not.toMatch(/endometriosis|fibroid|anaemi|anemi|polyp|cancer|adenomyosis|infection/i);
    }
  });

  it("normal: all three", () => {
    expect(ids("normal")).toEqual(["cramps_disruptive", "heavy_periods", "between_periods"]);
  });

  it("hormonal contraception: cramps and heavy bleeds, never 'between periods'", () => {
    expect(ids("hormonal")).toEqual(["cramps_disruptive", "heavy_periods"]);
    const heavy = notesIn("hormonal").find((n) => n.id === "heavy_periods");
    expect(heavy?.title).toBe("Heavy bleeds");
    expect(heavy?.body).toContain("whoever prescribes your contraception");
    expect(heavy?.body).not.toMatch(/period/);
  });

  it("pregnancy: none", () => {
    expect(ids("pregnancy")).toEqual([]);
  });

  it("menopause: only the cramps note; any bleeding already has its own", () => {
    expect(ids("menopause")).toEqual(["cramps_disruptive"]);
    expect(notesIn("menopause").map((n) => n.id)).toContain("menopause_bleeding");
  });

  it("postpartum: all three, counted only from the fresh start", () => {
    expect(ids("postpartum", "2026-05-01")).toEqual(["cramps_disruptive", "heavy_periods", "between_periods"]);
    // From June, only one heavy period, one cycle with bleeding between, one stopped period remain.
    expect(ids("postpartum", "2026-06-01")).toEqual([]);
  });

  it("a dismissed note comes back only when its evidence changes", () => {
    const notes = notesIn("normal");
    const dismissed = Object.fromEntries(notes.map((n) => [n.id, n.signature]));
    expect(visibleNotes(notes, { dismissedFlags: dismissed })).toEqual([]);
    const more = doctorNotes({
      cycles: buildCycles(PERIODS, settings(), TODAY),
      episodes: PERIODS,
      today: TODAY,
      mode: "normal",
      days: { ...EVIDENCE, ...logs(["2026-07-12", { flow: "spotting" }]) },
      typicalBleed: TYPICAL,
    });
    expect(visibleNotes(more, { dismissedFlags: dismissed }).map((n) => n.id)).toEqual(["between_periods"]);
  });

  it("names the denominator honestly when some periods had no flow logged", () => {
    // 3 heavy days in the April and July periods only; May and June logged nothing.
    const d = logs(...run("2026-04-08", 3, { flow: "heavy" }), ...run("2026-07-01", 3, { flow: "heavy" }));
    const r = heavyPeriods(spans(), d);
    expect(r?.consecutive).toBe(false);
    expect(ofTheRecent(2, 2, "periods you logged flow in")).toBe("in both of the 2 recent periods you logged flow in");
  });
});

describe("the stored field", () => {
  it("keeps 'kept me from my day' only beside cramps", () => {
    expect(normalizeDayLog("2026-07-01", { symptoms: ["cramps"], stoppedDay: true, updatedAt: NOW })?.stoppedDay).toBe(true);
    expect(normalizeDayLog("2026-07-01", { symptoms: ["headache"], stoppedDay: true, updatedAt: NOW })?.stoppedDay).toBeUndefined();
    expect(normalizeDayLog("2026-07-01", { symptoms: ["cramps"], stoppedDay: "yes", updatedAt: NOW })?.stoppedDay).toBeUndefined();
  });

  it("a day holding it is not an empty day", () => {
    expect(isEmptyDayLog(day("2026-07-01", { stoppedDay: true }))).toBe(false);
  });

  it("is exported: a column in the spreadsheet, a line in the doctor summary", () => {
    const data = {
      settings: settings(),
      periods: [period("2026-07-01", 5)],
      days: logs(["2026-07-01", { symptoms: ["cramps"], stoppedDay: true }], ["2026-07-02", { symptoms: ["cramps"] }]),
    };
    const csv = cycleCsv(data).split("\n");
    const header = csv[0].split(",");
    const col = header.indexOf("kept_from_day");
    expect(col).toBeGreaterThan(0);
    expect(csv.find((r) => r.startsWith("day,2026-07-01"))?.split(",")[col]).toBe("yes");
    expect(csv.find((r) => r.startsWith("day,2026-07-02"))?.split(",")[col]).toBe("");
    const summary = doctorSummary({ data, cycles: [], prediction: null, notes: [], today: TODAY });
    expect(summary).toContain("Days cramps stopped school, work or plans: 1.");
  });
});

describe("spotting around ovulation is explained, not counted", () => {
  const cycles = buildCycles(PERIODS, settings(), TODAY);
  const prediction = predict({ episodes: PERIODS, days: {}, settings: settings(), today: TODAY });
  const at = (date: string, mode: CycleMode = "normal", inPeriod = false) =>
    spottingNote({ date, log: day(date, { flow: "spotting" }), inPeriod, mode, prediction, cycles });

  it("says so for spotting a day either side of a past cycle's estimated ovulation", () => {
    // 2026-11-20: ovulation is 13 days before the next start now (was 14): 21 May.
    expect(at("2026-05-20")).toBe(OVULATION_SPOTTING_LINE);
    expect(at("2026-05-22")).toBe(OVULATION_SPOTTING_LINE);
    expect(at("2026-05-23")).toBeNull();
  });

  it("and in this cycle, from the prediction's own estimate", () => {
    expect(prediction).not.toBeNull();
    expect(at(prediction!.ovulation)).toBe(OVULATION_SPOTTING_LINE);
  });

  it("names no date, so it's the same with the fertile window off", () => {
    expect(OVULATION_SPOTTING_LINE).not.toMatch(/\d/);
  });

  it("is off where nothing is estimated, and for anything but spotting", () => {
    expect(at("2026-05-20", "menopause")).toBeNull();
    expect(at("2026-05-20", "hormonal")).toBeNull();
    expect(at("2026-05-20", "normal", true)).toBeNull();
    expect(
      spottingNote({ date: "2026-05-20", log: day("2026-05-20", { flow: "light" }), inPeriod: false, mode: "normal", prediction, cycles }),
    ).toBeNull();
  });
});
