/**
 * The home-screen widget's word and line, under test.
 *
 * The owner chose it on 2026-11-14 after a round they called "too like other
 * apps": a gold word that is TRUE about today, never the same word all week,
 * above the day drawn as a line of light. These tests pin what makes it
 * honest: the priority of the rules, the date rotation, the forbidden words,
 * when the gold starts, and that yesterday is never shown as today.
 */
import { describe, expect, it } from "vitest";
import { todayArtSvg, type Moment } from "../todayArt";
import { buildTodaySnapshot, factsFor, waterGoalMinute, type TodayInputs } from "../todaySnapshot";
import {
  COMEBACK_MIN_GAP_DAYS,
  WORD_POOLS,
  clockOf,
  periodOf,
  situationOf,
  wordFor,
  type DayFacts,
  type Situation,
} from "../todayWords";

const facts = (over: Partial<DayFacts> = {}): DayFacts => ({
  date: "2026-11-12",
  weekday: 4,
  dayOfMonth: 12,
  minute: 10 * 60,
  anyLogged: false,
  kept: false,
  keptAtMin: null,
  keptYesterday: false,
  streak: 0,
  daysAway: null,
  rough: false,
  freezeHeld: false,
  workoutDone: false,
  waterGoalMet: false,
  nourished: false,
  kinds: 0,
  ...over,
});

describe("the word: which rule wins", () => {
  const cases: [string, Partial<DayFacts>, Situation][] = [
    ["a rough day outranks everything", { rough: true, kept: true, workoutDone: true, streak: 7 }, "rough"],
    ["a milestone on the day the run reaches it", { kept: true, streak: 30, workoutDone: true }, "milestone"],
    ["welcome back after a real break", { kept: true, streak: 1, daysAway: COMEBACK_MIN_GAP_DAYS }, "comeback"],
    ["one missed day is not a comeback", { kept: true, streak: 1, daysAway: 2 }, "keptDay"],
    ["a freeze that held, before anything is logged", { freezeHeld: true, streak: 5 }, "freeze"],
    ["a workout", { kept: true, workoutDone: true, waterGoalMet: true }, "workout"],
    ["nourished waits for the evening", { kept: true, nourished: true, minute: 19 * 60 }, "nourished"],
    ["…and not before", { kept: true, nourished: true, minute: 13 * 60 }, "keptDay"],
    ["the whole water goal", { kept: true, waterGoalMet: true }, "hydrated"],
    ["three kinds logged", { kept: true, kinds: 3 }, "fullDay"],
    ["kept before 7, in the morning", { kept: true, keptAtMin: 6 * 60 + 30, minute: 6 * 60 + 40 }, "early"],
    ["kept today and yesterday", { kept: true, keptYesterday: true, streak: 4 }, "steady"],
    ["kept, evening", { kept: true, minute: 19 * 60 }, "keptEvening"],
    ["kept, late", { kept: true, minute: 23 * 60 }, "keptNight"],
    ["nothing yet, a Monday morning", { weekday: 1, minute: 7 * 60 }, "newWeek"],
    ["nothing yet, the 1st", { dayOfMonth: 1, minute: 8 * 60 }, "newMonth"],
    ["nothing yet, a Saturday morning", { weekday: 6, minute: 9 * 60 }, "weekendMorning"],
    ["nothing yet, a weekday morning", { minute: 8 * 60 }, "morning"],
    ["nothing yet, afternoon", { minute: 14 * 60 }, "afternoon"],
    ["nothing kept, evening", { minute: 20 * 60, anyLogged: true }, "evening"],
    ["nothing kept, after 10 pm", { minute: 22 * 60 + 30 }, "night"],
  ];
  for (const [name, over, expected] of cases) {
    it(name, () => expect(situationOf(facts(over))).toBe(expected));
  }
});

describe("the word: honest, and not the same all week", () => {
  it("rotates by date within a situation, and holds all day", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 14; d++) {
      const date = `2026-11-${String(d).padStart(2, "0")}`;
      const morning = wordFor(facts({ date, kept: true, keptYesterday: true, minute: 9 * 60 }));
      const evening = wordFor(facts({ date, kept: true, keptYesterday: true, minute: 16 * 60 }));
      expect(morning.situation).toBe("steady");
      expect(evening.word).toBe(morning.word);
      seen.add(morning.word);
    }
    expect(seen.size).toBeGreaterThan(2);
  });

  it("never uses a word that shames, flatters or begs", () => {
    const all = Object.values(WORD_POOLS).flat().join(" | ").toLowerCase();
    for (const bad of ["lazy", "slipping", "missed", "failed", "amazing", "perfect", "crushing", "don't forget", "still time", "come back"]) {
      expect(all).not.toMatch(new RegExp(`\\b${bad}\\b`));
    }
  });

  it("says why, plainly", () => {
    expect(wordFor(facts({ kept: true, streak: 30 })).why).toBe("30 days in a row");
    expect(wordFor(facts({ kept: true, keptAtMin: 8 * 60 + 10, minute: 11 * 60 })).why).toBe("kept since 8:10");
    expect(wordFor(facts({ minute: 20 * 60, anyLogged: true })).why).toBe("nothing kept today");
    expect(wordFor(facts({ rough: true })).why).toBe("rough day marked");
  });

  it("splits the day where it should", () => {
    expect([4 * 60, 5 * 60, 12 * 60, 17 * 60, 22 * 60].map(periodOf)).toEqual(["night", "morning", "afternoon", "evening", "night"]);
    expect(clockOf(6 * 60 + 5)).toBe("6:05");
  });
});

// ── The snapshot ────────────────────────────────────────────────────────────

const NOW = new Date(2026, 10, 12, 15, 40); // Thu 12 Nov 2026, 15:40 local
const iso = (h: number, m = 0, day = 12) => new Date(2026, 10, day, h, m).toISOString();

function inputs(over: Partial<TodayInputs> = {}): TodayInputs {
  return {
    now: NOW,
    foodLogs: [],
    mealTicks: [],
    pours: [],
    waterGoalMl: 2000,
    workouts: [],
    moods: [],
    habitsDone: [],
    weighedToday: false,
    streak: { currentStreak: 0, longestStreak: 0, lastActiveDate: "", totalActiveDays: 0, days: [] },
    rough: false,
    calories: null,
    protein: null,
    previous: null,
    ...over,
  };
}

describe("the snapshot: the line's beads and its gold", () => {
  it("puts each log at its real time and ignores other days", () => {
    const s = buildTodaySnapshot(
      inputs({
        foodLogs: [{ loggedAt: iso(13, 5) }, { loggedAt: iso(13, 5, 11) }],
        mealTicks: [{ at: iso(8, 30) }],
        pours: [{ at: iso(7, 40), ml: 250 }],
        workouts: [{ date: "2026-11-12", completedAt: iso(12, 0) }, { date: "2026-11-11", completedAt: iso(18, 0, 11) }],
      }),
    );
    expect(s.moments).toEqual([
      { min: 7 * 60 + 40, kind: "water" },
      { min: 8 * 60 + 30, kind: "food" },
      { min: 12 * 60, kind: "move" },
      { min: 13 * 60 + 5, kind: "food" },
    ]);
    expect(s.workoutDone).toBe(true);
  });

  it("starts the gold at the earliest moment that really keeps the day", () => {
    const streak = { currentStreak: 3, longestStreak: 3, lastActiveDate: "2026-11-12", totalActiveDays: 3, days: ["2026-11-10", "2026-11-11", "2026-11-12"] };
    const s = buildTodaySnapshot(inputs({ streak, pours: [{ at: iso(7), ml: 250 }], mealTicks: [{ at: iso(9, 15) }] }));
    // The 7:00 glass is a bead, not the keeping moment.
    expect(s.keptAtMin).toBe(9 * 60 + 15);
    expect(s.keptYesterday).toBe(true);
  });

  it("counts water as keeping only at the pour that met the whole goal", () => {
    const pours = [{ at: iso(8), ml: 800 }, { at: iso(11), ml: 800 }, { at: iso(14, 30), ml: 600 }];
    expect(waterGoalMinute(pours, 2000, "2026-11-12")).toBe(14 * 60 + 30);
    const streak = { currentStreak: 1, longestStreak: 1, lastActiveDate: "2026-11-12", totalActiveDays: 1, days: ["2026-11-12"] };
    const s = buildTodaySnapshot(inputs({ streak, pours }));
    expect(s.waterGoalMet).toBe(true);
    expect(s.keptAtMin).toBe(14 * 60 + 30);
  });

  it("stamps a habit when first seen, and keeps that stamp", () => {
    const first = buildTodaySnapshot(inputs({ habitsDone: ["h1"] }));
    expect(first.moments).toEqual([{ min: 15 * 60 + 40, kind: "habit" }]);
    const later = buildTodaySnapshot(inputs({ now: new Date(2026, 10, 12, 18, 0), habitsDone: ["h1"], previous: first }));
    expect(later.moments).toEqual([{ min: 15 * 60 + 40, kind: "habit" }]);
  });

  it("knows a comeback from the gap before today", () => {
    const streak = { currentStreak: 1, longestStreak: 9, lastActiveDate: "2026-11-12", totalActiveDays: 20, days: ["2026-11-06", "2026-11-12"] };
    const s = buildTodaySnapshot(inputs({ streak, mealTicks: [{ at: iso(9) }] }));
    expect(s.daysAway).toBe(6);
  });

  it("is nourished only on target and with protein met", () => {
    const on = buildTodaySnapshot(inputs({ calories: { consumed: 1950, target: 2000 }, protein: { consumed: 130, target: 120 } }));
    const under = buildTodaySnapshot(inputs({ calories: { consumed: 1500, target: 2000 }, protein: { consumed: 130, target: 120 } }));
    expect(on.nourished).toBe(true);
    expect(under.nourished).toBe(false);
  });
});

describe("the snapshot read back at a later moment", () => {
  const streak = { currentStreak: 4, longestStreak: 4, lastActiveDate: "2026-11-12", totalActiveDays: 4, days: ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"] };
  const snap = buildTodaySnapshot(inputs({ streak, mealTicks: [{ at: iso(8, 10) }] }));

  it("reads today's facts with the current time", () => {
    const { facts: f, moments } = factsFor(snap, new Date(2026, 10, 12, 21, 0));
    expect(f.kept).toBe(true);
    expect(f.minute).toBe(21 * 60);
    expect(moments).toHaveLength(1);
    expect(wordFor(f).situation).toBe("steady");
  });

  it("never shows yesterday as today — a new day starts empty, the run still alive", () => {
    const { facts: f, moments, keptAtMin } = factsFor(snap, new Date(2026, 10, 13, 7, 30));
    expect(moments).toEqual([]);
    expect(keptAtMin).toBeNull();
    expect(f).toMatchObject({ kept: false, keptYesterday: true, streak: 4 });
    expect(wordFor(f).why).toBe("nothing logged yet");
  });

  it("forgets an older snapshot entirely", () => {
    const { facts: f } = factsFor(snap, new Date(2026, 10, 15, 9, 0));
    expect(f).toMatchObject({ kept: false, keptYesterday: false, streak: 0 });
  });
});

describe("the line of light", () => {
  const moments: Moment[] = [
    { min: 8 * 60 + 30, kind: "food" },
    { min: 12 * 60, kind: "water" },
    { min: 18 * 60, kind: "move" },
  ];

  it("is drawable by Android's widget host: no filters, no blur", () => {
    const svg = todayArtSvg({ width: 158, height: 158, moments, keptAtMin: 8 * 60 + 30, nowMin: 19 * 60, period: "evening" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toMatch(/<filter|feGaussianBlur|filter=/);
    expect(svg).not.toMatch(/NaN|Infinity/);
  });

  it("is gold only when the day is kept", () => {
    const kept = todayArtSvg({ width: 320, height: 150, moments, keptAtMin: 510, nowMin: 19 * 60, period: "evening" });
    const open = todayArtSvg({ width: 320, height: 150, moments, keptAtMin: null, nowMin: 19 * 60, period: "evening" });
    expect(kept).toContain('stroke="#FFD873"');
    expect(open).not.toContain('stroke="#FFD873"');
  });

  it("draws a bead for each moment up to now, never a later one", () => {
    const svg = todayArtSvg({ width: 320, height: 150, moments, keptAtMin: 510, nowMin: 13 * 60, period: "afternoon" });
    expect(svg.match(/fill="#FFC83D"/g)).toHaveLength(1);
    expect(svg.match(/fill="#4FC3F7"/g)).toHaveLength(1);
    expect(svg).not.toContain('fill="#F98A26"');
  });

  it("keeps every point inside the widget", () => {
    const svg = todayArtSvg({ width: 158, height: 158, moments, keptAtMin: 510, nowMin: 23 * 60 + 59, period: "night" });
    const xs = [...svg.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(xs.length).toBeGreaterThan(10);
    for (const [x, y] of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(158);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(158);
    }
  });

  it("before 6:00 there is no line yet, only the tip", () => {
    const svg = todayArtSvg({ width: 158, height: 158, moments: [], keptAtMin: null, nowMin: 2 * 60, period: "night" });
    expect(svg).not.toContain("<path");
  });
});
