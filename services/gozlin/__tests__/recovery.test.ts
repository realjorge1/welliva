/**
 * Recovery reads the check-in.
 *
 * It used to be training load alone for anyone without a watch, so someone who
 * logged "4 hours, Drained" at breakfast — and hadn't trained in two days — was
 * told "Fresh legs. If you want a bonus session, your body can take it."
 */

import { describe, expect, it } from "vitest";
import { computeRecovery } from "../GozlinRecoveryEngine";
import type { GozlinCheckin } from "../gozlin.types";

const NOW = new Date(2026, 8, 27, 8, 0, 0); // 8am local, 27 Sep 2026
const TODAY = "2026-09-27";
const HOUR = 3_600_000;

function entry(over: Partial<GozlinCheckin>): GozlinCheckin {
  return { date: TODAY, kind: "daily", createdAt: NOW.getTime() - HOUR, ...over };
}

const base = { workoutLog: [], todaySession: null, now: NOW };

describe("recovery folds in the day's check-in", () => {
  it("is unchanged with no check-ins at all", () => {
    const a = computeRecovery(base);
    const b = computeRecovery({ ...base, checkins: [] });
    expect(b).toEqual(a);
    expect(a.basis).toMatch(/training-load proxy/);
  });

  it("lets a short night and 'Drained' pull a rested day out of green", () => {
    const rested = computeRecovery(base);
    expect(rested.level).toBe("green");

    const r = computeRecovery({
      ...base,
      checkins: [entry({ sleepHours: 4, labels: ["Drained"] })],
    });
    expect(r.score).toBeLessThan(rested.score);
    expect(r.level).toBe("amber");
    expect(r.recommendation).not.toMatch(/Fresh legs/);
    expect(r.drivers).toContain("you logged 4h sleep");
    expect(r.drivers).toContain("you said you felt drained");
    expect(r.basis).toBe("training load + your check-in (sleep, how you felt) (no wearable)");
  });

  it("reads sleep only from TODAY's daily entry — yesterday's was the night before", () => {
    const r = computeRecovery({
      ...base,
      checkins: [entry({ date: "2026-09-26", sleepHours: 4, createdAt: NOW.getTime() - 30 * HOUR })],
    });
    expect(r).toEqual(computeRecovery(base));
  });

  it("counts last night's momentary 'Tired', but not one from two days ago", () => {
    const lastNight = computeRecovery({
      ...base,
      checkins: [
        entry({ date: "2026-09-26", kind: "momentary", labels: ["Tired"], createdAt: NOW.getTime() - 10 * HOUR }),
      ],
    });
    expect(lastNight.drivers).toContain("you said you felt tired");

    const stale = computeRecovery({
      ...base,
      checkins: [
        entry({ date: "2026-09-25", kind: "momentary", labels: ["Tired"], createdAt: NOW.getTime() - 40 * HOUR }),
      ],
    });
    expect(stale).toEqual(computeRecovery(base));
  });

  it("caps the level on 'Drained' alone, however rested the log looks", () => {
    // Two rest days: the load score is at its ceiling with bonus to spare. A
    // subtraction folded in before the clamp used to vanish into that spare.
    const r = computeRecovery({ ...base, checkins: [entry({ labels: ["Drained"] })] });
    expect(r.level).toBe("amber");
  });

  it("weighs stress below exhaustion", () => {
    const stressed = computeRecovery({ ...base, checkins: [entry({ labels: ["Stressed"] })] });
    const drained = computeRecovery({ ...base, checkins: [entry({ labels: ["Drained"] })] });
    expect(stressed.score).toBeGreaterThan(drained.score);
    expect(stressed.score).toBeLessThan(computeRecovery(base).score);
  });

  it("credits a long night", () => {
    // Trained yesterday, so there's no rest bonus pinning the score at 100.
    const log = [{ date: "2026-09-26", completionPercent: 100, durationMinutes: 45 }] as never[];
    const plain = computeRecovery({ ...base, workoutLog: log });
    const slept = computeRecovery({ ...base, workoutLog: log, checkins: [entry({ sleepHours: 8.5 })] });
    expect(slept.score).toBeGreaterThan(plain.score);
    expect(slept.drivers[0]).toBe("you logged 8.5h sleep");
  });

  it("lets a wearable's measured night win over the typed one", () => {
    const wearable = { sleepHours: 7.5 } as never;
    const withWatch = computeRecovery({ ...base, wearable });
    const both = computeRecovery({ ...base, wearable, checkins: [entry({ sleepHours: 4 })] });
    expect(both.score).toBe(withWatch.score);
    expect(both.drivers.join(" ")).not.toMatch(/you logged/);
  });

  it("ignores a feeling that isn't about energy or pressure", () => {
    const r = computeRecovery({ ...base, checkins: [entry({ labels: ["Sad", "Lonely"] })] });
    expect(r).toEqual(computeRecovery(base));
  });
});
