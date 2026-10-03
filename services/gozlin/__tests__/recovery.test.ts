/**
 * Recovery reads the check-in.
 *
 * It used to be training load alone for anyone without a watch, so someone who
 * logged "4 hours, Drained" at breakfast — and hadn't trained in two days — was
 * told "Fresh legs. If you want a bonus session, your body can take it."
 */

import { describe, expect, it } from "vitest";
import type { WorkoutLogEntry } from "../../../models/workout";
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
    // Trained yesterday, so the battery isn't already full.
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

// ── The battery ────────────────────────────────────────────────────────────

/** NOW shifted by a number of hours. */
const at = (hours: number) => new Date(NOW.getTime() + hours * HOUR);

function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A session that ended at `ended`. */
function logged(minutes: number, ended: Date, completionPercent = 100): WorkoutLogEntry {
  return {
    id: `s-${ended.getTime()}`,
    date: localDate(ended),
    sessionId: "session",
    sessionLabel: "Full body",
    exercisesCompleted: 5,
    totalExercises: 5,
    completionPercent,
    durationMinutes: minutes,
    completedAt: ended.toISOString(),
  };
}

describe("recovery is a battery", () => {
  it("lands a usual session in amber for every level, and is green by the same time tomorrow", () => {
    const usual = { beginner: 30, intermediate: 45, advanced: 60 } as const;
    for (const [exerciseLevel, minutes] of Object.entries(usual)) {
      const opts = { ...base, workoutLog: [logged(minutes, NOW)], exerciseLevel: exerciseLevel as never };
      const after = computeRecovery(opts);
      expect(after.level).toBe("amber");
      expect(after.score).toBeGreaterThanOrEqual(59);
      expect(after.score).toBeLessThanOrEqual(60);
      expect(computeRecovery({ ...opts, now: at(24) }).level).toBe("green");
    }
  });

  it("takes more out of a beginner, and gives it back slower", () => {
    const workoutLog = [logged(60, at(-2))];
    const beginner = computeRecovery({ ...base, workoutLog, exerciseLevel: "beginner" });
    const advanced = computeRecovery({ ...base, workoutLog, exerciseLevel: "advanced" });
    expect(beginner.score).toBe(23); // 100 − 80 drained, + 2h × 1.6
    expect(advanced.score).toBe(65); // 100 − 40 drained, + 2h × 2.4
    expect(beginner.fullAt!).toBeGreaterThan(advanced.fullAt!);
  });

  it("counts the hours trained, not just the sessions", () => {
    const short = computeRecovery({ ...base, workoutLog: [logged(20, at(-1))], exerciseLevel: "intermediate" });
    const long = computeRecovery({ ...base, workoutLog: [logged(120, at(-1))], exerciseLevel: "intermediate" });
    expect(short.level).toBe("green");
    expect(long.level).toBe("red");
  });

  it("charges an abandoned session less than a finished one of the same length", () => {
    const finished = computeRecovery({ ...base, workoutLog: [logged(60, at(-1), 100)], exerciseLevel: "intermediate" });
    const abandoned = computeRecovery({ ...base, workoutLog: [logged(60, at(-1), 20)], exerciseLevel: "intermediate" });
    expect(abandoned.score).toBeGreaterThan(finished.score);
  });

  it("recharges by the hour and never jumps at midnight", () => {
    const opts = { ...base, workoutLog: [logged(90, at(-12))], exerciseLevel: "intermediate" as const }; // 8pm
    const beforeMidnight = computeRecovery({ ...opts, now: at(-8.5) }); // 11:30pm
    const afterMidnight = computeRecovery({ ...opts, now: at(-7.5) }); // 12:30am
    expect(afterMidnight.score - beforeMidnight.score).toBe(2);

    let last = -1;
    for (let h = -12; h <= 36; h++) {
      const r = computeRecovery({ ...opts, now: at(h) });
      expect(r.score).toBeGreaterThanOrEqual(last);
      last = r.score;
    }
    expect(last).toBe(100);
  });

  it("says when it will be full, and is full then", () => {
    const opts = { ...base, workoutLog: [logged(45, at(-2))], exerciseLevel: "intermediate" as const };
    const r = computeRecovery(opts);
    expect(r.fullAt).not.toBeNull();
    const then = computeRecovery({ ...opts, now: new Date(r.fullAt!) });
    expect(then.score).toBe(100);
    expect(then.fullAt).toBeNull();
    expect(computeRecovery({ ...opts, now: new Date(r.fullAt! - HOUR) }).score).toBeLessThan(100);
  });

  it("names what holds it down instead of promising a time a check-in won't keep", () => {
    const opts = { ...base, workoutLog: [logged(45, at(-2))], exerciseLevel: "intermediate" as const };
    const drained = computeRecovery({ ...opts, checkins: [entry({ labels: ["Drained"] })] });
    expect(drained.fullAt).toBeNull();
    expect(drained.heldBackBy).toBe("you said you felt drained");

    // A long night isn't holding anything down, so the time stays.
    const slept = computeRecovery({ ...opts, checkins: [entry({ sleepHours: 8.5 })] });
    expect(slept.fullAt).not.toBeNull();
    expect(slept.heldBackBy).toBeNull();
  });

  it("names a short night on the watch, not the good reading that came with it", () => {
    const r = computeRecovery({
      ...base,
      wearable: { sleepHours: 4.2, hrvMs: 80, hrvBaselineMs: 60 } as never,
    });
    expect(r.score).toBeLessThan(100);
    expect(r.heldBackBy).toBe("only 4.2h sleep last night");
  });

  it("lets hard days in a row pile up", () => {
    const evening = (daysAgo: number) => at(-14 - 24 * daysAgo); // 6pm
    const one = computeRecovery({ ...base, workoutLog: [logged(90, evening(0))], exerciseLevel: "intermediate" });
    const three = computeRecovery({
      ...base,
      workoutLog: [logged(90, evening(2)), logged(90, evening(1)), logged(90, evening(0))],
      exerciseLevel: "intermediate",
    });
    expect(one.score).toBe(46);
    expect(three.score).toBe(28);
    expect(three.drivers).toContain(
      "still recharging from 3 sessions (270 min) since you were last fully recharged",
    );
    expect(three.drivers).toContain("3 training days in a row");
  });

  it("names the session it is still recharging from", () => {
    const r = computeRecovery({ ...base, workoutLog: [logged(45, at(-3))], exerciseLevel: "intermediate" });
    expect(r.drivers).toContain("still recharging from a 45-min session 3 hours ago");
  });

  it("treats an unknown level as a beginner", () => {
    const workoutLog = [logged(45, at(-3))];
    expect(computeRecovery({ ...base, workoutLog })).toEqual(
      computeRecovery({ ...base, workoutLog, exerciseLevel: "beginner" }),
    );
  });

  it("counts an entry with no timestamp as that evening, but never later than now", () => {
    const stamped = logged(45, NOW);
    const undated = { ...stamped, completedAt: undefined as never };
    expect(computeRecovery({ ...base, workoutLog: [undated] }).score).toBe(
      computeRecovery({ ...base, workoutLog: [stamped] }).score,
    );
  });

  it("tells someone who already trained today to recharge, not to train at full effort", () => {
    const r = computeRecovery({
      ...base,
      workoutLog: [logged(45, at(-1))],
      exerciseLevel: "intermediate",
      todaySession: { isRestDay: false } as never,
    });
    expect(r.recommendation).toMatch(/You've trained today/);
  });
});
