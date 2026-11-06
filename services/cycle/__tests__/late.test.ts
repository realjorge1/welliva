/**
 * "WHY AM I LATE?" — answered from this cycle, against her own last three.
 *
 * What a test can hold, and what would quietly rot without one:
 *   · every signal has a gate AND a minimum of data on both sides; just under
 *     either one, nothing is said;
 *   · a missing value is not zero: an unlogged day never reads as "ate less";
 *   · it never claims a cause, and the next steps use the app's own thresholds;
 *   · no "late" at all in the logging-only and paused modes.
 */
import { describe, expect, it } from "vitest";

import { buildCycleBrief, cycleStateLines } from "../brief";
import { addDays } from "../dates";
import { MISSED_AFTER_DAYS } from "../flags";
import {
  BASELINE_CYCLES,
  EATING_DROP,
  lateContext,
  LATE_REASSURE_DAYS,
  LOW_MOOD_VALENCE,
  MAX_CHANGES,
  MIN_INTAKE_DAYS,
  MIN_NIGHTS,
  PREGNANCY_TEST_LINE,
  SLEEP_DROP_MIN,
  WEIGHT_CHANGE_KG,
  type LateSignals,
} from "../late";
import { CYCLE_LIBRARY } from "../library";
import { computeView } from "../view";
import { history, settings } from "./helpers";

const TODAY = "2026-10-15";
/** Starts ... 19 Jun, 17 Jul, 14 Aug, 11 Sep. Due 9 Oct ± 2, so 4 days late on the 15th, on cycle day 35. */
const PERIODS = history("2026-04-24", [28, 28, 28, 28, 28]);
const CUR_START = "2026-09-11";
/** The earlier cycles the comparison should read. */
const BEFORE = ["2026-06-19", "2026-07-17", "2026-08-14"];

const s = settings({ usualCycleDays: 28 });

function read(signals: Partial<LateSignals>, opts: { today?: string; conditions?: string[]; set?: typeof s } = {}) {
  const today = opts.today ?? TODAY;
  const v = computeView(
    { settings: opts.set ?? s, periods: PERIODS, days: {} },
    { today, profile: { age: 30, conditions: opts.conditions ?? [] } },
  );
  return lateContext({
    mode: v.mode,
    status: v.status,
    cycles: v.cycles,
    today,
    signals: { mind: [], workouts: [], intake: [], weighIns: [], events: [], ...signals },
  });
}

/** `n` consecutive dates from `from`. */
const run = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));
/** `n` days in each earlier cycle, from its first day. */
const inEachBefore = (n: number) => BEFORE.flatMap((b) => run(b, n));

const nights = (dates: string[], sleepHours: number) =>
  dates.map((date) => ({ date, valence: null, sleepHours }));
const moods = (dates: string[], valence: number) => dates.map((date) => ({ date, valence, sleepHours: null }));
const eaten = (dates: string[], kcal: number) => dates.map((date) => ({ date, kcal }));
const trained = (dates: string[], minutes = 30) => dates.map((date) => ({ date, minutes }));

const ids = (c: ReturnType<typeof read>) => c?.changes.map((x) => x.id);

describe("when it speaks at all", () => {
  it("reads her last three cycles while she is late", () => {
    const c = read({})!;
    expect(c).not.toBeNull();
    expect(c.baseline).toBe(BASELINE_CYCLES);
  });

  it("is silent when she isn't late", () => {
    expect(read({}, { today: "2026-10-05" })).toBeNull();
  });

  it("has no 'late' on hormonal contraception, in pregnancy or with menopause", () => {
    const onMethod = settings({
      usualCycleDays: 28,
      contraception: { answer: "hormonal", since: "2026-01-01", restartFrom: null },
    });
    expect(read({}, { set: onMethod })).toBeNull();
    expect(read({}, { conditions: ["pregnancy"] })).toBeNull();
    expect(read({}, { conditions: ["menopause"] })).toBeNull();
  });
});

describe("nothing stands out", () => {
  it("says so plainly, which is an answer and a reassuring one", () => {
    const c = read({})!;
    expect(c.changes).toEqual([]);
    expect(c.summary).toBe("Nothing stands out in what you logged this cycle. Most late periods arrive within a week.");
  });

  it(`says 'within a week' only inside that week (${LATE_REASSURE_DAYS} days)`, () => {
    // Window closed 11 Oct; the 19th is 8 days past it.
    const c = read({}, { today: "2026-10-19" })!;
    expect(c.summary).toBe("Nothing stands out in what you logged this cycle.");
  });
});

describe("sleep", () => {
  const before = nights(inEachBefore(5), 7);

  it("names a real drop, in hours and minutes", () => {
    const c = read({ mind: [...before, ...nights(run(CUR_START, 6), 7 - 50 / 60)] })!;
    expect(c.changes[0]).toMatchObject({
      id: "sleep",
      text: "You slept about 50 minutes less a night than usual (6 h 10 vs 7 h).",
    });
    expect(c.summary).toBe("Changes like these can delay a period. Most late periods arrive within a week.");
  });

  it(`says nothing under ${SLEEP_DROP_MIN} minutes`, () => {
    expect(ids(read({ mind: [...before, ...nights(run(CUR_START, 6), 7 - 40 / 60)] }))).toEqual([]);
  });

  it(`needs ${MIN_NIGHTS} nights on BOTH sides, and a night with no check-in isn't a short night`, () => {
    const short = 5;
    expect(ids(read({ mind: [...before, ...nights(run(CUR_START, MIN_NIGHTS - 1), short)] }))).toEqual([]);
    expect(ids(read({ mind: [...nights(run(BEFORE[0], MIN_NIGHTS - 1), 7), ...nights(run(CUR_START, 8), short)] }))).toEqual([]);
  });
});

describe("training", () => {
  // Three cycles of 28 days at 2 sessions a week, in the same stretch.
  const before = trained(BEFORE.flatMap((b) => [0, 3, 7, 10, 14, 17, 21, 24].map((d) => addDays(b, d))));
  /** 35 days now: 25 sessions is 5 a week. */
  const often = trained(run(CUR_START, 25));

  it("names sessions a week when they rise by half", () => {
    const c = read({ workouts: [...before, ...often] })!;
    expect(c.changes[0]).toMatchObject({ id: "training", text: "You trained more than usual: 5 sessions a week vs 2." });
  });

  it("needs a real rise, not just a big percentage of very little", () => {
    // 1 a week → 1.6 a week is +60%, but under one extra session.
    const rare = trained(BEFORE.flatMap((b) => [0, 7, 14, 21].map((d) => addDays(b, d))));
    expect(ids(read({ workouts: [...rare, ...trained(run(CUR_START, 8))] }))).toEqual([]);
  });

  it("falls back to minutes when the sessions just got longer", () => {
    const longer = trained(BEFORE.flatMap((b) => [0, 3, 7, 10, 14, 17, 21, 24].map((d) => addDays(b, d))), 30);
    // Same 2 a week now (10 in 35 days), at an hour each: 60 → 120 minutes a week.
    const c = read({ workouts: [...longer, ...trained([0, 3, 7, 10, 14, 17, 21, 24, 28, 31].map((d) => addDays(CUR_START, d)), 60)] })!;
    expect(c.changes[0].text).toBe("You trained longer than usual: about 120 minutes a week vs 60.");
  });

  it("calls it new when nothing was logged before", () => {
    const c = read({ workouts: trained(run(CUR_START, 15)) })!;
    expect(c.changes[0].text).toBe("You trained 3 times a week this cycle, with none logged in your cycles before.");
  });
});

describe("eating", () => {
  const before = eaten(inEachBefore(3), 2000);

  it(`names a drop of ${EATING_DROP * 100}% gently, in rounded numbers`, () => {
    const c = read({ intake: [...before, ...eaten(run(CUR_START, MIN_INTAKE_DAYS), 1500)] })!;
    expect(c.changes[0]).toMatchObject({
      id: "eating",
      text: "You ate quite a bit less than usual: about 1,500 kcal a day vs 2,000.",
    });
  });

  it("says nothing for a smaller drop", () => {
    expect(ids(read({ intake: [...before, ...eaten(run(CUR_START, 10), 1700)] }))).toEqual([]);
  });

  it(`needs ${MIN_INTAKE_DAYS} recorded days — a day with nothing logged is unknown, not zero`, () => {
    expect(ids(read({ intake: [...before, ...eaten(run(CUR_START, MIN_INTAKE_DAYS - 1), 1000)] }))).toEqual([]);
    // Zeros that slipped through are ignored rather than dragging the average down.
    expect(ids(read({ intake: [...before, ...eaten(run(CUR_START, 3), 1900), ...eaten(run(addDays(CUR_START, 3), 10), 0)] }))).toEqual([]);
  });
});

describe("weight", () => {
  const start = { date: addDays(CUR_START, -3), kg: 64.1 };

  it(`names a change of ${WEIGHT_CHANGE_KG} kg over the cycle, from the nearest weigh-in at its start`, () => {
    const c = read({ weighIns: [start, { date: addDays(CUR_START, 20), kg: 61.7 }] })!;
    expect(c.changes[0]).toMatchObject({
      id: "weight",
      text: "Your weight came down 2.4 kg this cycle (64.1 to 61.7 kg).",
    });
    expect(read({ weighIns: [start, { date: addDays(CUR_START, 20), kg: 66.5 }] })!.changes[0].text).toContain("went up 2.4 kg");
  });

  it("says nothing under the line, or from a single weigh-in", () => {
    expect(ids(read({ weighIns: [start, { date: addDays(CUR_START, 20), kg: 62.3 }] }))).toEqual([]);
    expect(ids(read({ weighIns: [start] }))).toEqual([]);
  });

  it("doesn't reach further back than a fortnight for its starting weight", () => {
    const old = { date: addDays(CUR_START, -30), kg: 70 };
    expect(ids(read({ weighIns: [old, { date: addDays(CUR_START, 20), kg: 62 }] }))).toEqual([]);
  });
});

describe("mood", () => {
  const before = [
    ...moods(run(BEFORE[0], 2), LOW_MOOD_VALENCE - 0.3),
    ...moods(run(BEFORE[1], 10), 0.5),
  ];

  it("names a doubled share of low days, with the counts on both sides", () => {
    const now = [...moods(run(CUR_START, 6), -0.6), ...moods(run(addDays(CUR_START, 6), 6), 0.5)];
    const c = read({ mind: [...before, ...now] })!;
    expect(c.changes[0]).toMatchObject({
      id: "mood",
      text: "More of your check-ins were low than usual: 6 of 12 days, against 2 of 12 before.",
    });
  });

  it("says nothing without enough low days, or below double", () => {
    expect(ids(read({ mind: [...before, ...moods(run(CUR_START, 2), -0.6), ...moods(run(addDays(CUR_START, 2), 10), 0.5)] }))).toEqual([]);
    const usualLow = [...moods(run(BEFORE[0], 4), -0.6), ...moods(run(BEFORE[1], 8), 0.5)];
    expect(ids(read({ mind: [...usualLow, ...moods(run(CUR_START, 4), -0.6), ...moods(run(addDays(CUR_START, 4), 8), 0.5)] }))).toEqual([]);
  });

  it("doesn't treat Neutral as low", () => {
    expect(ids(read({ mind: [...before, ...moods(run(CUR_START, 12), 0)] }))).toEqual([]);
  });
});

describe("trips and illness", () => {
  it("names a trip by her own title, counting only days inside this cycle", () => {
    const c = read({
      events: [{ kind: "travel", start: "2026-09-08", end: "2026-09-16", title: "Lagos trip" }],
    })!;
    // 11–16 Sep: the days before the cycle began don't count.
    expect(c.changes[0].text).toBe("You were travelling for 6 days (Lagos trip).");
  });

  it("ignores a trip that ended before this cycle began", () => {
    expect(ids(read({ events: [{ kind: "travel", start: "2026-08-20", end: "2026-08-25" }] }))).toEqual([]);
  });

  it("counts a day once, however many records cover it", () => {
    const c = read({
      events: [
        { kind: "ill", start: "2026-09-20", end: "2026-09-22", title: "Flu" },
        { kind: "ill", start: "2026-09-22", end: "2026-09-22" },
      ],
    })!;
    expect(c.changes[0].text).toBe("You were unwell for 3 days this cycle.");
  });
});

describe("how it is said", () => {
  const busy = () =>
    read({
      events: [
        { kind: "ill", start: "2026-09-20", end: "2026-09-21" },
        { kind: "travel", start: "2026-09-25", end: "2026-09-28", title: "Lagos trip" },
      ],
      weighIns: [
        { date: addDays(CUR_START, -3), kg: 64 },
        { date: addDays(CUR_START, 20), kg: 61 },
      ],
      mind: nights([...inEachBefore(5)], 7).concat(nights(run(CUR_START, 8), 5)),
    })!;

  it(`names at most ${MAX_CHANGES}, in a fixed order`, () => {
    expect(ids(busy())).toEqual(["illness", "travel", "weight"]);
  });

  it("never claims a cause or a diagnosis", () => {
    const c = busy();
    const said = [...c.changes.flatMap((x) => [x.text, x.coach]), c.summary, ...c.nextSteps].join(" ");
    expect(said).not.toMatch(/because|caused|this is why|the reason|you have|diagnos/i);
    expect(c.summary).toContain("can delay");
  });
});

describe("the next steps use the app's own lines", () => {
  it("quotes the doctor note's day count and the late-period page's test advice", () => {
    const c = read({})!;
    expect(c.nextSteps).toEqual([PREGNANCY_TEST_LINE, `If you go ${MISSED_AFTER_DAYS} days without a period, that's worth mentioning to a doctor.`]);
    const page = CYCLE_LIBRARY["late-period"].sections.flatMap((x) => x.body ?? []).join(" ");
    expect(page).toContain("A test from the day your period was due is reliable");
    expect(page).toContain("a week later, test again");
    expect(PREGNANCY_TEST_LINE).toContain("reliable from the day your period was due");
    expect(PREGNANCY_TEST_LINE).toContain("a week later, test again");
    expect(page).toContain(`${MISSED_AFTER_DAYS} days`);
  });

  it("says what it does, and that it compares against the same number of cycles", () => {
    const page = CYCLE_LIBRARY["late-period"].sections.flatMap((x) => x.body ?? []).join(" ");
    expect(BASELINE_CYCLES).toBe(3);
    expect(page).toContain("compares this cycle with your last three");
    expect(page).toContain("not a diagnosis");
  });

  it("adapts after a birth: keeps the test line, drops the 90-day rule that doesn't apply", () => {
    const c = read({}, { conditions: ["postpartum"], set: settings({ usualCycleDays: 28, postpartumSince: "2026-01-01" }) })!;
    expect(c.context).toContain("After a birth");
    expect(c.nextSteps[0]).toBe(PREGNANCY_TEST_LINE);
    expect(c.nextSteps.join(" ")).not.toContain(`${MISSED_AFTER_DAYS} days`);
    expect(c.nextSteps[1]).toContain("three months after you stop breastfeeding");
    const after = CYCLE_LIBRARY["after-a-birth"].seeSomeone?.join(" ");
    expect(after).toContain("three months after stopping breastfeeding");
  });
});

describe("the coach hears the same reading", () => {
  const brief = (signals: Partial<LateSignals>) => {
    const v = computeView({ settings: s, periods: PERIODS, days: {} }, { today: TODAY, profile: { age: 30, conditions: [] } });
    return cycleStateLines(
      buildCycleBrief({ status: v.status, prediction: v.prediction, showFertileWindow: false, late: read(signals) }),
    );
  };

  it("as changes that can delay a period, never a cause", () => {
    const lines = brief({ events: [{ kind: "travel", start: "2026-09-25", end: "2026-09-28", title: "Lagos trip" }] });
    expect(lines).toContain(
      "- what's been different this cycle, from her logs (changes that can delay a period, never a cause or a diagnosis): travelling for 4 days (Lagos trip)",
    );
  });

  it("and says when nothing stands out", () => {
    expect(brief({})).toContain("- nothing stands out in what she logged this cycle");
  });
});
