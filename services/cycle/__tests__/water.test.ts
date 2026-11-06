/**
 * "THAT'S WATER, NOT FAT" — the pattern, the moment, and the days the calorie
 * model and the coach's trend should trust less.
 *
 * What a test can hold, and what would quietly rot without one:
 *   · the patterns standard: completed cycles, two at least, the denominator is
 *     the cycles with enough weigh-ins, the scope said exactly;
 *   · a slow gain is not a monthly rise, and is never called water;
 *   · the moment needs the pattern, a recent reading, the right days and a real
 *     rise; before the pattern it says one general thing, once;
 *   · silent in the logging-only and paused modes;
 *   · it describes the scale and never suggests eating less;
 *   · the reading page quotes the numbers the code acts on.
 */
import { describe, expect, it } from "vitest";

import { computeWeightTrend } from "../../BodyLogService";
import { buildCycleBrief, cycleStateLines } from "../brief";
import { addDays } from "../dates";
import { CYCLE_LIBRARY } from "../library";
import {
  WEIGHT_BASE_FIRST_DAY,
  WEIGHT_BASE_LAST_DAY,
  WEIGHT_JUMP_KG,
  WEIGHT_MIN_CYCLES,
  WEIGHT_MIN_READINGS,
  WEIGHT_MIN_SHARE,
  WEIGHT_PRE_DAYS,
  WEIGHT_PRE_THROUGH_DAY,
  weightBaseSpan,
  weightPattern,
  weightPreSpan,
  type WeighInPoint,
} from "../patterns";
import { buildCycles } from "../predict";
import { normalizeSettings, type CycleSettings, type PeriodEpisode } from "../types";
import { computeView } from "../view";
import { noisyWeightDates, WATER_FIRST_NOTE, WATER_RECENT_DAYS } from "../water";
import { history, period, settings } from "./helpers";

/** Starts 1 May, 29 May, 26 Jun, 24 Jul, 21 Aug: four completed cycles. Next due 18 Sep, window 16–20 Sep. */
const STARTS = ["2026-05-01", "2026-05-29", "2026-06-26", "2026-07-24", "2026-08-21"];
const PERIODS = history(STARTS[0], [28, 28, 28, 28]);
const S = settings({ usualCycleDays: 28 });

const at = (date: string, kg: number): WeighInPoint => ({ date, kg });

/** Enough readings to show one cycle's rise, settling on day 4 of the next period. */
function risingCycle(start: string, next: string, usual = 60, peak = 61.2): WeighInPoint[] {
  return [
    at(addDays(start, 6), usual),
    at(addDays(start, 9), usual),
    at(addDays(next, -3), peak),
    at(addDays(next, -1), peak - 0.2),
    at(addDays(next, 3), usual + 0.1),
  ];
}
function flatCycle(start: string, next: string, usual = 60): WeighInPoint[] {
  return [
    at(addDays(start, 6), usual),
    at(addDays(start, 9), usual),
    at(addDays(next, -3), usual + 0.1),
    at(addDays(next, -1), usual),
  ];
}
const cyclesOf = (periods: PeriodEpisode[] = PERIODS) => buildCycles(periods, S, "2026-09-05");

/** Three cycles that rise and one that doesn't, plus this cycle's baseline. */
const HISTORY = [
  ...flatCycle(STARTS[0], STARTS[1]),
  ...risingCycle(STARTS[1], STARTS[2]),
  ...risingCycle(STARTS[2], STARTS[3]),
  ...risingCycle(STARTS[3], STARTS[4]),
  at("2026-08-27", 60),
  at("2026-08-30", 60),
];

function viewOf(
  weighIns: WeighInPoint[],
  today: string,
  opts: { set?: CycleSettings; conditions?: string[]; periods?: PeriodEpisode[] } = {},
) {
  return computeView(
    { settings: opts.set ?? S, periods: opts.periods ?? PERIODS, days: {} },
    { today, profile: { age: 30, conditions: opts.conditions ?? [] }, weighIns },
  );
}

describe("the windows", () => {
  it("reads days 6 to 12 as her baseline, stopping well before the next period in a short cycle", () => {
    expect(weightBaseSpan("2026-05-01", "2026-05-29")).toEqual({ from: "2026-05-06", to: "2026-05-12" });
    // An 18-day cycle: 8 days before the next start is day 11.
    expect(weightBaseSpan("2026-05-01", "2026-05-19")).toEqual({ from: "2026-05-06", to: "2026-05-11" });
    expect(WEIGHT_BASE_FIRST_DAY).toBe(6);
    expect(WEIGHT_BASE_LAST_DAY).toBe(12);
  });

  it("reads the 5 days before the next start, through day 2 of it", () => {
    expect(weightPreSpan("2026-05-29")).toEqual({ from: "2026-05-24", to: "2026-05-30" });
    expect(WEIGHT_PRE_DAYS).toBe(5);
    expect(WEIGHT_PRE_THROUGH_DAY).toBe(2);
  });
});

describe("the pattern", () => {
  it("states the rise, when it settles, and the scope", () => {
    const p = weightPattern(cyclesOf(), HISTORY)!;
    expect(p.kind).toBe("weight");
    expect(p.hits).toBe(3);
    expect(p.observed).toBe(4);
    expect(p.settledByDay).toBe(4);
    expect(p.body).toBe(
      "Your weight rises about 1.1 kg before your period and settles by day 4, in 3 of your last 4 cycles with enough weigh-ins.",
    );
  });

  it(`needs ${WEIGHT_MIN_CYCLES} cycles: one month is an anecdote`, () => {
    expect(weightPattern(cyclesOf(), risingCycle(STARTS[1], STARTS[2]))).toBeNull();
  });

  it(`needs ${WEIGHT_MIN_READINGS} weigh-ins on each side, and the cycles without them aren't in the denominator`, () => {
    const thin = (s: string, n: string) => [at(addDays(s, 6), 60), at(addDays(n, -2), 61.2)];
    expect(weightPattern(cyclesOf(), [...thin(STARTS[0], STARTS[1]), ...thin(STARTS[1], STARTS[2])])).toBeNull();
    const p = weightPattern(cyclesOf(), [
      ...thin(STARTS[0], STARTS[1]),
      ...risingCycle(STARTS[1], STARTS[2]),
      ...risingCycle(STARTS[2], STARTS[3]),
    ])!;
    expect(p.observed).toBe(2);
    expect(p.scope).toBe("2 of your last 2 cycles with enough weigh-ins");
  });

  it(`needs a rise of ${WEIGHT_JUMP_KG} kg`, () => {
    const small = (s: string, n: string) => [...flatCycle(s, n).slice(0, 2), at(addDays(n, -3), 60.4), at(addDays(n, -1), 60.4)];
    expect(weightPattern(cyclesOf(), [...small(STARTS[0], STARTS[1]), ...small(STARTS[1], STARTS[2])])).toBeNull();
  });

  it(`must show in at least ${WEIGHT_MIN_SHARE * 100}% of the cycles that could have shown it`, () => {
    const one = [
      ...risingCycle(STARTS[0], STARTS[1]),
      ...flatCycle(STARTS[1], STARTS[2]),
      ...risingCycle(STARTS[2], STARTS[3]),
      ...flatCycle(STARTS[3], STARTS[4]),
    ];
    expect(weightPattern(cyclesOf(), one)?.hits).toBe(2);
    const five = history("2026-01-01", [28, 28, 28, 28, 28, 28]);
    const starts = five.map((e) => e.start);
    const rare = [
      ...risingCycle(starts[0], starts[1]),
      ...flatCycle(starts[1], starts[2]),
      ...flatCycle(starts[2], starts[3]),
      ...risingCycle(starts[3], starts[4]),
      ...flatCycle(starts[4], starts[5]),
      ...flatCycle(starts[5], starts[6]),
    ];
    expect(weightPattern(buildCycles(five, S, "2026-07-20"), rare)).toBeNull();
  });

  it("only says when it settles if that's known for two cycles", () => {
    const noSettle = (s: string, n: string) => risingCycle(s, n).slice(0, 4);
    const p = weightPattern(cyclesOf(), [...noSettle(STARTS[1], STARTS[2]), ...noSettle(STARTS[2], STARTS[3])])!;
    expect(p.settledByDay).toBeNull();
    expect(p.body).toBe("Your weight rises about 1.1 kg before your period, in 2 of your last 2 cycles with enough weigh-ins.");
  });

  it("reads completed cycles only: this one proves nothing yet", () => {
    const now = [at("2026-08-27", 60), at("2026-08-30", 60), at("2026-09-14", 62), at("2026-09-15", 62)];
    expect(weightPattern(cyclesOf(), [...risingCycle(STARTS[3], STARTS[4]), ...now])).toBeNull();
  });
});

describe("a slow trend is not a monthly rise", () => {
  /** A reading every other day across every cycle, on a straight line, with an optional bump. */
  function line(perDay: number, bump = 0): WeighInPoint[] {
    const out: WeighInPoint[] = [];
    const nextStarts = new Set(STARTS.slice(1));
    for (let d = STARTS[0], i = 0; d <= "2026-09-10"; d = addDays(d, 2), i += 2) {
      const inRise = [...nextStarts].some((n) => {
        const { from, to } = weightPreSpan(n);
        return d >= from && d <= to;
      });
      out.push(at(d, 60 + perDay * i + (inRise ? bump : 0)));
    }
    return out;
  }

  it("never calls a steady gain water", () => {
    // 0.2 kg a week: half a kilo higher before every period, from the trend alone.
    expect(weightPattern(cyclesOf(), line(0.2 / 7 + 0.01))).toBeNull();
    expect(weightPattern(cyclesOf(), line(0.1))).toBeNull();
  });

  it("still finds a real rise on top of a gain, or hidden in a loss", () => {
    expect(weightPattern(cyclesOf(), line(0.03, 1))?.riseKg).toBeCloseTo(1, 0);
    // Losing about 0.5 kg a week: the plain comparison would see nothing.
    expect(weightPattern(cyclesOf(), line(-0.07, 1))?.riseKg).toBeCloseTo(1, 0);
  });
});

describe("the moment", () => {
  it("says it from her own history, on a reading in the days before", () => {
    const v = viewOf([...HISTORY, at("2026-09-14", 61.1)], "2026-09-14");
    expect(v.water).toMatchObject({ kind: "pattern", date: "2026-09-14", upKg: 1.1 });
    expect(v.water?.text).toBe(
      "Up 1.1 kg from earlier in your cycle. The same happened before 3 of your last 4 periods with enough weigh-ins and was gone by day 4. It's most likely water, not fat.",
    );
  });

  it("says it on the first days of a period, against the cycle just ended", () => {
    const periods = [...PERIODS, { ...period("2026-09-17"), end: null }];
    const later = { periods };
    const on = (date: string, kg: number) => viewOf([...HISTORY, at(date, kg)], date, later).water;
    expect(on("2026-09-20", 61)?.kind).toBe("pattern"); // day 4
    expect(on("2026-09-21", 61)).toBeNull(); // day 5
  });

  it("stays quiet mid-cycle, under half a kilo, or on an old reading", () => {
    expect(viewOf([...HISTORY, at("2026-09-05", 61.5)], "2026-09-05").water).toBeNull();
    expect(viewOf([...HISTORY, at("2026-09-14", 60.4)], "2026-09-14").water).toBeNull();
    const reading = [...HISTORY, at("2026-09-14", 61.1)];
    expect(viewOf(reading, addDays("2026-09-14", WATER_RECENT_DAYS)).water?.kind).toBe("pattern");
    expect(viewOf(reading, addDays("2026-09-14", WATER_RECENT_DAYS + 1)).water).toBeNull();
  });

  it("says nothing about a day it has no earlier weight for", () => {
    expect(viewOf([at("2026-09-14", 61)], "2026-09-14").water).toBeNull();
  });
});

describe("before the pattern exists", () => {
  const before = [at("2026-08-27", 60), at("2026-09-14", 61)];

  it("says the general thing, and no number as if it were about her", () => {
    const v = viewOf(before, "2026-09-14");
    expect(v.weightPattern).toBeNull();
    expect(v.water?.kind).toBe("first");
    expect(v.water?.text).toBe(WATER_FIRST_NOTE);
    expect(WATER_FIRST_NOTE).toBe(
      "Many people hold extra water before a period. After a couple of cycles of weigh-ins, I'll know if that's true for you.",
    );
  });

  it("says it once: it stays for that day and never comes back", () => {
    const seen = (waterNoteOn: string) => settings({ usualCycleDays: 28, waterNoteOn });
    expect(viewOf(before, "2026-09-14", { set: seen("2026-09-14") }).water?.kind).toBe("first");
    expect(viewOf(before, "2026-09-15", { set: seen("2026-09-14") }).water).toBeNull();
  });

  it("needs a reading that actually went up", () => {
    expect(viewOf([at("2026-08-27", 60), at("2026-09-14", 60.2)], "2026-09-14").water).toBeNull();
  });

  it("can use the last reading before the rise when none fell in the baseline days", () => {
    expect(viewOf([at("2026-09-05", 60), at("2026-09-14", 61)], "2026-09-14").water?.kind).toBe("first");
    // But not one from weeks ago.
    expect(viewOf([at("2026-08-15", 60), at("2026-09-14", 61)], "2026-09-14").water).toBeNull();
  });

  it("survives a round trip through storage", () => {
    expect(normalizeSettings({ waterNoteOn: "2026-09-14" }).waterNoteOn).toBe("2026-09-14");
    expect(normalizeSettings({ waterNoteOn: "soon" }).waterNoteOn).toBeNull();
    expect(normalizeSettings({}).waterNoteOn).toBeNull();
  });
});

describe("the modes", () => {
  const reading = [...HISTORY, at("2026-09-14", 61.1)];

  it("is silent on hormonal contraception, in pregnancy and with menopause", () => {
    const onMethod = settings({
      usualCycleDays: 28,
      contraception: { answer: "hormonal", since: "2026-01-01", restartFrom: null },
    });
    for (const v of [
      viewOf(reading, "2026-09-14", { set: onMethod }),
      viewOf(reading, "2026-09-14", { conditions: ["pregnancy"] }),
      viewOf(reading, "2026-09-14", { conditions: ["menopause"] }),
    ]) {
      expect(v.weightPattern).toBeNull();
      expect(v.water).toBeNull();
      expect(v.noisyWeightDates).toEqual([]);
    }
  });

  it("reads only the cycles since a fresh start", () => {
    const stopped = settings({
      usualCycleDays: 28,
      contraception: { answer: "none", since: "2026-07-20", restartFrom: "2026-07-20" },
    });
    expect(viewOf(reading, "2026-09-14", { set: stopped }).weightPattern).toBeNull();
  });
});

describe("the days the scale is trusted less", () => {
  it("are nobody's unless her own weigh-ins confirm the rise", () => {
    expect(viewOf([at("2026-08-27", 60), at("2026-09-14", 61)], "2026-09-14").noisyWeightDates).toEqual([]);
  });

  it("cover the 5 days before each period and its first two, and the run-up to the next", () => {
    const dates = viewOf(HISTORY, "2026-09-14").noisyWeightDates;
    for (const start of STARTS.slice(1)) {
      expect(dates).toContain(addDays(start, -5));
      expect(dates).toContain(addDays(start, 1));
      expect(dates).not.toContain(addDays(start, -6));
      expect(dates).not.toContain(addDays(start, 2));
    }
    // Window opens 16 Sep, so the rise could begin the 11th; today is the 14th.
    expect(dates).toContain("2026-09-11");
    expect(dates).toContain("2026-09-14");
    expect(dates).not.toContain("2026-09-10");
  });

  it("never reach past today", () => {
    const v = viewOf(HISTORY, "2026-09-14");
    expect(noisyWeightDates({ pattern: v.weightPattern, cycles: v.cycles, status: v.status, prediction: v.prediction, today: "2026-09-14" }).every((d) => d <= "2026-09-14")).toBe(true);
  });

  it("are why the coach's trend doesn't read a rise as a stall", () => {
    // A steady 0.5 kg a week loss with a 1 kg rise in its last week, today in the rise.
    const today = "2026-09-14";
    const logs = Array.from({ length: 28 }, (_, i) => {
      const date = addDays(today, -27 + i);
      const inRise = i >= 21;
      return { date, weightKg: 70 - (0.5 / 7) * i + (inRise ? 1 : 0) };
    }) as never[];
    const plain = computeWeightTrend(logs, today);
    const noisy = new Set(Array.from({ length: 7 }, (_, i) => addDays(today, -i)));
    const fair = computeWeightTrend(logs.filter((l: { date: string }) => !noisy.has(l.date)), today);
    expect(plain.perWeek!).toBeGreaterThan(-0.3);
    expect(fair.perWeek!).toBeCloseTo(-0.5, 1);
  });
});

describe("how it is said", () => {
  it("describes the scale and never suggests eating less", () => {
    const said = [
      viewOf([...HISTORY, at("2026-09-14", 61.1)], "2026-09-14").water?.text,
      WATER_FIRST_NOTE,
      weightPattern(cyclesOf(), HISTORY)?.body,
    ].join(" ");
    expect(said).not.toMatch(/eat less|cut back|cut down|burn|earn|cheat|make up for|compensate|damage|diet/i);
  });

  it("tells the coach the pattern, as her numbers, and today's reading of it", () => {
    const v = viewOf([...HISTORY, at("2026-09-14", 61.1)], "2026-09-14");
    const lines = cycleStateLines(
      buildCycleBrief({
        status: v.status,
        prediction: v.prediction,
        showFertileWindow: false,
        weightPattern: v.weightPattern,
        water: v.water,
      }),
    );
    expect(lines).toContain(
      "- her weight rises about 1.1 kg before her period and settles by day 4 (3 of her last 4 cycles with enough weigh-ins); her latest reading is up 1.1 kg from earlier in her cycle, most likely water, not fat",
    );
  });

  it("says nothing to the coach before the pattern exists", () => {
    const v = viewOf([at("2026-08-27", 60), at("2026-09-14", 61)], "2026-09-14");
    const lines = cycleStateLines(
      buildCycleBrief({ status: v.status, prediction: v.prediction, showFertileWindow: false, weightPattern: v.weightPattern, water: v.water }),
    );
    expect(lines.join(" ")).not.toContain("weight");
  });
});

describe("the reading page says what the code does", () => {
  const article = CYCLE_LIBRARY["scale-before-period"];
  const text = article.sections.flatMap((s) => [...(s.body ?? []), ...(s.points ?? [])]).join(" ");

  it("quotes the same numbers the pattern uses", () => {
    expect(WEIGHT_JUMP_KG).toBe(0.5);
    expect(text).toContain("half a kilo");
    expect(WEIGHT_MIN_CYCLES).toBe(2);
    expect(text).toContain("at least two cycles");
    expect(WEIGHT_MIN_SHARE).toBe(0.5);
    expect(text).toContain("at least half of the cycles");
    expect(text).toContain(`days ${WEIGHT_BASE_FIRST_DAY} to ${WEIGHT_BASE_LAST_DAY}`);
    expect(text).toContain(`${WEIGHT_PRE_DAYS} days before your next period`);
    expect(text).toContain("first two days");
    expect(WEIGHT_MIN_READINGS).toBe(2);
    expect(text).toContain("Two readings in each stretch");
  });

  it("doesn't tell her to do anything about it", () => {
    expect(text).toContain("You don't need to do anything about a rise that leaves by itself");
    expect(article.seeSomeone?.length).toBeGreaterThan(0);
  });
});
