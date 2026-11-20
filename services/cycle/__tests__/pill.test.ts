/**
 * THE COMBINED PILL (2026-11-20, Fix 12 — the owner said yes, for the combined
 * pill only). One small forecast from the pack, "from your pack schedule",
 * never "your period"; another method stays log-only; the mode stays hormonal.
 */
import { describe, expect, it } from "vitest";

import { answerContraception, answerMethod, contraceptionForDoctor, contraceptionNote } from "../contraception";
import { cycleHeadline } from "../copy";
import { addDays } from "../dates";
import { cycleCsv } from "../exportData";
import { lateContext } from "../late";
import { PILL_HALF_WIDTH, PILL_LINE, pillForecast, pillLine } from "../pill";
import { cycleModeOf, predict, todayStatus } from "../predict";
import { planCycleReminders } from "../reminderPlan";
import { normalizeSettings, type Contraception, type CycleSettings, type PeriodEpisode } from "../types";
import { computeView } from "../view";
import { history, period, settings } from "./helpers";

const ADULT = { age: 30, conditions: [] as string[] };
const EPS = history("2026-07-01", [28, 28, 28]); // last bleed 2026-09-23
const LAST = "2026-09-23";
const onPill = (method: Contraception["method"], packDays?: number, discreet = false): CycleSettings =>
  settings({
    discreet,
    contraception: { answer: "hormonal", since: "2026-06-01", restartFrom: null, method, ...(packDays ? { packDays } : {}) },
  });
const view = (s: CycleSettings, today: string, periods: PeriodEpisode[] = EPS) =>
  computeView({ settings: s, periods, days: {} }, { today, profile: ADULT });

describe("the forecast", () => {
  it("combined pill, 28-day pack: the last bleed plus 28, give or take 2 — and the mode is still hormonal", () => {
    const v = view(onPill("combined_pill"), "2026-10-05");
    expect(v.mode).toBe("hormonal");
    expect(v.prediction).toBeNull();
    expect(v.pill).toEqual({
      from: LAST,
      earliest: addDays(LAST, 28 - PILL_HALF_WIDTH),
      likely: addDays(LAST, 28),
      latest: addDays(LAST, 28 + PILL_HALF_WIDTH),
      packDays: 28,
      missed: false,
    });
  });

  it("a 91-day pack counts 91", () => {
    expect(view(onPill("combined_pill", 91), "2026-10-05").pill?.likely).toBe(addDays(LAST, 91));
  });

  it("another method, or no answer to 'which one?', stays log-only", () => {
    expect(view(onPill("other"), "2026-10-05").pill).toBeNull();
    expect(view(onPill(undefined), "2026-10-05").pill).toBeNull();
    expect(view(settings(), "2026-10-05").pill).toBeNull();
  });

  it("past its window with no bleed: missed — and the screen's line is the late page's own test advice", () => {
    const today = addDays(LAST, 28 + PILL_HALF_WIDTH + 1);
    const v = view(onPill("combined_pill"), today);
    expect(v.pill?.missed).toBe(true);
    expect(pillLine(v.pill!)).toMatch(/^Your pack schedule put your bleed around .+, and none is logged yet\.$/);
    // No "late" section, no "why am I late": that stays off on hormonal contraception.
    expect(lateContext({ mode: v.mode, status: v.status, cycles: v.cycles, today, signals: { mind: [], workouts: [], intake: [], weighIns: [], events: [] } })).toBeNull();
  });

  it("a whole pack past it, it says nothing any more", () => {
    expect(view(onPill("combined_pill"), addDays(LAST, 28 + PILL_HALF_WIDTH + 29)).pill).toBeNull();
  });

  it("breakthrough bleeding soon after a withdrawal bleed doesn't restart the count", () => {
    const spot = period(addDays(LAST, 9), 2);
    expect(view(onPill("combined_pill"), "2026-10-05", [...EPS, spot]).pill?.from).toBe(LAST);
  });
});

describe("the words never say period", () => {
  it("the headline, the line, the note", () => {
    const v = view(onPill("combined_pill"), "2026-10-05");
    const h = cycleHeadline(v, false);
    expect(h.title).toMatch(/^Next bleed likely /);
    expect(h.detail).toBe("From your pack schedule.");
    for (const text of [h.title, h.detail, pillLine(v.pill!), PILL_LINE]) expect(text).not.toMatch(/\bperiod\b/i);
    expect(contraceptionNote(onPill("combined_pill").contraception)).toBe(PILL_LINE);
  });

  it("the doctor summary and the export say which method", () => {
    expect(contraceptionForDoctor(onPill("combined_pill", 91).contraception)).toContain("the combined pill, 91-day pack");
    expect(contraceptionForDoctor(onPill("other").contraception)).toContain("a method other than the combined pill");
    const csv = cycleCsv({ settings: onPill("combined_pill"), periods: [], days: {} });
    expect(csv).toContain("hormonal contraception: yes; combined pill, 28-day pack");
  });
});

describe("the one reminder", () => {
  const plan = (s: CycleSettings, today: string, now: Date) => {
    const v = view(s, today);
    return planCycleReminders({ settings: s, status: v.status, prediction: v.prediction, now, pill: v.pill });
  };

  it("one check-in, the morning after the pack's window — asking about a bleed", () => {
    const out = plan(onPill("combined_pill"), "2026-10-05", new Date(2026, 9, 5, 8));
    expect(out.map((r) => r.kind)).toEqual(["checkin"]);
    const latest = addDays(LAST, 28 + PILL_HALF_WIDTH);
    expect(out[0].at.getTime()).toBe(new Date(Number(latest.slice(0, 4)), Number(latest.slice(5, 7)) - 1, Number(latest.slice(8, 10)) + 1, 9).getTime());
    expect(out[0].title).toBe("Has your bleed started?");
  });

  it("discreet (the default): names nothing", () => {
    const out = plan(onPill("combined_pill", 28, true), "2026-10-05", new Date(2026, 9, 5, 8));
    expect(`${out[0].title} ${out[0].body}`).not.toMatch(/period|bleed|pill/i);
  });

  it("none once it's missed, none during a bleed, none on another method", () => {
    expect(plan(onPill("combined_pill"), addDays(LAST, 31), new Date(2026, 9, 25, 8))).toEqual([]);
    expect(plan(onPill("other"), "2026-10-05", new Date(2026, 9, 5, 8))).toEqual([]);
    const bleeding = [...EPS, { ...period("2026-10-21"), end: null }];
    const v = view(onPill("combined_pill"), "2026-10-22", bleeding);
    expect(
      planCycleReminders({ settings: onPill("combined_pill"), status: v.status, prediction: v.prediction, now: new Date(2026, 9, 22, 8), pill: v.pill }).some(
        (r) => r.kind === "checkin",
      ),
    ).toBe(false);
  });

  it("the lean reminder path computes the same forecast the view shows", () => {
    const s = onPill("combined_pill");
    const today = "2026-10-05";
    const mode = cycleModeOf(ADULT.conditions, s.contraception?.answer);
    const lean = pillForecast({ episodes: EPS, settings: s, mode, today });
    expect(lean).toEqual(view(s, today).pill);
    const input = { episodes: EPS, days: {}, settings: s, today, profile: ADULT };
    const now = new Date(2026, 9, 5, 8);
    expect(planCycleReminders({ settings: s, status: todayStatus(input, predict(input)), prediction: null, now, pill: lean })).toEqual(
      plan(s, today, now),
    );
  });
});

describe("storing the answer", () => {
  it("'which one?' only follows a yes; a pack only follows the combined pill", () => {
    const yes = answerContraception(null, "hormonal", "2026-10-01");
    expect(answerMethod(yes, "combined_pill")).toMatchObject({ method: "combined_pill", packDays: 28 });
    expect(answerMethod(yes, "combined_pill", 91)).toMatchObject({ packDays: 91 });
    expect(answerMethod(yes, "other")).not.toHaveProperty("packDays");
    const no = answerContraception(null, "none", "2026-10-01");
    expect(answerMethod(no, "combined_pill")).toBe(no);
    const pill = answerMethod(yes, "combined_pill")!;
    expect(answerMethod(pill, "combined_pill")).toBe(pill);
  });

  it("the normalizer keeps only a valid shape", () => {
    const base = { answer: "hormonal", since: "2026-10-01", restartFrom: null };
    expect(normalizeSettings({ contraception: { ...base, method: "combined_pill", packDays: 91 } }).contraception).toMatchObject({
      method: "combined_pill",
      packDays: 91,
    });
    expect(normalizeSettings({ contraception: { ...base, method: "combined_pill", packDays: 30 } }).contraception).not.toHaveProperty("packDays");
    expect(normalizeSettings({ contraception: { ...base, method: "patch" } }).contraception).not.toHaveProperty("method");
    expect(normalizeSettings({ contraception: { ...base, answer: "none", method: "combined_pill" } }).contraception).not.toHaveProperty("method");
  });

  it("stopping the pill is the same fresh start as before, and the method goes with the yes", () => {
    const pill = answerMethod(answerContraception(null, "hormonal", "2026-06-01"), "combined_pill")!;
    const stopped = answerContraception(pill, "none", "2026-10-05", "2026-10-04");
    expect(stopped).toEqual({ answer: "none", since: "2026-10-05", restartFrom: "2026-10-04" });
    expect(view(settings({ contraception: stopped }), "2026-10-06").pill).toBeNull();
  });
});
