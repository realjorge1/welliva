/**
 * MOMENT ENGINE tests.
 *
 * Written against the BEHAVIOUR the engine promises, not against its
 * implementation — the mistake that let services/gozlin/agent/clinical.ts ship
 * with 21 green tests and a gate that missed almost everything. So the cases
 * below are built from scenarios ("a user who took a fortnight off and came
 * back"), and several of them assert that the engine stays SILENT, which is the
 * half a threshold system never gets tested on.
 *
 * The rule under test throughout: every number the engine speaks must be
 * countable from the input it was given.
 */
import { describe, expect, it } from "vitest";

import {
  EMPTY_MOMENT_RECORD,
  detectMoments,
  detectNudge,
  type MomentInput,
  type MomentRecord,
} from "../MomentEngine";
import type { StreakData } from "../StreakService";
import type { WorkoutLogEntry } from "../../models/workout";
import type { SessionSummaryData } from "../../models/session";
import type { DietHistoryEntry } from "../../models/diet";

// ── builders ────────────────────────────────────────────────────────────────

const streak = (over: Partial<StreakData> = {}): StreakData => ({
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: "2026-08-20",
  totalActiveDays: 0,
  badges: [],
  weekActivity: [false, false, false, false, false, false, false],
  ...over,
});

const workout = (date: string, id = date): WorkoutLogEntry => ({
  id,
  date,
  sessionId: "s",
  sessionLabel: "Push",
  exercisesCompleted: 5,
  totalExercises: 5,
  completionPercent: 100,
  durationMinutes: 40,
  completedAt: `${date}T10:00:00.000Z`,
});

const session = (date: string, reps: number, runId = `${date}-${reps}`): SessionSummaryData => ({
  sessionRunId: runId,
  workoutSessionId: "w",
  sessionLabel: "Push",
  date,
  exerciseResults: [],
  totalExercises: 5,
  exercisesCompleted: 5,
  totalSets: 15,
  setsCompleted: 15,
  totalReps: reps,
  durationSeconds: 2400,
  caloriesBurned: 300,
  completionPercent: 100,
  completedAt: `${date}T10:00:00.000Z`,
});

const diet = (date: string, meals = 3): DietHistoryEntry => ({
  date,
  dietId: "d",
  dietName: "Balanced",
  mealsConsumed: meals,
  totalMeals: 3,
  status: "completed",
});

const input = (over: Partial<MomentInput> = {}): MomentInput => ({
  today: "2026-08-20",
  streak: streak(),
  workoutLog: [],
  sessionHistory: [],
  dietHistory: [],
  ...over,
});

/** Consecutive YYYY-MM-DD strings ending at `end`. */
function runOfDays(end: string, n: number): string[] {
  const out: string[] = [];
  const [y, m, d] = end.split("-").map(Number);
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(y, m - 1, d - i);
    out.push(
      `${dt.getFullYear()}-${`${dt.getMonth() + 1}`.padStart(2, "0")}-${`${dt.getDate()}`.padStart(2, "0")}`,
    );
  }
  return out;
}

// ── the silence contract ────────────────────────────────────────────────────

describe("stays silent when it has nothing true to say", () => {
  it("says nothing to a brand-new user with no history", () => {
    const { newly } = detectMoments(input(), EMPTY_MOMENT_RECORD);
    expect(newly).toEqual([]);
  });

  it("does not call a 2-day streak a broken record", () => {
    const { newly } = detectMoments(
      input({ streak: streak({ currentStreak: 2, longestStreak: 2 }) }),
      EMPTY_MOMENT_RECORD,
    );
    expect(newly).toEqual([]);
  });

  it("does not claim a weekday pattern from two weeks of data", () => {
    const dates = runOfDays("2026-08-20", 14);
    const { newly } = detectMoments(
      input({ dietHistory: dates.map((d) => diet(d)) }),
      EMPTY_MOMENT_RECORD,
    );
    expect(newly.some((m) => m.kind === "pattern_noticed")).toBe(false);
  });

  it("treats a single missed day as life, not a comeback", () => {
    // …-08-16 missing, back on 17/18/19/20.
    const dates = ["2026-08-13", "2026-08-14", "2026-08-15", ...runOfDays("2026-08-20", 4)];
    const { newly } = detectMoments(
      input({ dietHistory: dates.map((d) => diet(d)) }),
      EMPTY_MOMENT_RECORD,
    );
    expect(newly.some((m) => m.kind === "comeback")).toBe(false);
  });
});

// ── surprise ────────────────────────────────────────────────────────────────

describe("streak records", () => {
  const held: MomentRecord = { ...EMPTY_MOMENT_RECORD, knownLongestStreak: 12 };

  it("fires the day the old record is beaten, quoting the real old number", () => {
    const { newly } = detectMoments(
      input({ streak: streak({ currentStreak: 13, longestStreak: 13 }) }),
      held,
    );
    expect(newly).toHaveLength(1);
    expect(newly[0].kind).toBe("streak_record");
    expect(newly[0].line).toContain("13 days");
    expect(newly[0].line).toContain("12"); // the record it actually beat
  });

  it("does NOT fire again on day 14 — you beat it once, then you hold it", () => {
    const first = detectMoments(
      input({ streak: streak({ currentStreak: 13, longestStreak: 13 }) }),
      held,
    );
    expect(first.newly).toHaveLength(1);

    const second = detectMoments(
      input({ streak: streak({ currentStreak: 14, longestStreak: 14 }) }),
      first.record,
    );
    expect(second.newly.some((m) => m.kind === "streak_record")).toBe(false);
  });

  it("re-arms after the streak breaks", () => {
    const afterWin = detectMoments(
      input({ streak: streak({ currentStreak: 13, longestStreak: 13 }) }),
      held,
    ).record;
    const broken = detectMoments(
      input({ streak: streak({ currentStreak: 0, longestStreak: 13 }) }),
      afterWin,
    ).record;
    expect(broken.streakRecordHeld).toBe(false);

    const climbedBack = detectMoments(
      input({ streak: streak({ currentStreak: 14, longestStreak: 14 }) }),
      broken,
    );
    expect(climbedBack.newly.some((m) => m.kind === "streak_record")).toBe(true);
  });

  it("never fires on the very first check, however long the streak", () => {
    // The whole point of advancing the record on a silent pass: a returning
    // user must not be told they broke a record they had held for months.
    const { newly, record } = detectMoments(
      input({ streak: streak({ currentStreak: 40, longestStreak: 40 }) }),
      EMPTY_MOMENT_RECORD,
    );
    expect(newly.some((m) => m.kind === "streak_record")).toBe(false);
    expect(record.knownLongestStreak).toBe(40);
  });
});

describe("comeback", () => {
  it("names a real break and the days held since, both counted", () => {
    // Active for a week, away for 10 days, back for 3.
    const before = runOfDays("2026-08-04", 7);
    const back = runOfDays("2026-08-20", 3);
    const { newly } = detectMoments(
      input({ dietHistory: [...before, ...back].map((d) => diet(d)) }),
      EMPTY_MOMENT_RECORD,
    );
    const m = newly.find((x) => x.kind === "comeback");
    expect(m).toBeDefined();
    expect(m!.line).toContain("3 days running");
  });

  it("says nothing when the user came back for exactly one day", () => {
    const before = runOfDays("2026-08-04", 7);
    const { newly } = detectMoments(
      input({ dietHistory: [...before, "2026-08-20"].map((d) => diet(d)) }),
      EMPTY_MOMENT_RECORD,
    );
    expect(newly.some((m) => m.kind === "comeback")).toBe(false);
  });
});

describe("training records", () => {
  it("calls the biggest week only when earlier weeks exist to beat", () => {
    const log = [
      // two prior weeks of 2
      workout("2026-08-04"), workout("2026-08-06"),
      workout("2026-08-11"), workout("2026-08-13"),
      // this week: 3
      workout("2026-08-17"), workout("2026-08-18"), workout("2026-08-19"),
    ];
    const { newly } = detectMoments(input({ workoutLog: log }), EMPTY_MOMENT_RECORD);
    const m = newly.find((x) => x.kind === "best_training_week");
    expect(m).toBeDefined();
    expect(m!.line).toContain("3 sessions");
    expect(m!.line).toContain("2"); // the previous best it actually beat
  });

  it("does not call week one the biggest week ever", () => {
    const log = [workout("2026-08-17"), workout("2026-08-18"), workout("2026-08-19")];
    const { newly } = detectMoments(input({ workoutLog: log }), EMPTY_MOMENT_RECORD);
    expect(newly.some((m) => m.kind === "best_training_week")).toBe(false);
  });

  it("reports a rep PR against the real previous best", () => {
    const hist = [
      session("2026-08-10", 100), session("2026-08-12", 120),
      session("2026-08-14", 110), session("2026-08-19", 150),
    ];
    const { newly } = detectMoments(input({ sessionHistory: hist }), EMPTY_MOMENT_RECORD);
    const m = newly.find((x) => x.kind === "session_record");
    expect(m).toBeDefined();
    expect(m!.line).toContain("150 reps");
    expect(m!.line).toContain("120"); // previous best, not 110 or 100
  });
});

describe("one at a time", () => {
  it("never queues two celebrations from one check", () => {
    const log = [
      workout("2026-08-04"), workout("2026-08-11"),
      workout("2026-08-17"), workout("2026-08-18"), workout("2026-08-19"),
    ];
    const { newly } = detectMoments(
      input({
        streak: streak({ currentStreak: 13, longestStreak: 13 }),
        workoutLog: log,
        sessionHistory: [
          session("2026-08-10", 100), session("2026-08-12", 120),
          session("2026-08-14", 110), session("2026-08-19", 150),
        ],
      }),
      { ...EMPTY_MOMENT_RECORD, knownLongestStreak: 12 },
    );
    expect(newly.length).toBeLessThanOrEqual(1);
  });
});

// ── anticipation ────────────────────────────────────────────────────────────

describe("nudges", () => {
  // The WORDING of every nudge rotates on purpose (services/momentVoice), so
  // these assert the facts and the grammar rather than one blessed sentence.
  it("counts the days to the record correctly, inclusive of the day that ties", () => {
    const n = detectNudge(
      input({ streak: streak({ currentStreak: 10, longestStreak: 12 }) }),
      { ...EMPTY_MOMENT_RECORD, knownLongestStreak: 12 },
    );
    expect(n).not.toBeNull();
    expect(n!.kind).toBe("streak_near_record");
    // 10 → needs 11, 12, 13 to beat 12. Three days.
    expect(n!.headline).toContain("3 days");
    expect(n!.detail).toContain("10");
    expect(n!.detail).toContain("12");
  });

  it("uses the singular the day before", () => {
    const n = detectNudge(
      input({ streak: streak({ currentStreak: 12, longestStreak: 12 }) }),
      { ...EMPTY_MOMENT_RECORD, knownLongestStreak: 12 },
    );
    expect(n!.headline.toLowerCase()).toContain("one day");
    expect(n!.headline).not.toContain("1 day");
    expect(n!.headline).not.toContain("days");
  });

  it("says the same fact differently as the fact changes", () => {
    // Same user, one more day on the streak: the numbers move, and the words
    // must not simply be the old sentence with a digit swapped.
    const at10 = detectNudge(
      input({ streak: streak({ currentStreak: 10, longestStreak: 12 }) }),
      { ...EMPTY_MOMENT_RECORD, knownLongestStreak: 12 },
    )!;
    const at11 = detectNudge(
      input({ streak: streak({ currentStreak: 11, longestStreak: 12 }) }),
      { ...EMPTY_MOMENT_RECORD, knownLongestStreak: 12 },
    )!;
    expect(at10.detail).not.toBe(at11.detail);
  });

  it("gives the identical fact the identical phrasing every time", () => {
    // Determinism is what stops the card reshuffling on every re-render.
    const once = detectNudge(
      input({ streak: streak({ currentStreak: 10, longestStreak: 12 }) }),
      { ...EMPTY_MOMENT_RECORD, knownLongestStreak: 12 },
    )!;
    const twice = detectNudge(
      input({ streak: streak({ currentStreak: 10, longestStreak: 12 }) }),
      { ...EMPTY_MOMENT_RECORD, knownLongestStreak: 12 },
    )!;
    expect(twice.headline).toBe(once.headline);
    expect(twice.detail).toBe(once.detail);
  });

  it("stays quiet when the record is far away — no false urgency", () => {
    const n = detectNudge(
      input({ streak: streak({ currentStreak: 2, longestStreak: 30 }) }),
      { ...EMPTY_MOMENT_RECORD, knownLongestStreak: 30 },
    );
    expect(n).toBeNull();
  });

  it("stays quiet for a user with no record worth chasing", () => {
    const n = detectNudge(
      input({ streak: streak({ currentStreak: 2, longestStreak: 3 }) }),
      { ...EMPTY_MOMENT_RECORD, knownLongestStreak: 3 },
    );
    expect(n).toBeNull();
  });

  it("offers the week record when the streak has nothing to say", () => {
    const n = detectNudge(
      input({
        workoutLog: [workout("2026-08-17"), workout("2026-08-18"), workout("2026-08-19")],
      }),
      { ...EMPTY_MOMENT_RECORD, bestWeekSessions: 3 },
    );
    expect(n).not.toBeNull();
    expect(n!.kind).toBe("week_near_record");
    expect(n!.detail).toContain("3");
    // The number that BREAKS the record — fixed, and reachable.
    expect(n!.progress).toEqual({ value: 3, target: 4 });
  });

  it("fills the bar and states the record once the week is actually the best", () => {
    // Record of 3 completed weeks; this week already has 4.
    const n = detectNudge(
      input({
        workoutLog: [
          workout("2026-08-17"),
          workout("2026-08-18"),
          workout("2026-08-19"),
          workout("2026-08-20"),
        ],
      }),
      { ...EMPTY_MOMENT_RECORD, bestWeekSessions: 3 },
    );
    expect(n).not.toBeNull();
    expect(n!.kind).toBe("week_record_held");
    expect(n!.progress.value).toBeGreaterThanOrEqual(n!.progress.target);
    expect(n!.badge).toBe("Personal best");
    expect(n!.detail).toContain("4"); // this week
    expect(n!.detail).toContain("3"); // the record it beat
  });

  it("does not put the week record on a treadmill", () => {
    // THE REGRESSION THIS FILE EXISTS FOR. bestWeekSessions used to absorb the
    // week in progress, so the target was forever count + 1 and the bar could
    // never fill: 5 of 6, then 6 of 7, then 7 of 8, the same sentence with a
    // new digit. The record must come from COMPLETED weeks only.
    const priorWeeks = [
      workout("2026-08-10"),
      workout("2026-08-11"),
      workout("2026-08-12"),
    ];
    const thisWeek = ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"].map((d) =>
      workout(d),
    );
    const { record } = detectMoments(
      input({ workoutLog: [...priorWeeks, ...thisWeek] }),
      EMPTY_MOMENT_RECORD,
    );
    // The live week (4) must NOT have become the record — the completed week
    // (3) is what there is to beat.
    expect(record.bestWeekSessions).toBe(3);

    const n = detectNudge(input({ workoutLog: [...priorWeeks, ...thisWeek] }), record);
    expect(n!.progress.target).toBe(4);
    expect(n!.progress.value / n!.progress.target).toBe(1);
  });

  it("lets the best-week MOMENT fire, which the polluted record blocked", () => {
    // `detectBestWeek` guards on `count <= rec.bestWeekSessions`. While the
    // record absorbed the live week that condition was permanently true, so
    // this celebration could never happen at all.
    const log = [
      workout("2026-08-03"), workout("2026-08-05"),
      workout("2026-08-10"), workout("2026-08-12"),
      workout("2026-08-17"), workout("2026-08-18"), workout("2026-08-19"),
    ];
    const first = detectMoments(input({ workoutLog: log }), EMPTY_MOMENT_RECORD);
    expect(first.newly.some((m) => m.kind === "best_training_week")).toBe(true);
    expect(first.record.bestWeekSessions).toBe(2); // completed weeks only
  });

  it("flags a round lifetime number only when it is genuinely close", () => {
    expect(
      detectNudge(input({ streak: streak({ totalActiveDays: 98 }) }), EMPTY_MOMENT_RECORD)!.kind,
    ).toBe("active_days_near");
    expect(
      detectNudge(input({ streak: streak({ totalActiveDays: 80 }) }), EMPTY_MOMENT_RECORD),
    ).toBeNull();
  });

  it("never returns a progress ratio above 1", () => {
    const n = detectNudge(
      input({ streak: streak({ currentStreak: 12, longestStreak: 12 }) }),
      { ...EMPTY_MOMENT_RECORD, knownLongestStreak: 12 },
    );
    expect(n!.progress.value / n!.progress.target).toBeLessThanOrEqual(1);
  });
});
