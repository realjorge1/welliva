/**
 * THE PLATFORM-HEALTH ADAPTER — the parts that can be wrong without a device.
 *
 * None of this can be exercised in a simulator: HealthKit needs a paired watch
 * and Health Connect needs a phone with a writer app installed. So the mapping
 * was deliberately split out of the native shims (../signals/wearable/normalize.ts
 * and the two `snapshotFrom…` functions), and this file is where the actual
 * risk lives.
 *
 * Four things it exists to catch, in order of how badly each one hurts:
 *
 *  1. OVERLAPPING SLEEP SAMPLES SUMMED. HealthKit returns `InBed`, `Asleep` and
 *     the per-stage samples for the SAME night, layered on top of each other.
 *     Adding the durations reports about 22 hours of sleep, the recovery fold
 *     reads it as fully rested, and the coach tells a wrecked person to train
 *     hard. This is the single most consequential bug the adapter can have.
 *
 *  2. A ZERO-FILLED SNAPSHOT FROM NO DATA. HealthKit cannot report whether READ
 *     access was granted, so a refusal and an empty store look identical. If
 *     "no samples" became `{ steps: 0, sleepHours: 0 }`, a user who declined
 *     would be told they took no steps and never slept — asserting as fact
 *     something the OS specifically refused to tell us.
 *
 *  3. UNITS. HealthKit's HRV is SDNN in SECONDS; Health Connect's is RMSSD in
 *     MILLISECONDS. One feed needs rescuing and the other must be left alone.
 *
 *  4. A BASELINE BUILT FROM NOISE. `recoveryAdjustment` fires "HRV well below
 *     your baseline" off a comparison; three readings is not a baseline, and
 *     returning one anyway makes the coach confident about nothing.
 */
import { describe, expect, it } from "vitest";

import {
  lastNightWindow,
  latest,
  median,
  mergeIntervals,
  plausible,
  rollingBaseline,
  sleepHoursFromSamples,
  totalHours,
} from "../signals/wearable/normalize";
import { snapshotFromHealthKit } from "../signals/wearable/providers/appleHealth";
import {
  sleepIntervalsFromSessions,
  snapshotFromHealthConnect,
} from "../signals/wearable/providers/healthConnect";
import { recoveryAdjustment } from "../signals/wearable/wearable";

const at = (iso: string) => new Date(iso).getTime();

// ============================================================================
// 1. OVERLAP
// ============================================================================

describe("mergeIntervals", () => {
  it("counts overlapped time once", () => {
    const merged = mergeIntervals([
      { start: 0, end: 100 },
      { start: 50, end: 150 },
    ]);
    expect(merged).toEqual([{ start: 0, end: 150 }]);
  });

  it("joins contiguous ranges and keeps disjoint ones apart", () => {
    expect(
      mergeIntervals([
        { start: 0, end: 100 },
        { start: 100, end: 200 },
        { start: 500, end: 600 },
      ]),
    ).toEqual([
      { start: 0, end: 200 },
      { start: 500, end: 600 },
    ]);
  });

  it("absorbs a range fully inside another", () => {
    // The stage-inside-Asleep case, which is most of a real night.
    expect(mergeIntervals([{ start: 0, end: 1000 }, { start: 200, end: 300 }])).toEqual([
      { start: 0, end: 1000 },
    ]);
  });

  it("does not care what order they arrive in", () => {
    expect(
      mergeIntervals([
        { start: 500, end: 600 },
        { start: 0, end: 100 },
        { start: 50, end: 520 },
      ]),
    ).toEqual([{ start: 0, end: 600 }]);
  });

  it("drops zero-length and inverted ranges", () => {
    expect(
      mergeIntervals([
        { start: 100, end: 100 },
        { start: 300, end: 200 },
        { start: Number.NaN, end: 5 },
      ]),
    ).toEqual([]);
  });
});

describe("sleep from a real HealthKit night", () => {
  /**
   * One night as HealthKit actually returns it: InBed from the phone, Asleep
   * from the watch, and four stage samples that subdivide the same Asleep
   * period. Naive summing gives ~22h. The truth is 07:05 − 23:31 = 7h34m.
   */
  const NIGHT = [
    { startDate: "2026-08-29T23:10:00Z", endDate: "2026-08-30T07:20:00Z", value: "INBED" },
    { startDate: "2026-08-29T23:31:00Z", endDate: "2026-08-30T07:05:00Z", value: "ASLEEP" },
    { startDate: "2026-08-29T23:31:00Z", endDate: "2026-08-30T01:04:00Z", value: "CORE" },
    { startDate: "2026-08-30T01:04:00Z", endDate: "2026-08-30T01:52:00Z", value: "DEEP" },
    { startDate: "2026-08-30T01:52:00Z", endDate: "2026-08-30T02:40:00Z", value: "REM" },
    { startDate: "2026-08-30T02:40:00Z", endDate: "2026-08-30T07:05:00Z", value: "CORE" },
  ];

  const now = new Date("2026-08-30T09:00:00Z");

  it("reports the night, not the sum of its layers", () => {
    const snap = snapshotFromHealthKit(
      { sleep: NIGHT, hrv: [], restingHr: [], steps: [], activeEnergy: [] },
      now,
    )!;
    // 23:31 → 07:05 is 7h34m. Naive summing would say ~22h.
    expect(snap.sleepHours).toBeCloseTo(7.57, 1);
    expect(snap.sleepHours!).toBeLessThan(9);
  });

  it("excludes time in bed but not asleep", () => {
    // InBed runs 23:10→07:20; if it counted, the total would be 8h10m.
    const snap = snapshotFromHealthKit(
      { sleep: NIGHT, hrv: [], restingHr: [], steps: [], activeEnergy: [] },
      now,
    )!;
    expect(snap.sleepHours!).toBeLessThan(8);
  });

  it("refuses a corrupt feed rather than reporting an impossible night", () => {
    const absurd = sleepHoursFromSamples(
      [{ start: at("2026-08-01T00:00:00Z"), end: at("2026-08-30T00:00:00Z") }],
      { start: 0, end: at("2027-01-01T00:00:00Z") },
    );
    expect(absurd).toBeUndefined();
  });
});

describe("lastNightWindow", () => {
  const now = new Date("2026-08-30T09:00:00Z");

  it("opens the evening before and closes at the present moment", () => {
    const w = lastNightWindow(now);
    expect(new Date(w.start).getHours()).toBe(18);
    expect(new Date(w.start).getDate()).toBe(29);
    // Before 2 p.m. the window cannot extend past now.
    expect(w.end).toBe(now.getTime());
  });

  it("excludes an afternoon nap", () => {
    // "How much did you sleep last night" — a 3 p.m. nap is a different
    // question, and folding it in would make a tired day read as rested.
    const evening = new Date("2026-08-30T20:00:00Z");
    const w = lastNightWindow(evening);
    const nap = { start: at("2026-08-30T15:00:00Z"), end: at("2026-08-30T16:30:00Z") };
    expect(sleepHoursFromSamples([nap], w)).toBeUndefined();
  });
});

describe("totalHours", () => {
  it("measures covered time, not the count of ranges", () => {
    expect(
      totalHours([
        { start: 0, end: 3_600_000 },
        { start: 1_800_000, end: 7_200_000 },
      ]),
    ).toBe(2);
  });
});

// ============================================================================
// 2. NEVER A ZERO-FILLED SNAPSHOT
// ============================================================================

describe("no data is null, not zero", () => {
  const now = new Date("2026-08-30T09:00:00Z");

  it("HealthKit: an empty read produces no snapshot at all", () => {
    // Indistinguishable from a declined permission — see the file header.
    expect(
      snapshotFromHealthKit(
        { sleep: [], hrv: [], restingHr: [], steps: [], activeEnergy: [] },
        now,
      ),
    ).toBeNull();
  });

  it("Health Connect: the same", () => {
    expect(
      snapshotFromHealthConnect(
        {
          sleepSessions: [],
          hrv: [],
          restingHr: [],
          steps: undefined,
          activeEnergyKcal: undefined,
        },
        now,
      ),
    ).toBeNull();
  });

  it("one real metric is enough to be worth reporting", () => {
    const snap = snapshotFromHealthConnect(
      {
        sleepSessions: [],
        hrv: [],
        restingHr: [],
        steps: 8213,
        activeEnergyKcal: undefined,
      },
      now,
    )!;
    expect(snap.steps).toBe(8213);
    // Everything unread stays genuinely absent rather than becoming 0.
    expect(snap.sleepHours).toBeUndefined();
    expect(snap.hrvMs).toBeUndefined();
  });
});

// ============================================================================
// 3. UNITS
// ============================================================================

describe("HRV units", () => {
  const now = new Date("2026-08-30T09:00:00Z");
  const dated = (iso: string, value: number) => ({ endDate: iso, value });

  it("rescues HealthKit's seconds-valued SDNN into milliseconds", () => {
    const snap = snapshotFromHealthKit(
      {
        sleep: [],
        hrv: [dated("2026-08-30T05:00:00Z", 0.058)], // 58 ms
        restingHr: [],
        steps: [],
        activeEnergy: [],
      },
      now,
    )!;
    expect(snap.hrvMs).toBeCloseTo(58, 5);
  });

  it("leaves a value already in milliseconds alone", () => {
    const snap = snapshotFromHealthKit(
      { sleep: [], hrv: [dated("2026-08-30T05:00:00Z", 58)], restingHr: [], steps: [], activeEnergy: [] },
      now,
    )!;
    expect(snap.hrvMs).toBeCloseTo(58, 5);
  });

  it("does not rescale Health Connect's RMSSD, which is already ms", () => {
    const snap = snapshotFromHealthConnect(
      {
        sleepSessions: [],
        hrv: [{ time: "2026-08-30T05:00:00Z", heartRateVariabilityMillis: 58 }],
        restingHr: [],
        steps: undefined,
        activeEnergyKcal: undefined,
      },
      now,
    )!;
    expect(snap.hrvMs).toBe(58);
  });
});

describe("plausibility ranges", () => {
  it("rejects a dropped strap rather than reporting a crisis", () => {
    // A chest strap dropping out writes 0 bpm. That is a non-reading, and
    // surfacing it would tell someone their heart stopped.
    expect(plausible("restingHr", 0)).toBeUndefined();
    expect(plausible("hrvMs", 400)).toBeUndefined();
    expect(plausible("restingHr", 52)).toBe(52);
    expect(plausible("hrvMs", 58)).toBe(58);
    expect(plausible("steps", undefined)).toBeUndefined();
  });
});

// ============================================================================
// 4. BASELINES
// ============================================================================

describe("rollingBaseline", () => {
  const now = new Date("2026-08-30T09:00:00Z");
  const days = (n: number) => now.getTime() - n * 86_400_000;

  it("refuses to call three readings a baseline", () => {
    const history = [1, 2, 3].map((d) => ({ at: days(d), value: 55 }));
    expect(rollingBaseline(history, { now })).toBeUndefined();
  });

  it("returns one once there are enough readings", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({ at: days(i + 1), value: 55 }));
    expect(rollingBaseline(history, { now })).toBe(55);
  });

  it("uses the median so one bad night cannot move it", () => {
    const history = [
      ...Array.from({ length: 9 }, (_, i) => ({ at: days(i + 1), value: 55 })),
      { at: days(10), value: 5000 }, // an artefact
    ];
    // A mean would report ~549. The median holds at 55.
    expect(rollingBaseline(history, { now })).toBe(55);
  });

  it("ignores readings outside the window", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({ at: days(i + 60), value: 55 }));
    expect(rollingBaseline(history, { now })).toBeUndefined();
  });

  it("is what finally lets the HRV fold fire", () => {
    // The point of the whole exercise: recoveryAdjustment's HRV term is a
    // no-op without a baseline, which nothing was computing before.
    const withBaseline = recoveryAdjustment({
      date: "2026-08-30",
      hrvMs: 40,
      hrvBaselineMs: 58,
      source: "healthkit",
      fetchedAt: now.toISOString(),
    });
    expect(withBaseline.hasSignal).toBe(true);
    expect(withBaseline.delta).toBeLessThan(0);

    const without = recoveryAdjustment({
      date: "2026-08-30",
      hrvMs: 40,
      source: "healthkit",
      fetchedAt: now.toISOString(),
    });
    expect(without.hasSignal).toBe(false);
    expect(without.delta).toBe(0);
  });
});

describe("median and latest", () => {
  it("medians an even-length set across the middle pair", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeUndefined();
  });

  it("takes the most recent reading regardless of array order", () => {
    expect(
      latest([
        { at: 100, value: 1 },
        { at: 300, value: 3 },
        { at: 200, value: 2 },
      ]),
    ).toEqual({ at: 300, value: 3 });
  });
});

// ============================================================================
// HEALTH CONNECT'S OWN SHAPE
// ============================================================================

describe("sleepIntervalsFromSessions", () => {
  it("uses the stages when a session has them", () => {
    const intervals = sleepIntervalsFromSessions([
      {
        startTime: "2026-08-29T23:00:00Z",
        endTime: "2026-08-30T07:30:00Z",
        stages: [
          { startTime: "2026-08-29T23:10:00Z", endTime: "2026-08-30T01:00:00Z", stage: 4 },
          { startTime: "2026-08-30T01:00:00Z", endTime: "2026-08-30T02:00:00Z", stage: 5 },
          { startTime: "2026-08-30T02:00:00Z", endTime: "2026-08-30T02:20:00Z", stage: 1 }, // AWAKE
        ],
      },
    ]);
    // Three stages in, two out — the awake one is dropped, and the SESSION
    // itself is not added on top of its own stages.
    expect(intervals).toHaveLength(2);
    expect(totalHours(intervals)).toBeCloseTo(2.83, 1);
  });

  it("falls back to the session when there are no stages", () => {
    // A manual entry, or a writer that only records totals.
    const intervals = sleepIntervalsFromSessions([
      { startTime: "2026-08-29T23:00:00Z", endTime: "2026-08-30T07:00:00Z" },
    ]);
    expect(totalHours(intervals)).toBe(8);
  });

  it("accepts named stages as well as numeric ones", () => {
    const intervals = sleepIntervalsFromSessions([
      {
        startTime: "2026-08-29T23:00:00Z",
        endTime: "2026-08-30T07:00:00Z",
        stages: [
          { startTime: "2026-08-29T23:00:00Z", endTime: "2026-08-30T03:00:00Z", stage: "DEEP" },
          { startTime: "2026-08-30T03:00:00Z", endTime: "2026-08-30T04:00:00Z", stage: "AWAKE" },
        ],
      },
    ]);
    expect(totalHours(intervals)).toBe(4);
  });
});
