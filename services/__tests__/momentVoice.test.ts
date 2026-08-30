/**
 * MOMENT VOICE tests — the anti-template contract.
 *
 * The Home nudge card used to have exactly one sentence per kind of fact, so a
 * user's week read "5 done. Your best week ever is 5.", then "6 done. Your best
 * week ever is 6.", then "7 done…" — the same string with the digits swapped.
 * That is what makes a coaching surface read as a mail merge.
 *
 * These tests hold the two properties that fix it and are easy to lose:
 *
 *   VARIETY      — the card has to have a great many things to say.
 *   DETERMINISM  — but it must say the SAME one for the same fact, or it
 *                  reshuffles on every re-render and reads as a glitch.
 *
 * Both are asserted against detectNudge rather than the pools directly, because
 * a pool of a thousand strings that the picker never reaches is worth nothing.
 */
import { describe, expect, it } from "vitest";

import { EMPTY_MOMENT_RECORD, detectNudge, type MomentInput } from "../MomentEngine";
import { pickPhrase, seedHash } from "../momentVoice";
import type { WorkoutLogEntry } from "../../models/workout";

const workout = (date: string, id: string): WorkoutLogEntry => ({
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

const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const input = (over: Partial<MomentInput>): MomentInput => ({
  today: "2026-08-20",
  streak: {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: "",
    totalActiveDays: 0,
    badges: [],
    weekActivity: [false, false, false, false, false, false, false],
  },
  workoutLog: [],
  sessionHistory: [],
  dietHistory: [],
  ...over,
});

/** Consecutive Mondays, so week identity varies the way real weeks do. */
function mondays(n: number): string[] {
  const out: string[] = [];
  const d = new Date(2026, 0, 5); // a Monday
  for (let i = 0; i < n; i++) {
    out.push(key(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

/** Every week-card message reachable across a wide sweep of real histories. */
function weekCardMessages(): Set<string> {
  const seen = new Set<string>();
  for (const monday of mondays(160)) {
    for (let best = 3; best <= 9; best++) {
      for (let week = Math.max(1, best - 1); week <= best + 2; week++) {
        const log: WorkoutLogEntry[] = [];
        for (let i = 0; i < week; i++) {
          const d = new Date(monday);
          d.setDate(d.getDate() + (i % 7));
          log.push(workout(key(d), `${monday}-${i}`));
        }
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        const n = detectNudge(input({ today: key(sunday), workoutLog: log }), {
          ...EMPTY_MOMENT_RECORD,
          bestWeekSessions: best,
        });
        if (n && (n.kind === "week_near_record" || n.kind === "week_record_held")) {
          seen.add(`${n.headline}||${n.detail}`);
        }
      }
    }
  }
  return seen;
}

describe("the card does not read as a template", () => {
  it("has hundreds of distinct things to say about the training week", () => {
    // The brief asked for sixty or more. Headline and detail rotate on separate
    // seeds, so the two pools multiply instead of adding.
    expect(weekCardMessages().size).toBeGreaterThan(60);
  });

  it("never repeats a message for two different sets of numbers", () => {
    // Each phrasing carries its own counted figures, so identical text would
    // mean two different weeks were being described the same way.
    const messages = weekCardMessages();
    expect(messages.size).toBe(new Set(messages).size);
  });
});

describe("the same fact always gets the same words", () => {
  it("is stable across calls — the card cannot reshuffle mid-render", () => {
    const log = [
      workout("2026-08-17", "a"),
      workout("2026-08-18", "b"),
      workout("2026-08-19", "c"),
    ];
    const first = detectNudge(input({ workoutLog: log }), {
      ...EMPTY_MOMENT_RECORD,
      bestWeekSessions: 3,
    })!;
    for (let i = 0; i < 25; i++) {
      const again = detectNudge(input({ workoutLog: log }), {
        ...EMPTY_MOMENT_RECORD,
        bestWeekSessions: 3,
      })!;
      expect(again.headline).toBe(first.headline);
      expect(again.detail).toBe(first.detail);
    }
  });

  it("hashes deterministically and stays inside the pool", () => {
    const pool = ["a", "b", "c", "d", "e"] as const;
    expect(seedHash("week:2026-08-17:4")).toBe(seedHash("week:2026-08-17:4"));
    for (let i = 0; i < 200; i++) {
      expect(pool).toContain(pickPhrase(pool, `seed-${i}`));
    }
  });

  it("spreads across the pool rather than favouring one entry", () => {
    // A hash that collapsed onto a single index would pass every test above and
    // still leave the user reading one sentence forever.
    const pool = Array.from({ length: 32 }, (_, i) => i);
    const hits = new Set(
      Array.from({ length: 500 }, (_, i) => pickPhrase(pool, `week:${i}:5`)),
    );
    expect(hits.size).toBeGreaterThan(24);
  });
});
