import { describe, expect, it } from "vitest";
import { addDays, daysBetween } from "../dates";
import {
  baselineSpread,
  buildCycles,
  cycleModeOf,
  mad,
  median,
  predict,
  todayStatus,
  typicalPeriodLength,
  type PredictInput,
} from "../predict";
import { day, days, history, NOW, nextId, period, settings } from "./helpers";

function input(patch: Partial<PredictInput>): PredictInput {
  return {
    episodes: [],
    days: {},
    settings: settings(),
    today: "2026-10-15",
    profile: { age: 30, conditions: [] },
    ...patch,
  };
}

describe("small stats", () => {
  it("median and MAD resist one odd month", () => {
    expect(median([28, 29, 27, 45])).toBe(28.5);
    expect(mad([28, 28, 29, 28, 40])).toBe(0);
  });
});

describe("predict", () => {
  it("returns nothing before any period is logged", () => {
    expect(predict(input({}))).toBeNull();
  });

  it("starts from what she told us, with an honest range", () => {
    const p = predict(
      input({ episodes: [period("2026-10-01")], settings: settings({ usualCycleDays: 28 }) }),
    )!;
    expect(p.likely).toBe("2026-10-29");
    expect(p.basedOn).toBe(0);
    expect(p.confidence).toBe("told");
    // sqrt(2.5² + 2²) = 3.2 days, × 1.28 → ±4.
    expect(p.halfWidth).toBe(4);
    expect(p.earliest).toBe("2026-10-25");
    expect(p.latest).toBe("2026-11-02");
  });

  it("is widest when she wasn't sure, and narrows as she logs", () => {
    const unsure = predict(input({ episodes: [period("2026-10-01")] }))!;
    expect(unsure.confidence).toBe("learning");
    expect(unsure.halfWidth).toBe(6);

    const six = predict(
      input({
        episodes: history("2026-04-08", [28, 28, 28, 28, 28, 28]),
        settings: settings({ usualCycleDays: 28 }),
        today: "2026-10-01",
      }),
    )!;
    expect(six.basedOn).toBe(6);
    expect(six.cycleLength).toBe(28);
    expect(six.halfWidth).toBe(2);
    expect(six.confidence).toBe("confident");
  });

  it("lets her logs overrule a self-report that was off", () => {
    const p = predict(
      input({
        episodes: history("2026-03-01", [33, 33, 33, 33, 33, 33]),
        settings: settings({ usualCycleDays: 28 }),
        today: "2026-09-20",
      }),
    )!;
    expect(p.cycleLength).toBe(33);
    expect(p.recentLengths).toEqual([33, 33, 33, 33, 33, 33]);
  });

  it("is not dragged by one odd month the way an average is", () => {
    // The mean of these is 30.3; the median is 28.
    const p = predict(
      input({ episodes: history("2026-03-01", [28, 28, 28, 41, 28, 29]), today: "2026-10-01" }),
    )!;
    expect(p.cycleLength).toBe(28);
  });

  it("widens the window for an irregular rhythm, and for PCOS before the logs speak", () => {
    const irregular = predict(
      input({ episodes: history("2026-02-01", [26, 34, 29, 38, 27, 31]), today: "2026-09-20" }),
    )!;
    expect(irregular.confidence).toBe("variable");
    expect(irregular.halfWidth).toBeGreaterThanOrEqual(5);

    expect(baselineSpread({ conditions: ["pcos"] })).toBe(5);
    expect(baselineSpread({ age: 17 })).toBe(4);
    expect(baselineSpread({ age: 30 })).toBe(2.5);
  });

  it("keeps a probable missed log out of the average, and counts it once she confirms", () => {
    const episodes = history("2026-03-01", [28, 28, 56, 28]);
    const cycles = buildCycles(episodes, settings(), "2026-10-15");
    expect(cycles.map((c) => c.status)).toEqual(["counted", "counted", "gap", "counted"]);
    expect(predict(input({ episodes }))!.recentLengths).toEqual([28, 28, 28]);

    const gapStart = cycles[2].start;
    const confirmed = buildCycles(episodes, settings({ gapNotes: { [gapStart]: "long" } }), "2026-10-15");
    expect(confirmed[2].status).toBe("counted");
    expect(confirmed[2].confirmedLong).toBe(true);
    const paused = buildCycles(episodes, settings({ gapNotes: { [gapStart]: "pause" } }), "2026-10-15");
    expect(paused[2].status).toBe("pause");
  });

  it("ignores a 'cycle' too short to be one", () => {
    const episodes = [period("2026-08-01"), period("2026-08-10", 2), period("2026-08-29")];
    const cycles = buildCycles(episodes, settings(), "2026-10-15");
    expect(cycles.map((c) => c.status)).toEqual(["short", "counted"]);
  });

  it("learns her period length from the periods she ended, not from guesses", () => {
    const episodes = [
      period("2026-07-01", 4),
      period("2026-07-29", 4),
      period("2026-08-26", 4),
      { ...period("2026-09-23", 9), endEstimated: true },
    ];
    expect(typicalPeriodLength(episodes, { usualPeriodDays: 6 })).toEqual({ days: 5, basis: 3 });
  });

  it("uses her own luteal phase once two cycles have a positive ovulation test", () => {
    const episodes = history("2026-06-01", [30, 30, 30]);
    const lh1 = addDays("2026-06-01", 15); // cycle day 16
    const lh2 = addDays("2026-07-01", 17); // cycle day 18
    const p = predict(
      input({
        episodes,
        days: days(day(lh1, { ovulationTest: "positive" }), day(lh2, { ovulationTest: "positive" })),
        today: "2026-09-05",
      }),
    )!;
    expect(p.lutealPersonal).toBe(true);
    // Cycle 1: LH day 16, ovulation day 17, next start day 31 → 14 days. Cycle 2: 12.
    expect(p.lutealDays).toBe(13);
    expect(daysBetween(p.ovulation, p.likely)).toBe(13);
    expect(daysBetween(p.fertileStart, p.ovulation)).toBe(5);
    expect(daysBetween(p.ovulation, p.fertileEnd)).toBe(1);
  });

  it("restarts from the first period after the birth when postpartum", () => {
    const episodes = history("2025-12-01", [28, 28]);
    const s = settings({ postpartumSince: "2026-08-01" });
    expect(
      predict(input({ episodes, settings: s, profile: { conditions: ["postpartum"] } })),
    ).toBeNull();
  });
});

describe("todayStatus", () => {
  const base = history("2026-04-01", [28, 28, 28, 28, 28]); // last start 2026-08-19
  const s = settings({ usualCycleDays: 28 });

  it("knows she's on day 2 of an ongoing period", () => {
    const episodes = [...base, { id: nextId(), start: "2026-10-14", end: null, updatedAt: NOW }];
    const i = input({ episodes, settings: s });
    const st = todayStatus(i, predict(i));
    expect(st).toMatchObject({ inPeriod: true, periodDay: 2, cycleDay: 2, phase: "period", periodOpen: true });
    expect(st.expectedEnd).toBe("2026-10-18");
  });

  it("reports how late a period is once the window has passed", () => {
    const episodes = history("2026-04-01", [28, 28, 28, 28, 28, 28]); // last start 2026-09-16
    const i = input({ episodes, settings: s, today: "2026-10-20" });
    const p = predict(i)!;
    const st = todayStatus(i, p);
    expect(p.latest < "2026-10-20").toBe(true);
    expect(st.phase).toBe("late");
    expect(st.lateBy).toBe(daysBetween(p.latest, "2026-10-20"));
    expect(st.ringDays).toBe(st.cycleDay);
  });

  it("names the phase in the middle of a cycle", () => {
    const episodes = history("2026-04-01", [28, 28, 28, 28, 28, 28]); // last start 2026-09-16
    const i = input({ episodes, settings: s, today: "2026-09-30" }); // cycle day 15
    const p = predict(i)!;
    const st = todayStatus(i, p);
    expect(st.cycleDay).toBe(15);
    expect(["fertile", "follicular", "luteal"]).toContain(st.phase);
    expect(st.toLikely).toBe(daysBetween("2026-09-30", p.likely));
  });

  it("pauses entirely in pregnancy", () => {
    const i = input({ episodes: base, profile: { conditions: ["pregnancy"] } });
    expect(cycleModeOf(["pregnancy", "menopause"])).toBe("pregnancy");
    const st = todayStatus(i, null);
    expect(st).toMatchObject({ mode: "pregnancy", predicting: false, cycleDay: null });
  });

  it("logs but never predicts with menopause on the profile", () => {
    const episodes = [{ id: nextId(), start: "2026-10-14", end: null, updatedAt: NOW }];
    const i = input({ episodes, profile: { conditions: ["menopause"] } });
    const st = todayStatus(i, predict(i));
    expect(st.predicting).toBe(false);
    expect(st.inPeriod).toBe(true);
  });
});
