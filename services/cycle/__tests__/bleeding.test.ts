/**
 * A FLOW OUTSIDE A PERIOD (2026-11-20, Fix 1).
 *
 * Before: any light, medium or heavy flow outside a period opened a new one.
 * Now ./bleeding classifies it — continues / starts / between / ask — and only
 * "continues" and "starts" touch her periods. Every case here goes through the
 * day sheet's real write path (./dayWrite applyDayPatch).
 */
import { describe, expect, it } from "vitest";

import { merge } from "../../sync/mergeStrategies";
import { ASK_RUN_DAYS, BLEED_COPY, bleedPrompt, classifyFlowDay, flowRunStart, START_SLACK_DAYS } from "../bleeding";
import { addDays } from "../dates";
import { answerBleed, applyDayPatch, type DayPatch } from "../dayWrite";
import { liveEpisodes, MIN_COUNTED_CYCLE } from "../episodes";
import { cycleModeOf, predict, type CycleProfile } from "../predict";
import { CYCLE_KEYS } from "../store";
import { isEmptyDayLog, normalizeDayLog, type CycleData, type CycleSettings, type Flow } from "../types";
import { history, settings } from "./helpers";

const BASE = history("2026-05-01", [28, 28, 28, 28, 28]); // last start 2026-09-18
const LAST = "2026-09-18";
const cd = (n: number) => addDays(LAST, n - 1);
const S = settings({ usualCycleDays: 28, usualPeriodDays: 5 });
const ADULT: CycleProfile = { age: 30, conditions: [] };
const stamp = (date: string, minute = 0) => `${date}T09:${String(minute).padStart(2, "0")}:00.000Z`;

function data(patch: Partial<CycleData> = {}): CycleData {
  return { settings: S, periods: BASE, days: {}, ...patch };
}
function log(d: CycleData, date: string, patch: DayPatch, today = date, profile = ADULT): CycleData {
  return applyDayPatch(d, date, patch, { today, now: stamp(today), profile });
}
const starts = (d: CycleData) => liveEpisodes(d.periods).map((e) => e.start);
function prompt(d: CycleData, date: string, today = date, profile = ADULT) {
  const mode = cycleModeOf(profile.conditions, d.settings.contraception?.answer);
  const prediction = predict({ episodes: d.periods, days: d.days, settings: d.settings, today, profile });
  return bleedPrompt({
    date,
    days: d.days,
    episodes: d.periods,
    prediction,
    mode,
    today,
    typicalBleed: 5,
    covered: liveEpisodes(d.periods).some((e) => e.start <= date && (e.end ?? today) >= date),
  });
}

describe("the brief's matrix: steady 28-day cycles", () => {
  it.each<Flow>(["light", "medium", "heavy"])("day 14, %s: bleeding between periods, no new period", (flow) => {
    const after = log(data(), cd(14), { flow });
    expect(starts(after)).toEqual(starts(data()));
    expect(after.days[cd(14)].flow).toBe(flow);
    expect(prompt(after, cd(14))?.kind).toBe("too-soon");
  });

  it(`fewer than ${MIN_COUNTED_CYCLE} days after her period began can never be the next one`, () => {
    expect(starts(log(data(), cd(MIN_COUNTED_CYCLE), { flow: "heavy" }))).toEqual(starts(data()));
  });

  it("day 16, clearly early: asks, and changes nothing until she answers", () => {
    const after = log(data(), cd(16), { flow: "light" });
    expect(starts(after)).toEqual(starts(data()));
    expect(prompt(after, cd(16))).toEqual({ kind: "ask", runStart: cd(16), startDay: cd(16) });
    const p0 = predict({ episodes: BASE, days: {}, settings: S, today: cd(16), profile: ADULT })!;
    const p1 = predict({ episodes: after.periods, days: after.days, settings: S, today: cd(16), profile: ADULT })!;
    expect(p1).toEqual(p0);
  });

  it(`near the window (from ${START_SLACK_DAYS} days before its earliest day): a period starts`, () => {
    const p = predict({ episodes: BASE, days: {}, settings: S, today: cd(26), profile: ADULT })!;
    const edge = addDays(p.earliest, -START_SLACK_DAYS);
    expect(starts(log(data(), edge, { flow: "light" }))).toContain(edge);
    const before = addDays(edge, -1);
    expect(starts(log(data(), before, { flow: "light" }))).not.toContain(before);
  });

  it("day 26, inside the window: a period starts", () => {
    expect(starts(log(data(), cd(26), { flow: "medium" }))).toContain(cd(26));
  });

  it("day 29 and day 34 (late): a period starts", () => {
    expect(starts(log(data(), cd(29), { flow: "light" }))).toContain(cd(29));
    expect(starts(log(data(), cd(34), { flow: "light" }))).toContain(cd(34));
  });

  it.each([cd(10), cd(16), cd(26), cd(34)])("spotting (%s): never a period", (date) => {
    const after = log(data(), date, { flow: "spotting" });
    expect(starts(after)).toEqual(starts(data()));
    expect(prompt(after, date)).toBeNull();
  });

  it(`two days in a row, unanswered: asks on both, and not after ${ASK_RUN_DAYS} days`, () => {
    let d = log(data(), cd(16), { flow: "light" }, cd(16));
    d = log(d, cd(17), { flow: "light" }, cd(17));
    expect(starts(d)).toEqual(starts(data()));
    expect(prompt(d, cd(17), cd(17))?.kind).toBe("ask");
    d = log(d, cd(18), { flow: "light" }, cd(18));
    expect(prompt(d, cd(18), cd(18))).toBeNull();
    expect(starts(d)).toEqual(starts(data()));
  });

  it("a run that began with spotting asks from its first light day", () => {
    let d = log(data(), cd(16), { flow: "spotting" }, cd(16));
    d = log(d, cd(17), { flow: "light" }, cd(17));
    expect(flowRunStart(d.days, cd(17))).toBe(cd(16));
    expect(prompt(d, cd(17), cd(17))).toEqual({ kind: "ask", runStart: cd(16), startDay: cd(17) });
  });

  it("a flow a day or two after her period ended still continues that period", () => {
    const d = data({ periods: [...BASE.slice(0, -1), { ...BASE[BASE.length - 1], end: cd(4) }] });
    const after = log(d, cd(6), { flow: "light" }, cd(8));
    expect(liveEpisodes(after.periods).find((e) => e.start === LAST)?.end).toBe(cd(6));
  });

  it("adding a symptom to a 'between' flow day never starts a period", () => {
    const d = log(data(), cd(16), { flow: "light" });
    expect(starts(log(d, cd(16), { symptoms: ["cramps"] }))).toEqual(starts(data()));
  });
});

describe("her answer", () => {
  const asked = log(data(), cd(16), { flow: "light" }, cd(16));

  it("'Yes, my period started' starts it from the run's first day", () => {
    let d = log(asked, cd(17), { flow: "medium" }, cd(17));
    d = answerBleed(d, cd(17), "period", { today: cd(17), now: stamp(cd(17)), profile: ADULT });
    expect(starts(d)).toContain(cd(16));
    const p = predict({ episodes: d.periods, days: d.days, settings: S, today: cd(17), profile: ADULT })!;
    expect(p.lastStart).toBe(cd(16));
  });

  it("'No, bleeding between periods' is kept on the run's first day; the run is never asked about again", () => {
    let d = answerBleed(asked, cd(16), "between", { today: cd(16), now: stamp(cd(16), 1), profile: ADULT });
    expect(d.days[cd(16)].bleedAnswer).toBe("between");
    expect(starts(d)).toEqual(starts(data()));
    expect(prompt(d, cd(16))?.kind).toBe("answered");
    d = log(d, cd(17), { flow: "heavy" }, cd(17));
    expect(prompt(d, cd(17), cd(17))?.kind).toBe("answered");
    expect(starts(d)).toEqual(starts(data()));
  });

  it("'It was my period' after a No starts it and takes the No back", () => {
    let d = answerBleed(asked, cd(16), "between", { today: cd(16), now: stamp(cd(16), 1), profile: ADULT });
    d = answerBleed(d, cd(16), "period", { today: cd(16), now: stamp(cd(16), 2), profile: ADULT });
    expect(starts(d)).toContain(cd(16));
    expect(d.days[cd(16)].bleedAnswer).toBeUndefined();
  });

  it("clearing the flow takes the answer with it", () => {
    const d = answerBleed(asked, cd(16), "between", { today: cd(16), now: stamp(cd(16), 1), profile: ADULT });
    expect(log(d, cd(16), { flow: null }, cd(16)).days[cd(16)].bleedAnswer).toBeUndefined();
  });

  it("survives a sync merge with another phone, either way round", () => {
    const answered = answerBleed(asked, cd(16), "between", { today: cd(16), now: stamp(cd(16), 5), profile: ADULT });
    // The other phone logged a different day afterwards, and still has the unanswered flow.
    const other = log(asked, cd(17), { mood: "okay" }, cd(17));
    for (const merged of [
      merge(CYCLE_KEYS.days, JSON.stringify(answered.days), JSON.stringify(other.days))!,
      merge(CYCLE_KEYS.days, JSON.stringify(other.days), JSON.stringify(answered.days))!,
    ]) {
      const days = JSON.parse(merged);
      expect(days[cd(16)].bleedAnswer).toBe("between");
      expect(days[cd(17)].mood).toBe("okay");
    }
  });

  it("is stored only beside a flow, and a day holding it is never 'empty'", () => {
    expect(normalizeDayLog(cd(16), { flow: "light", bleedAnswer: "between", updatedAt: "x" })?.bleedAnswer).toBe("between");
    expect(normalizeDayLog(cd(16), { bleedAnswer: "between", updatedAt: "x" })?.bleedAnswer).toBeUndefined();
    expect(normalizeDayLog(cd(16), { flow: "light", bleedAnswer: "yes", updatedAt: "x" })?.bleedAnswer).toBeUndefined();
    expect(isEmptyDayLog({ date: cd(16), bleedAnswer: "between", updatedAt: "x" })).toBe(false);
  });

  it("the words", () => {
    expect(BLEED_COPY.question).toBe("Is this the start of your period?");
    expect(BLEED_COPY.yes).toBe("Yes, my period started");
    expect(BLEED_COPY.no).toBe("No, bleeding between periods");
  });
});

describe("filling in history, and a first log", () => {
  it("a flow between two logged periods, far from both: a period", () => {
    const eps = history("2026-05-01", [56, 28]); // a missed log: 05-01, 06-26, 07-24
    const d = data({ periods: eps });
    expect(starts(log(d, "2026-05-29", { flow: "medium" }, "2026-08-01"))).toContain("2026-05-29");
  });

  it("a flow less than 15 days before a logged period: bleeding between periods", () => {
    const d = data({ periods: history("2026-05-01", [56, 28]) });
    expect(starts(log(d, "2026-06-15", { flow: "medium" }, "2026-08-01"))).not.toContain("2026-06-15");
  });

  it("her first log ever: a period", () => {
    expect(starts(log(data({ periods: [] }), "2026-10-01", { flow: "light" }))).toEqual(["2026-10-01"]);
  });
});

describe("every mode", () => {
  const hormonal: CycleSettings = settings({ contraception: { answer: "hormonal", since: "2026-01-01", restartFrom: null } });

  it("pregnancy and menopause keep the old rule: a period flow is a period day", () => {
    for (const conditions of [["pregnancy"], ["menopause"]]) {
      const profile = { age: 40, conditions };
      expect(starts(log(data(), cd(14), { flow: "light" }, cd(14), profile))).toContain(cd(14));
    }
  });

  it("hormonal: nothing forecast, so 15+ days after the last bleed starts one, sooner is between", () => {
    const d = data({ settings: hormonal });
    expect(starts(log(d, cd(14), { flow: "light" }))).not.toContain(cd(14));
    expect(starts(log(d, cd(16), { flow: "light" }))).toContain(cd(16));
    expect(prompt(log(d, cd(16), { flow: "light" }), cd(16))).toBeNull();
  });

  it("postpartum, before the first period after the birth: a flow starts it", () => {
    const s = settings({ usualCycleDays: 28, postpartumSince: "2026-10-01" });
    const d = data({ settings: s });
    const profile = { age: 30, conditions: ["postpartum"] };
    expect(starts(log(d, "2026-10-20", { flow: "light" }, "2026-10-20", profile))).toContain("2026-10-20");
  });

  it("postpartum, once predicting: the same as normal", () => {
    const s = settings({ usualCycleDays: 28, postpartumSince: "2026-01-01" });
    const profile = { age: 30, conditions: ["postpartum"] };
    const d = log(data({ settings: s }), cd(16), { flow: "light" }, cd(16), profile);
    expect(starts(d)).toEqual(starts(data()));
    expect(prompt(d, cd(16), cd(16), profile)?.kind).toBe("ask");
  });
});

describe("classifyFlowDay", () => {
  it("is the one rule: the write path and the prompt agree", () => {
    const p = predict({ episodes: BASE, days: {}, settings: S, today: cd(20), profile: ADULT });
    const base = { episodes: BASE, days: {}, prediction: p, mode: "normal" as const, today: cd(20), typicalBleed: 5 };
    expect(classifyFlowDay({ ...base, date: cd(14), flow: "light" })).toBe("between");
    expect(classifyFlowDay({ ...base, date: cd(20), flow: "light" })).toBe("ask");
    expect(classifyFlowDay({ ...base, date: cd(20), flow: "spotting" })).toBe("between");
    expect(classifyFlowDay({ ...base, date: cd(7), flow: "light" })).toBe("continues");
  });
});
