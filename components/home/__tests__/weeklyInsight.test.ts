/**
 * The weekly insight is a claim about the user, shown unprompted on Home. Two
 * properties matter more than anything else it does:
 *
 *   1. It must be STABLE inside a week. If it changes between two opens on the
 *      same day, "this week Gozlin noticed" is visibly a lie and the whole card
 *      reads as randomised filler.
 *   2. It must be SILENT when the engine has nothing. A card that invents
 *      encouragement for a three-day-old account is how a user learns the
 *      insights are generic — which devalues the tier they're sold to sell.
 */
import { describe, expect, it } from "vitest";

import type { GozlinHabitReport, HabitPattern } from "@/services/gozlin";
import { pickWeeklyInsight } from "../weeklyInsight";

function pattern(id: string): HabitPattern {
  return {
    kind: "anchor",
    message: `pattern ${id}`,
    confidence: 0.9,
    icon: "sparkles",
  } as unknown as HabitPattern;
}

function report(patterns: HabitPattern[], dataLimited = false): GozlinHabitReport {
  return {
    __kind: "habit",
    headline: "",
    overallScore: 70,
    scoreLabel: "Strong",
    behaviorScores: [],
    patterns,
    risks: [],
    rescues: [],
    dataLimited,
    tone: "warm",
  } as unknown as GozlinHabitReport;
}

describe("pickWeeklyInsight", () => {
  it("returns nothing when the engine has no patterns", () => {
    expect(pickWeeklyInsight(report([]), "2026-08-19")).toBeNull();
  });

  it("stays silent when the engine says it is reading too little", () => {
    // Even with patterns present: dataLimited is the engine's own hedge and the
    // card must not launder it into a confident sentence.
    expect(pickWeeklyInsight(report([pattern("a")], true), "2026-08-19")).toBeNull();
  });

  it("picks the same finding for every day of one week", () => {
    const r = report([pattern("a"), pattern("b"), pattern("c")]);
    // 2026-08-17 is a Monday; through Sunday the 23rd.
    const week = [
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
    ];
    const picked = week.map((d) => pickWeeklyInsight(r, d)!.pattern.message);
    expect(new Set(picked).size).toBe(1);
    expect(week.map((d) => pickWeeklyInsight(r, d)!.weekStart)).toEqual(week.map(() => "2026-08-17"));
  });

  it("moves on the following Monday", () => {
    const r = report([pattern("a"), pattern("b"), pattern("c")]);
    const thisWeek = pickWeeklyInsight(r, "2026-08-19")!;
    const nextWeek = pickWeeklyInsight(r, "2026-08-26")!;
    expect(nextWeek.weekStart).not.toBe(thisWeek.weekStart);
    expect(nextWeek.pattern.message).not.toBe(thisWeek.pattern.message);
  });

  it("rotates through every finding in turn, then repeats", () => {
    const r = report([pattern("a"), pattern("b"), pattern("c")]);
    const seen: string[] = [];
    for (let w = 0; w < 6; w++) {
      const day = new Date(2026, 7, 17 + w * 7); // Mondays from 2026-08-17
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(
        day.getDate(),
      ).padStart(2, "0")}`;
      seen.push(pickWeeklyInsight(r, iso)!.pattern.message);
    }
    expect(new Set(seen.slice(0, 3)).size).toBe(3); // all three, no repeats
    expect(seen.slice(0, 3)).toEqual(seen.slice(3, 6)); // then the cycle repeats
  });

  it("never rotates through more than the first five findings", () => {
    const r = report(Array.from({ length: 9 }, (_, i) => pattern(String(i))));
    expect(pickWeeklyInsight(r, "2026-08-19")!.total).toBe(5);
  });

  it("handles a single finding without dividing by zero", () => {
    const r = report([pattern("only")]);
    const got = pickWeeklyInsight(r, "2026-08-19")!;
    expect(got.index).toBe(0);
    expect(got.total).toBe(1);
  });
});
