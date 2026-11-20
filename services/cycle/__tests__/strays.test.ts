/**
 * CLEAN HISTORY (2026-11-20, Fix 11 + the repair half of Fix 1).
 *
 * Builds before 2026-11-20 turned any light, medium or heavy flow outside a
 * period into a NEW period. Those phantom periods are already in people's
 * synced logs, so nothing is rewritten: every read splits the list into the
 * periods and the "strays" — episodes that start fewer than 15 days after the
 * previous period began, which are bleeding between periods. And the same
 * period logged on two phones (two ids, one start) reads as one period.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { addDays } from "../dates";
import { betweenPeriods, completedPeriods, strayBleedDays } from "../doctorChecks";
import { CONTINUATION_GAP_DAYS, MIN_COUNTED_CYCLE, splitEpisodes } from "../episodes";
import { CSV_COLUMNS, cycleCsv, doctorSummary } from "../exportData";
import { doctorNotes } from "../flags";
import { startReceipt } from "../nextDates";
import { buildCycles, predict, todayStatus, typicalPeriodLength } from "../predict";
import { CYCLE_KEYS, loadCycleData, savePeriods, saveSettings } from "../store";
import type { PeriodEpisode } from "../types";
import { computeView } from "../view";
import { paintDays } from "../visual";
import { day, days, history, period, settings } from "./helpers";

const ADULT = { age: 30, conditions: [] as string[] };
const BASE = history("2026-05-01", [28, 28, 28, 28, 28]); // last start 2026-09-18
const LAST = "2026-09-18";
const s = settings({ usualCycleDays: 28, usualPeriodDays: 5 });

/** The phantom an old build wrote for a light flow on cycle day 14, closed later at her typical length. */
const PHANTOM: PeriodEpisode = {
  id: "phantom",
  start: addDays(LAST, 13),
  end: addDays(LAST, 17),
  endEstimated: true,
  updatedAt: "2026-10-01T09:00:00.000Z",
};

describe("splitEpisodes", () => {
  it("a plain history is all periods", () => {
    const { periods, strays } = splitEpisodes(BASE);
    expect(periods).toHaveLength(BASE.length);
    expect(strays).toEqual([]);
  });

  it(`a bleed starting fewer than ${MIN_COUNTED_CYCLE} days after a period began is a stray`, () => {
    const early = period(addDays(LAST, MIN_COUNTED_CYCLE - 1), 2);
    const { periods, strays } = splitEpisodes([...BASE, early]);
    expect(strays.map((e) => e.start)).toEqual([early.start]);
    expect(periods[periods.length - 1].start).toBe(LAST);
  });

  it(`${MIN_COUNTED_CYCLE} days or more after is a period`, () => {
    const next = period(addDays(LAST, MIN_COUNTED_CYCLE));
    expect(splitEpisodes([...BASE, next]).strays).toEqual([]);
  });

  it("measures from the previous PERIOD, not from the stray", () => {
    const stray = period(addDays(LAST, 10), 2);
    const next = period(addDays(LAST, 20));
    const { periods, strays } = splitEpisodes([...BASE, stray, next]);
    expect(strays.map((e) => e.start)).toEqual([stray.start]);
    expect(periods[periods.length - 1].start).toBe(next.start);
  });

  it(`two episodes starting within ${CONTINUATION_GAP_DAYS + 1} days are one period: earlier start, later end`, () => {
    for (const apart of [0, 1, CONTINUATION_GAP_DAYS + 1]) {
      const a: PeriodEpisode = { id: "a", start: "2026-10-16", end: "2026-10-19", updatedAt: "x" };
      const b: PeriodEpisode = { id: "b", start: addDays("2026-10-16", apart), end: "2026-10-21", updatedAt: "x" };
      const { periods, strays } = splitEpisodes([...BASE, a, b]);
      expect(strays).toEqual([]);
      expect(periods[periods.length - 1]).toMatchObject({ start: "2026-10-16", end: "2026-10-21" });
      expect(periods).toHaveLength(BASE.length + 1);
    }
  });

  it("ignores tombstones", () => {
    expect(splitEpisodes([...BASE, { ...PHANTOM, deleted: true }]).strays).toEqual([]);
  });
});

describe("every reader that means 'a period' reads the periods", () => {
  const OLD = [...BASE, PHANTOM];
  const TODAY = addDays(LAST, 20);

  it("cycles, the forecast and today's status ignore the phantom", () => {
    expect(buildCycles(OLD, s, TODAY)).toEqual(buildCycles(BASE, s, TODAY));
    const input = { episodes: OLD, days: {}, settings: s, today: TODAY, profile: ADULT };
    const clean = { ...input, episodes: BASE };
    expect(predict(input)).toEqual(predict(clean));
    expect(todayStatus(input, predict(input))).toEqual(todayStatus(clean, predict(clean)));
  });

  it("on the stray's own day, she is not 'in a period' and the cycle day counts from the real one", () => {
    const open: PeriodEpisode = { id: "open-stray", start: addDays(LAST, 12), end: null, updatedAt: "x" };
    const today = addDays(LAST, 13);
    const input = { episodes: [...BASE, open], days: {}, settings: s, today, profile: ADULT };
    const st = todayStatus(input, predict(input));
    expect(st.inPeriod).toBe(false);
    expect(st.cycleDay).toBe(14);
  });

  it("her typical bleed ignores a stray's length", () => {
    const long = { ...period(addDays(LAST, 10), 9) };
    expect(typicalPeriodLength([...BASE, long], s)).toEqual(typicalPeriodLength(BASE, s));
  });

  it("the doctor checks' periods ignore it", () => {
    expect(completedPeriods(OLD, TODAY, 5)).toEqual(completedPeriods(BASE, TODAY, 5));
  });

  it("no 'we said / it came' receipt for a stray", () => {
    const stray = { ...period(addDays(LAST, 12), 1), end: null, updatedAt: new Date().toISOString() };
    const today = addDays(LAST, 12);
    expect(startReceipt({ episodes: [...BASE, stray], days: {}, settings: s, profile: ADULT, today })).toBeNull();
  });
});

describe("a stray is bleeding between periods", () => {
  it("its first day always; the rest only when she ended it herself", () => {
    expect([...strayBleedDays([...BASE, PHANTOM])]).toEqual([PHANTOM.start]);
    const ended = { ...period(addDays(LAST, 10), 3) };
    expect([...strayBleedDays([...BASE, ended])]).toEqual([ended.start, addDays(ended.start, 1), addDays(ended.start, 2)]);
  });

  it("the between-periods check sees it, even with no flow logged", () => {
    const p2 = addDays(LAST, 28);
    const p3 = addDays(p2, 28);
    const eps = [
      ...BASE,
      { ...PHANTOM },
      period(p2),
      { ...PHANTOM, id: "phantom2", start: addDays(p2, 11), end: addDays(p2, 15) },
      period(p3),
    ];
    const today = addDays(p3, 10);
    const cycles = buildCycles(eps, s, today);
    const spans = completedPeriods(eps, today, 5);
    expect(betweenPeriods(cycles, spans, {}, 13)).toBeNull();
    expect(betweenPeriods(cycles, spans, {}, 13, strayBleedDays(eps))).toMatchObject({ hits: 2 });
    const notes = doctorNotes({ cycles, episodes: eps, today, mode: "normal", profile: ADULT, days: {}, typicalBleed: 5 });
    expect(notes.map((n) => n.id)).toContain("between_periods");
  });

  it("spotting right at the estimated ovulation is still left out; light bleeding there is not", () => {
    const p2 = addDays(LAST, 28);
    const p3 = addDays(p2, 28);
    const eps = [...BASE, period(p2), period(p3)];
    const today = addDays(p3, 10);
    const cycles = buildCycles(eps, s, today);
    const spans = completedPeriods(eps, today, 5);
    // Ovulation = next start − 13: day 16 of each cycle.
    const ov1 = addDays(p2, -13);
    const ov2 = addDays(p3, -13);
    const spot = days(day(ov1, { flow: "spotting" }), day(ov2, { flow: "spotting" }));
    expect(betweenPeriods(cycles, spans, spot, 13)).toBeNull();
    const light = days(day(ov1, { flow: "light" }), day(ov2, { flow: "light" }));
    expect(betweenPeriods(cycles, spans, light, 13)).toMatchObject({ hits: 2 });
  });

  it("the calendar draws it as bleeding between periods, not as a period", () => {
    const today = addDays(LAST, 20);
    const data = { settings: s, periods: [...BASE, PHANTOM], days: days(day(addDays(LAST, 15), { flow: "spotting" })) };
    const view = computeView(data, { today, profile: ADULT });
    const paint = paintDays({ episodes: data.periods, days: data.days, view, today, showFertile: false });
    expect(paint(PHANTOM.start)).toMatchObject({ period: null, between: true });
    expect(paint(addDays(PHANTOM.start, 1)).between).toBe(false); // an assumed end is not bleeding
    expect(paint(addDays(LAST, 15)).between).toBe(true); // spotting outside a period
    expect(paint(LAST)).toMatchObject({ period: "logged", between: false });
  });

  it("a long stray she ended herself still raises the long-bleed note, called bleeding", () => {
    const long = period(addDays(LAST, 10), 10);
    const today = addDays(LAST, 25);
    const eps = [...BASE, long];
    const notes = doctorNotes({ cycles: buildCycles(eps, s, today), episodes: eps, today, mode: "normal", profile: ADULT });
    const note = notes.find((n) => n.id === "long_bleeding")!;
    expect(note.title).toBe("A long bleed");
    expect(note.body).toMatch(/^Bleeding from /);
  });

  it("with menopause on the profile, a stray bleed still raises the bleeding note", () => {
    const eps = [period("2026-08-01"), period("2026-08-10", 2)];
    const today = "2026-08-20";
    const notes = doctorNotes({ cycles: [], episodes: eps, today, mode: "menopause", profile: { age: 55, conditions: ["menopause"] } });
    expect(notes.find((n) => n.id === "menopause_bleeding")?.signature).toBe("2026-08-10");
  });

  it("her export lists it as bleeding between periods", () => {
    const data = { settings: s, periods: [...BASE, PHANTOM], days: {} };
    const csv = cycleCsv(data).split("\n");
    expect(csv.filter((r) => r.startsWith("period,"))).toHaveLength(BASE.length);
    const pad = ",".repeat(CSV_COLUMNS.length - 3);
    expect(csv).toContain(`bleeding_between,${PHANTOM.start},${PHANTOM.end}${pad}`);
    const today = addDays(LAST, 20);
    const view = computeView(data, { today, profile: ADULT });
    const summary = doctorSummary({ data, cycles: view.cycles, prediction: view.prediction, notes: [], today });
    expect(summary).toContain(`${BASE.length} periods`);
    expect(summary).toMatch(/Bleeding logged between periods, starting: /);
  });
});

describe("every mode reads the same split", () => {
  const MODES: [string, string[]][] = [
    ["normal", []],
    ["postpartum", ["postpartum"]],
    ["menopause", ["menopause"]],
    ["pregnancy", ["pregnancy"]],
  ];
  it.each(MODES)("%s: the phantom never becomes the cycle's start", (_mode, conditions) => {
    const today = addDays(LAST, 20);
    const old = computeView({ settings: s, periods: [...BASE, PHANTOM], days: {} }, { today, profile: { age: 30, conditions } });
    const clean = computeView({ settings: s, periods: BASE, days: {} }, { today, profile: { age: 30, conditions } });
    expect(old.status.cycleDay).toBe(clean.status.cycleDay);
    expect(old.prediction).toEqual(clean.prediction);
    expect(old.cycles).toEqual(clean.cycles);
  });

  it("hormonal: logging only, and the split still holds for the doctor notes", () => {
    const hormonal = settings({ contraception: { answer: "hormonal", since: "2026-01-01", restartFrom: null } });
    const today = addDays(LAST, 20);
    const v = computeView({ settings: hormonal, periods: [...BASE, PHANTOM], days: {} }, { today, profile: ADULT });
    expect(v.prediction).toBeNull();
    expect(v.status.cycleDay).toBe(21);
  });
});

describe("loading tidies the list, and writes only when it changed", () => {
  beforeEach(async () => {
    for (const k of await AsyncStorage.getAllKeys()) await AsyncStorage.removeItem(k);
  });

  it("a clean list is left exactly as stored", async () => {
    await saveSettings(s);
    await savePeriods(BASE, true);
    const before = await AsyncStorage.getItem(CYCLE_KEYS.periods);
    await loadCycleData("2026-10-20");
    expect(await AsyncStorage.getItem(CYCLE_KEYS.periods)).toBe(before);
  });

  it("a phantom is NOT rewritten: it is derived away on every read, never deleted", async () => {
    await saveSettings(s);
    await savePeriods([...BASE, PHANTOM], true);
    const loaded = await loadCycleData("2026-10-20");
    expect(loaded.periods.find((e) => e.id === "phantom")?.deleted).toBeUndefined();
  });

  it("a duplicate is folded into one period, and the tidy list is stored once", async () => {
    await saveSettings(s);
    const dupe: PeriodEpisode = { ...BASE[BASE.length - 1], id: "zz-copy" };
    await savePeriods([...BASE, dupe], true);
    const first = await loadCycleData("2026-10-20");
    expect(first.periods.find((e) => e.id === "zz-copy")?.deleted).toBe(true);
    const stored = await AsyncStorage.getItem(CYCLE_KEYS.periods);
    await loadCycleData("2026-10-20");
    expect(await AsyncStorage.getItem(CYCLE_KEYS.periods)).toBe(stored);
  });

  it("on the device-only keys too", async () => {
    await saveSettings({ ...s, backupOn: false });
    const dupe: PeriodEpisode = { ...BASE[BASE.length - 1], id: "zz-copy" };
    await savePeriods([...BASE, dupe], false);
    await loadCycleData("2026-10-20");
    expect(await AsyncStorage.getItem(CYCLE_KEYS.periods)).toBeNull();
  });
});
