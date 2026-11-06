/**
 * THE CONTRACEPTION QUESTION — "Do you use hormonal contraception?"
 *
 * A "yes" turns the tracker into a log: bleeding follows the method, so nothing
 * is predicted and nothing is read off the gaps between bleeds. What a test can
 * hold, and what would quietly rot without one:
 *
 *   · the mode ordering — pregnancy and menopause outrank the answer, and the
 *     answer outranks postpartum;
 *   · NO PREDICTION, AND THEREFORE NO FERTILE WINDOW, in logging-only mode —
 *     not computed, not drawn, not labelled, not told to the coach, even with
 *     the fertile-window setting left on;
 *   · stopping a method is a fresh start, counted from the bleed she is having
 *     that day if any, and a "yes" corrected the same day restarts nothing;
 *   · every surface says "bleed", never "period", for bleeding on a method;
 *   · the reading page and the Medical Disclaimer promise exactly what the code
 *     does.
 */
import { describe, expect, it } from "vitest";

import { getLegalDoc } from "../../../constants/legal";
import { buildCycleBrief, cycleStateLines } from "../brief";
import {
  answerContraception,
  CORRECTION_DAYS,
  contraceptionForDoctor,
  contraceptionNote,
  HORMONAL_LINE,
} from "../contraception";
import { bleedWords, cycleHeadline } from "../copy";
import { addDays } from "../dates";
import { cycleCsv, doctorSummary } from "../exportData";
import { CYCLE_LIBRARY, suggestedReading } from "../library";
import {
  countFrom,
  cycleModeOf,
  fertileWindowAllowed,
  predict,
  todayStatus,
  type PredictInput,
} from "../predict";
import { planCycleReminders } from "../reminderPlan";
import { normalizeSettings, type Contraception, type CycleData, type CycleSettings } from "../types";
import { computeView } from "../view";
import { dialModel, paintDays } from "../visual";
import { history, NOW, period, settings } from "./helpers";

const TODAY = "2026-10-15";

const method = (answer: Contraception["answer"], since = "2026-09-01", restartFrom: string | null = null) => ({
  contraception: { answer, since, restartFrom },
});

function input(patch: Partial<PredictInput>): PredictInput {
  return {
    episodes: [],
    days: {},
    settings: settings(),
    today: TODAY,
    profile: { age: 30, conditions: [] },
    ...patch,
  };
}

function data(s: CycleSettings, periods = history("2026-04-08", [28, 28, 28, 28, 28, 28])): CycleData {
  return { settings: s, periods, days: {} };
}

const view = (d: CycleData, conditions: string[] = []) =>
  computeView(d, { today: TODAY, profile: { age: 30, conditions } });

describe("the mode", () => {
  it("is logging-only on a yes, and as before on a no or 'prefer not to say'", () => {
    expect(cycleModeOf([], "hormonal")).toBe("hormonal");
    expect(cycleModeOf([], "none")).toBe("normal");
    expect(cycleModeOf([], "unsaid")).toBe("normal");
    expect(cycleModeOf([], null)).toBe("normal");
  });

  it("lets pregnancy and menopause outrank the answer, and the answer outrank postpartum", () => {
    expect(cycleModeOf(["pregnancy"], "hormonal")).toBe("pregnancy");
    expect(cycleModeOf(["menopause"], "hormonal")).toBe("menopause");
    expect(cycleModeOf(["postpartum"], "hormonal")).toBe("hormonal");
    expect(cycleModeOf(["postpartum"], "none")).toBe("postpartum");
  });
});

describe("logging only", () => {
  const hormonal = settings({ ...method("hormonal"), usualCycleDays: 28, showFertileWindow: true });

  it("predicts nothing, however much history there is", () => {
    const i = input({ episodes: history("2026-04-08", [28, 28, 28, 28, 28, 28]), settings: hormonal });
    expect(predict(i)).toBeNull();
    const s = todayStatus(i, null);
    expect(s.mode).toBe("hormonal");
    expect(s.predicting).toBe(false);
    expect(s.phase).toBeNull();
    expect(s.toLikely).toBeNull();
  });

  it("never calls a long stretch without bleeding late", () => {
    // 80 days since the last bleed: on an implant or a hormonal coil, ordinary.
    const i = input({ episodes: [period("2026-07-27")], settings: hormonal });
    const s = todayStatus(i, predict(i));
    expect(s.lateBy).toBe(0);
    expect(s.phase).toBeNull();
  });

  it("makes the fertile window impossible to show, with the setting left on", () => {
    expect(fertileWindowAllowed(true, "hormonal")).toBe(false);
    expect(fertileWindowAllowed(true, "menopause")).toBe(false);
    expect(fertileWindowAllowed(true, "normal")).toBe(true);
    expect(fertileWindowAllowed(false, "normal")).toBe(false);

    const d = data(hormonal);
    const v = view(d);
    expect(v.prediction).toBeNull();
    expect(v.showFertile).toBe(false);
    // Even a caller that passes the raw setting can't draw one: nothing was computed.
    const model = dialModel({ episodes: d.periods, view: v, today: TODAY, showFertile: true });
    expect(model.arcs.some((a) => a.kind === "fertile" || a.kind === "predicted")).toBe(false);
    expect(model.ovulation).toBeNull();
    const paint = paintDays({ episodes: d.periods, days: {}, view: v, today: TODAY, showFertile: true });
    for (let i = 0; i < 90; i += 1) {
      const date = addDays(TODAY, i);
      expect(paint(date).fertile).toBe(false);
      expect(paint(date).period).not.toBe("predicted");
    }
  });

  it("reads no patterns and asks about no gaps — the gaps follow the method", () => {
    const withGap = history("2026-03-01", [28, 70, 28]);
    expect(view(data(settings(), withGap)).gaps.length).toBe(1);
    expect(view(data(hormonal, withGap)).gaps).toEqual([]);
    expect(view(data(hormonal)).timing).toEqual([]);
    expect(view(data(hormonal)).headsUps).toEqual([]);
  });

  it("keeps the long-bleed note and drops every cycle-length note", () => {
    const short = history("2026-05-01", [18, 18, 18, 18]);
    expect(view(data(settings(), short)).allNotes.map((n) => n.id)).toContain("short_cycles");
    const onMethod = view(data(hormonal, [...short, period("2026-07-20", 9)])).allNotes;
    expect(onMethod.map((n) => n.id)).toEqual(["long_bleeding"]);
    expect(onMethod[0].title).toBe("A long bleed");
    expect(onMethod[0].body).toContain("more than 7 days");
    expect(onMethod[0].body).not.toMatch(/\bperiod\b/);
    // 80 days without bleeding is no "missed period" on a method.
    expect(view(data(hormonal, [period("2026-07-27")])).allNotes.map((n) => n.id)).not.toContain("missed");
  });

  it("lays no reminders: there is no likely day to remind about", () => {
    const i = input({ episodes: [{ ...period("2026-10-14"), end: null }], settings: hormonal });
    const plan = planCycleReminders({
      settings: hormonal,
      status: todayStatus(i, predict(i)),
      prediction: predict(i),
      now: new Date(2026, 9, 15, 8),
    });
    expect(plan).toEqual([]);
  });

  it("says 'bleed', never 'period', and says why nothing is predicted", () => {
    expect(bleedWords("hormonal")).toMatchObject({ label: "Bleeding", noun: "bleed", started: "Bleeding started" });
    expect(bleedWords("normal")).toMatchObject({ label: "Period", noun: "period", started: "Period started" });

    const quiet = cycleHeadline(view(data(hormonal)), false);
    expect(quiet.title).toBe("Logging only");
    expect(quiet.detail).toBe(HORMONAL_LINE);

    const bleeding = view(data(hormonal, [{ ...period("2026-10-14"), end: null }]));
    const h = cycleHeadline(bleeding, false);
    expect(h).toMatchObject({ eyebrow: "Bleeding logged", title: "Day 2" });
    expect(`${h.eyebrow} ${h.title} ${h.detail}`).not.toMatch(/\bperiod\b/i);
  });

  it("tells the coach the method, and nothing that sounds like a prediction", () => {
    const v = view(data(hormonal, [{ ...period("2026-10-14"), end: null }]));
    const lines = cycleStateLines(
      buildCycleBrief({ status: v.status, prediction: v.prediction, todayLog: undefined, showFertileWindow: v.showFertile }),
    );
    const facts = lines.filter((l) => l.startsWith("- "));
    expect(facts).toContain("- bleeding, day 2");
    expect(facts.some((f) => f.includes("hormonal contraception"))).toBe(true);
    for (const f of facts) expect(f).not.toMatch(/period|fertile|likely/);
  });
});

describe("answering, and changing the answer", () => {
  it("records the day of a first answer, with nothing to restart", () => {
    expect(answerContraception(null, "hormonal", TODAY)).toEqual({
      answer: "hormonal",
      since: TODAY,
      restartFrom: null,
    });
  });

  it("writes nothing when the same answer is given again", () => {
    const prev = answerContraception(null, "none", "2026-09-01");
    expect(answerContraception(prev, "none", TODAY)).toBe(prev);
  });

  it("restarts her history from the day she stops a method", () => {
    const on = answerContraception(null, "hormonal", "2026-06-01");
    expect(answerContraception(on, "none", TODAY).restartFrom).toBe(TODAY);
    expect(answerContraception(on, "unsaid", TODAY).restartFrom).toBe(TODAY);
  });

  it("restarts from the bleed she is having, which is day one of the first cycle after", () => {
    const on = answerContraception(null, "hormonal", "2026-06-01");
    expect(answerContraception(on, "none", TODAY, "2026-10-13").restartFrom).toBe("2026-10-13");
  });

  it(`treats a 'yes' taken back within ${CORRECTION_DAYS} days as a slip of the thumb`, () => {
    const slip = answerContraception(null, "hormonal", TODAY);
    expect(answerContraception(slip, "none", TODAY).restartFrom).toBeNull();
    expect(answerContraception(slip, "none", addDays(TODAY, CORRECTION_DAYS - 1)).restartFrom).toBeNull();
    const later = addDays(TODAY, CORRECTION_DAYS);
    expect(answerContraception(slip, "none", later).restartFrom).toBe(later);
  });

  it("keeps an earlier fresh start when she starts a method again", () => {
    const stopped: Contraception = { answer: "none", since: "2026-08-01", restartFrom: "2026-08-01" };
    expect(answerContraception(stopped, "hormonal", TODAY).restartFrom).toBe("2026-08-01");
  });

  it("explains the answer under the question, only when there is something to add", () => {
    expect(contraceptionNote(null)).toBeNull();
    expect(contraceptionNote({ answer: "none", since: TODAY, restartFrom: null })).toBeNull();
    expect(contraceptionNote({ answer: "hormonal", since: TODAY, restartFrom: null })).toBe(HORMONAL_LINE);
    expect(contraceptionNote({ answer: "none", since: TODAY, restartFrom: "2026-10-13" })).toContain("13 Oct");
  });
});

describe("after stopping", () => {
  // Natural cycles, then bleeds on the pill, then stopped on 20 Jul.
  const episodes = [
    ...history("2026-01-05", [30, 30, 30]),
    period("2026-05-03", 4),
    period("2026-05-31", 4),
    period("2026-06-28", 4),
    period("2026-08-25"),
    period("2026-09-27"),
  ];
  const stopped = settings({ ...method("none", "2026-07-20", "2026-07-20"), usualCycleDays: 28 });

  it("counts only the cycles since the fresh start", () => {
    expect(countFrom(stopped, "normal")).toBe("2026-07-20");
    const p = predict(input({ episodes, settings: stopped }))!;
    expect(p.basedOn).toBe(1);
    expect(p.recentLengths).toEqual([33]);
    expect(todayStatus(input({ episodes, settings: stopped }), p).cycleDay).toBe(19);
  });

  it("takes the later of a birth and a stop", () => {
    const both = settings({ ...method("none", "2026-07-20", "2026-07-20"), postpartumSince: "2026-03-01" });
    expect(countFrom(both, "postpartum")).toBe("2026-07-20");
    expect(countFrom(both, "normal")).toBe("2026-07-20");
    expect(countFrom(settings({ postpartumSince: "2026-03-01" }), "postpartum")).toBe("2026-03-01");
  });
});

describe("what leaves the phone, and where it is kept", () => {
  it("puts the method and the day it was noted on the doctor summary", () => {
    const hormonal = settings(method("hormonal", "2026-09-01"));
    const d = data(hormonal);
    const v = view(d);
    const text = doctorSummary({ data: d, cycles: v.cycles, prediction: v.prediction, notes: v.allNotes, today: TODAY });
    expect(text).toContain("Hormonal contraception: yes (noted in welliva on 1 Sep 2026)");
    expect(text).toContain("Days between bleeds");
    expect(text).not.toContain("Next period estimated");

    expect(contraceptionForDoctor({ answer: "none", since: TODAY, restartFrom: null })).toBe("Hormonal contraception: no.");
    expect(contraceptionForDoctor({ answer: "none", since: TODAY, restartFrom: TODAY })).toContain(
      "Cycle figures count from 15 Oct 2026",
    );
    expect(contraceptionForDoctor({ answer: "unsaid", since: TODAY, restartFrom: null })).toBeNull();
    expect(contraceptionForDoctor(null)).toBeNull();
  });

  it("exports the answer with everything else", () => {
    const csv = cycleCsv(data(settings(method("hormonal", "2026-09-01"))));
    expect(csv.split("\n")[0]).toBe("type,date,end,flow,symptoms,mood,energy,ovulation_test,detail");
    expect(csv).toContain("contraception,2026-09-01,,,,,,,hormonal contraception: yes");
  });

  it("survives a round trip through storage, and drops what it can't trust", () => {
    const kept = normalizeSettings({ ...settings(method("none", "2026-09-01", "2026-09-03")), updatedAt: NOW });
    expect(kept.contraception).toEqual({ answer: "none", since: "2026-09-01", restartFrom: "2026-09-03" });
    expect(normalizeSettings({ contraception: { answer: "maybe", since: "2026-09-01" } }).contraception).toBeNull();
    expect(normalizeSettings({ contraception: { answer: "hormonal" } }).contraception).toBeNull();
    expect(
      normalizeSettings({ contraception: { answer: "hormonal", since: "2026-09-01", restartFrom: "soon" } }).contraception,
    ).toEqual({ answer: "hormonal", since: "2026-09-01", restartFrom: null });
    expect(normalizeSettings({}).contraception).toBeNull();
  });
});

describe("the words match the behaviour", () => {
  const page = CYCLE_LIBRARY.contraception.sections
    .flatMap((s) => [s.heading, ...(s.body ?? []), ...(s.points ?? [])])
    .join(" ");

  it("the reading page says what a 'yes' does, with the threshold the notes use", () => {
    expect(page).toContain("logs your bleeding and stops predicting it");
    expect(page).toContain("no fertile window");
    // ./flags raises a long bleed past 7 days, on any method.
    expect(page).toContain("more than seven days");
    expect(page).toContain("Nothing in welliva is, or replaces, contraception");
  });

  it("offers that page in logging-only mode, and never the fertile-window page", () => {
    const v = view(data(settings({ ...method("hormonal"), showFertileWindow: true })));
    const ids = suggestedReading(v, settings({ showFertileWindow: true })).map((a) => a.id);
    expect(ids).toContain("contraception");
    expect(ids).not.toContain("ovulation");
  });

  it("the Medical Disclaimer promises logging without predictions, and no substitute for a method", () => {
    const disclaimer = getLegalDoc("disclaimer")!;
    const text = disclaimer.sections.flatMap((s) => s.body ?? []).join(" ");
    expect(text).toContain("If you tell welliva you use hormonal contraception, it logs your bleeding and does not predict it");
    expect(text).toContain("Nothing in welliva replaces using your contraception as directed.");
  });
});
