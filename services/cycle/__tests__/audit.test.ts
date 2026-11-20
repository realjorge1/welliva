/**
 * THE 2026-11-16 AUDIT, REPLAYED (docs/prompts/05-cycle-engine-fixes.md).
 *
 * The audit ran the real engine on made-up histories and measured eleven
 * flaws. Each test here is one acceptance line from that brief, written BEFORE
 * the fix and watched failing, then made to pass by the fix itself. They read
 * the engine's public results only — the same numbers a screen would show.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { cycleEventSpecs } from "../../calendar/events";
import { merge } from "../../sync/mergeStrategies";
import { addDays, daysBetween } from "../dates";
import { applyDayPatch, type DayPatch } from "../dayWrite";
import { liveEpisodes, startPeriod } from "../episodes";
import { doctorNotes } from "../flags";
import { buildCycles, DEFAULT_LUTEAL_DAYS, median, predict, type CycleProfile, type PredictInput } from "../predict";
import { CYCLE_KEYS, loadCycleData, savePeriods, saveSettings } from "../store";
import type { CycleData, CycleDays, CycleSettings, PeriodEpisode } from "../types";
import { computeView } from "../view";
import { paintDays } from "../visual";
import { day, days, history, period, settings } from "./helpers";

const ADULT: CycleProfile = { age: 30, conditions: [] };
const stamp = (date: string) => `${date}T09:00:00.000Z`;

function input(episodes: readonly PeriodEpisode[], today: string, patch: Partial<PredictInput> = {}): PredictInput {
  return {
    episodes,
    days: {},
    settings: settings({ usualCycleDays: 28, usualPeriodDays: 5, showFertileWindow: true }),
    today,
    profile: ADULT,
    ...patch,
  };
}

/* ───────────────────────── Fix 4: her setup answer fades ───────────────────────── */

describe("Fix 4: with 6+ counted cycles, the forecast follows her cycles, not her setup answer", () => {
  const LONG = [38, 42, 36, 44, 39, 41, 37, 43, 40, 38, 42, 39];
  const eps = history("2025-01-05", LONG);
  const lastStart = eps[eps.length - 1].start;
  const today = addDays(lastStart, 10);
  const lastSix = median(LONG.slice(-6)); // 39.5

  it.each([
    ["told 28", ADULT],
    ["told 28, PCOS on the profile", { age: 30, conditions: ["pcos"] }],
    ["told 28, age 17", { age: 17, conditions: [] }],
  ])("36–44-day cycles, %s → within a day of 39.5", (_label, profile) => {
    const p = predict(input(eps, today, { profile }))!;
    expect(Math.abs(p.meanLength - lastSix)).toBeLessThanOrEqual(1);
  });

  it("a steady 32, told 28 → 32", () => {
    const steady = history("2025-01-05", Array(12).fill(32));
    const p = predict(input(steady, addDays(steady[steady.length - 1].start, 10)))!;
    expect(Math.abs(p.meanLength - 32)).toBeLessThanOrEqual(1);
  });
});

/* ───────────────── Fix 1: bleeding between periods is not a new period ───────────────── */

describe("Fix 1: light bleeding on cycle day 14 leaves her history alone", () => {
  const BASE = history("2026-05-01", [28, 28, 28, 28, 28]); // last start 2026-09-18
  const LAST = "2026-09-18";
  const D14 = addDays(LAST, 13);
  const s = settings({ usualCycleDays: 28, usualPeriodDays: 5, showFertileWindow: true });
  const data0: CycleData = { settings: s, periods: BASE, days: {} };

  /** A flow logged through the day sheet's real write path. */
  const logFlow = (data: CycleData, date: string, flow: DayPatch["flow"], today = date): CycleData =>
    applyDayPatch(data, date, { flow }, { today, now: stamp(today), profile: ADULT });
  /** "Period started" on that day. */
  const started = (data: CycleData, date: string): CycleData => ({
    ...data,
    periods: startPeriod(data.periods, date, date, 5, stamp(date)),
  });
  const lengths = (data: CycleData, today: string) => buildCycles(data.periods, data.settings, today).map((c) => c.length);

  it("on the day: same last start, same likely day, same cycles", () => {
    const after = logFlow(data0, D14, "light");
    const clean = predict({ ...input(data0.periods, D14), days: data0.days })!;
    const logged = predict({ ...input(after.periods, D14), days: after.days })!;
    expect(logged.lastStart).toBe(clean.lastStart);
    expect(logged.likely).toBe(clean.likely);
    expect(lengths(after, D14)).toEqual(lengths(data0, D14));
  });

  it("once the real period comes: her 28-day cycle is still a 28-day cycle", () => {
    const real = addDays(LAST, 28);
    const withLog = started(logFlow(data0, D14, "light"), real);
    const without = started(data0, real);
    expect(lengths(withLog, real)).toEqual(lengths(without, real));
    expect(lengths(withLog, real)).toEqual([28, 28, 28, 28, 28, 28]);
  });

  it("the doctor check can see bleeding between periods (two cycles of it)", () => {
    const p2 = addDays(LAST, 28);
    const p3 = addDays(p2, 28);
    let data = logFlow(data0, D14, "light");
    data = started(data, p2);
    data = logFlow(data, addDays(p2, 13), "light");
    data = started(data, p3);
    const today = addDays(p3, 8);
    const ended = { ...data, periods: data.periods.map((e) => (e.end === null ? { ...e, end: addDays(e.start, 4) } : e)) };
    const view = computeView(ended, { today, profile: ADULT });
    expect(view.allNotes.map((n) => n.id)).toContain("between_periods");
    expect(view.cycles.map((c) => c.length)).toEqual([28, 28, 28, 28, 28, 28, 28]);
  });

  it("data written by the old code (the phantom period already in the list) reads like the clean history", () => {
    const phantom: PeriodEpisode = { id: "zz-phantom", start: D14, end: null, updatedAt: stamp(D14) };
    const old = [...BASE, phantom];
    const clean = predict(input(BASE, D14))!;
    const fromOld = predict(input(old, D14))!;
    expect(fromOld.lastStart).toBe(clean.lastStart);
    expect(fromOld.likely).toBe(clean.likely);
    // ...and once the real period has come, the phantom was closed by the old code.
    const real = addDays(LAST, 28);
    const closed: PeriodEpisode = { ...phantom, end: addDays(D14, 4), endEstimated: true };
    const later = [...BASE, closed, period(real)];
    expect(buildCycles(later, s, addDays(real, 6)).map((c) => c.length)).toEqual([28, 28, 28, 28, 28, 28]);
  });
});

/* ───────────────────────── Fix 2: an honest fertile window ───────────────────────── */

describe("Fix 2: the fertile window widens with uncertainty", () => {
  const width = (p: { fertileStart: string; fertileEnd: string }) => daysBetween(p.fertileStart, p.fertileEnd) + 1;
  const at = (lengths: number[]) => {
    const eps = history("2026-01-04", lengths);
    return predict(input(eps, addDays(eps[eps.length - 1].start, 2)))!;
  };

  it("a very regular history (six 28-day cycles): at most 8 days", () => {
    expect(width(at([28, 28, 28, 28, 28, 28]))).toBeLessThanOrEqual(8);
  });

  it("the variable 24–40 history: at least 14 days", () => {
    expect(width(at([24, 35, 27, 40, 26, 33]))).toBeGreaterThanOrEqual(14);
  });

  it("no logged cycles yet (only what she told us): a wide window", () => {
    const p = predict(input([period("2026-10-01")], "2026-10-03"))!;
    expect(width(p)).toBeGreaterThanOrEqual(10);
  });

  it("more uncertainty never narrows it", () => {
    const histories = [
      [28, 28, 28, 28, 28, 28],
      [27, 29, 28, 27, 29, 28],
      [26, 30, 28, 26, 30, 28],
      [25, 32, 27, 34, 24, 31],
      [24, 35, 27, 40, 26, 33],
    ];
    const widths = histories.map((h) => width(at(h)));
    for (let i = 1; i < widths.length; i += 1) expect(widths[i]).toBeGreaterThanOrEqual(widths[i - 1]);
    expect(widths[widths.length - 1]).toBeGreaterThan(widths[0]);
  });
});

/* ─────────────────── Fix 5: the first positive test, and the negatives ─────────────────── */

describe("Fix 5: ovulation tests", () => {
  const eps = history("2026-04-01", [28, 28, 28, 28, 28]); // last start 2026-08-19
  const LAST = "2026-08-19";
  const cd = (n: number) => addDays(LAST, n - 1);

  it("positives on cycle days 13, 14, 15: the surge began on day 13, ovulation day 14", () => {
    const logs = days(
      day(cd(13), { ovulationTest: "positive" }),
      day(cd(14), { ovulationTest: "positive" }),
      day(cd(15), { ovulationTest: "positive" }),
    );
    const p = predict({ ...input(eps, cd(17)), days: logs })!;
    expect(p.fromTest).toBe(cd(13));
    expect(p.ovulation).toBe(cd(14));
  });

  it("a run of negatives around the estimate moves ovulation and the period later", () => {
    const calendar = predict(input(eps, cd(19)))!;
    const logs: CycleDays = {};
    for (let n = 14; n <= 18; n += 1) logs[cd(n)] = day(cd(n), { ovulationTest: "negative" });
    const p = predict({ ...input(eps, cd(19)), days: logs })!;
    expect(p.ovulation > cd(18)).toBe(true);
    expect(p.likely > calendar.likely).toBe(true);
  });
});

/* ───────────────────────── Fix 6: the textbook second half ───────────────────────── */

describe("Fix 6: the default second half of the cycle", () => {
  it("is 13 days (Bull et al. 2019: mean 12.4)", () => {
    expect(DEFAULT_LUTEAL_DAYS).toBe(13);
  });
});

/* ───────────────────────── Fix 3: late is information ───────────────────────── */

describe("Fix 3: ten days late, nothing shows a stale date", () => {
  const eps = history("2026-03-04", [28, 28, 28, 28, 28, 28]); // last start 2026-08-19
  const LAST = eps[eps.length - 1].start;
  const TODAY = addDays(LAST, 40);
  const s = settings({ usualCycleDays: 28, usualPeriodDays: 5, showFertileWindow: true });
  const data: CycleData = { settings: s, periods: eps, days: {} };
  const view = computeView(data, { today: TODAY, profile: ADULT });

  it("is late by 10 days", () => {
    expect(view.status.lateBy).toBe(10);
  });

  it("predict: no next period earlier than today", () => {
    const p = view.prediction!;
    expect(p.earliest >= TODAY).toBe(true);
    expect(p.likely >= TODAY).toBe(true);
  });

  it("the calendar: no second cycle projected from the missed date, no fertile days ahead", () => {
    const paint = paintDays({ episodes: eps, days: {}, view, today: TODAY, showFertile: true });
    const ahead = Array.from({ length: 90 }, (_, i) => addDays(TODAY, i));
    const predicted = ahead.filter((d) => paint(d).period === "predicted");
    // Only the rolling "any day now" stretch: nothing a whole cycle out.
    expect(predicted.every((d) => daysBetween(TODAY, d) <= 12)).toBe(true);
    expect(ahead.some((d) => paint(d).fertile || paint(d).ovulation)).toBe(false);
  });

  it("the phone calendar: no rough second block, nothing dated before today", () => {
    const specs = cycleEventSpecs({ prediction: view.prediction, discreet: false, fertileWindow: true, today: TODAY });
    expect(specs.map((x) => x.key)).not.toContain("c:p2");
    expect(specs.every((x) => x.end.getTime() > new Date(2026, 8, 28).getTime())).toBe(true);
    expect(specs.some((x) => x.key === "c:w1")).toBe(false);
  });

  it("no estimated ovulation ahead of her this cycle", () => {
    expect(view.prediction!.ovulation <= TODAY).toBe(true);
  });
});

/* ──────────────── Fix 9: a long cycle she never answered about still counts ──────────────── */

describe("Fix 9: unanswered long gaps", () => {
  it("one 70-day gap still reaches the long-cycles note, 'if that was one real cycle'", () => {
    const eps = history("2025-12-01", [28, 40, 28, 70, 28]);
    const today = addDays(eps[eps.length - 1].start, 10);
    const s = settings({ usualCycleDays: 28 });
    const cycles = buildCycles(eps, s, today);
    expect(cycles.find((c) => c.length === 70)?.status).toBe("gap");
    const notes = doctorNotes({ cycles, episodes: eps, today, mode: "normal", profile: ADULT });
    const long = notes.find((n) => n.id === "long_cycles");
    expect(long).toBeDefined();
    expect(long!.body).toMatch(/if that was one real cycle/i);
  });

  it("two unanswered gaps in her last four: counted, not called missed logs", () => {
    const eps = history("2025-10-01", [28, 28, 64, 28, 66]);
    const today = addDays(eps[eps.length - 1].start, 10);
    const cycles = buildCycles(eps, settings({ usualCycleDays: 28 }), today);
    expect(cycles.filter((c) => c.length > 60).every((c) => c.status === "counted")).toBe(true);
  });

  it("a 50-day cycle is a cycle, not a likely missed log", () => {
    const eps = history("2026-01-01", [28, 28, 50, 28]);
    const cycles = buildCycles(eps, settings({ usualCycleDays: 28 }), "2026-07-01");
    expect(cycles.find((c) => c.length === 50)?.status).toBe("counted");
  });
});

/* ───────────────────────── Fix 10: one medical standard ───────────────────────── */

describe("Fix 10: FIGO 2018 everywhere", () => {
  const notesFor = (lengths: number[], age = 30, bleed = 5) => {
    const eps = history("2025-11-01", lengths, bleed);
    const today = addDays(eps[eps.length - 1].start, 12);
    const s = settings({ usualCycleDays: 28 });
    const cycles = buildCycles(eps, s, today);
    return doctorNotes({ cycles, episodes: eps, today, mode: "normal", profile: { age, conditions: [] } }).map((n) => n.id);
  };

  it("short means under 24 days", () => {
    expect(notesFor([23, 23, 28, 28])).toContain("short_cycles");
    expect(notesFor([24, 24, 28, 28])).not.toContain("short_cycles");
  });

  it("long means over 38 days", () => {
    expect(notesFor([39, 39, 28, 28])).toContain("long_cycles");
    expect(notesFor([38, 38, 28, 28])).not.toContain("long_cycles");
  });

  it("a long bleed means more than 8 days", () => {
    expect(notesFor([28, 28, 28], 30, 9)).toContain("long_bleeding");
    expect(notesFor([28, 28, 28], 30, 8)).not.toContain("long_bleeding");
  });

  it("under 20, the normal range is 21 to 45 days", () => {
    expect(notesFor([44, 44, 28, 28], 17)).not.toContain("long_cycles");
    expect(notesFor([44, 44, 28, 28], 30)).toContain("long_cycles");
    expect(notesFor([22, 22, 28, 28], 17)).not.toContain("short_cycles");
  });
});

/* ─────────────── Fix 11: the same period on two phones is one period ─────────────── */

describe("Fix 11: duplicate periods from two phones", () => {
  const base = history("2026-04-22", [28, 28, 28, 28, 28]); // last start 2026-09-09
  const dupeStart = "2026-10-07";
  const onA: PeriodEpisode = { id: "per_a", start: dupeStart, end: "2026-10-11", updatedAt: "2026-10-07T08:00:00.000Z" };
  const onB: PeriodEpisode = { id: "per_b", start: dupeStart, end: "2026-10-11", updatedAt: "2026-10-07T09:00:00.000Z" };
  const s: CycleSettings = settings({ usualCycleDays: 28 });

  beforeEach(async () => {
    for (const k of await AsyncStorage.getAllKeys()) await AsyncStorage.removeItem(k);
  });

  it("the engine never reads a near-zero 'cycle', even before anything tidies the list", () => {
    const cycles = buildCycles([...base, onA, onB], s, "2026-10-20");
    expect(cycles.every((c) => c.length >= 15)).toBe(true);
  });

  it("loading tidies it, and writes the tidy list back", async () => {
    await saveSettings(s);
    await savePeriods([...base, onA, onB], true);
    const loaded = await loadCycleData();
    expect(liveEpisodes(loaded.periods).filter((e) => e.start === dupeStart)).toHaveLength(1);
    const stored = JSON.parse((await AsyncStorage.getItem(CYCLE_KEYS.periods)) ?? "[]") as PeriodEpisode[];
    expect(liveEpisodes(stored).filter((e) => e.start === dupeStart)).toHaveLength(1);
  });

  it("two phones merging either way end with the same one period", async () => {
    const phoneA = JSON.stringify([...base, onA]);
    const phoneB = JSON.stringify([...base, onB]);
    const survivors: string[] = [];
    for (const merged of [merge(CYCLE_KEYS.periods, phoneA, phoneB)!, merge(CYCLE_KEYS.periods, phoneB, phoneA)!]) {
      for (const k of await AsyncStorage.getAllKeys()) await AsyncStorage.removeItem(k);
      await saveSettings(s);
      await AsyncStorage.setItem(CYCLE_KEYS.periods, merged);
      const loaded = await loadCycleData();
      const live = liveEpisodes(loaded.periods).filter((e) => e.start === dupeStart);
      expect(live).toHaveLength(1);
      survivors.push(live[0].id);
      expect(buildCycles(loaded.periods, s, "2026-10-20").map((c) => c.length)).toEqual([28, 28, 28, 28, 28, 28]);
    }
    expect(survivors[0]).toBe(survivors[1]);
  });
});
