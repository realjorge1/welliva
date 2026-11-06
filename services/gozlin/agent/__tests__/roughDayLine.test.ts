/**
 * A rough day in the coach's state block: one line, only on that day, and it
 * says "paused" only when the streak really is.
 */
import { describe, expect, it } from "vitest";
import { twinStateMessage } from "../context";

const TWIN = {
  asOf: "2026-07-26",
  identitySummary: "losing fat",
  flags: [],
  goal: "lose_weight",
  today: {
    calories: { consumed: 1840, target: 2200, pct: 0.84 },
    protein: { consumed: 96, target: 150, pct: 0.64 },
    water: { consumed: 1200, target: 2500, pct: 0.48 },
    workout: { planned: "Upper body", done: false, minutes: 40 },
    dayProgress: 0.5,
  },
  momentum: { streak: 12, adherence7d: 78, trainingLoad7d: 3, trend: "steady" },
  recovery: { score: 66, level: "amber", drivers: [], recommendation: "", basis: "" },
} as never;

const CTX = {
  snapshot: { bio: null } as never,
  identity: { preferences: [], constraints: [], updatedAt: 0 },
};

describe("the rough-day line", () => {
  it("isn't there on a normal day", () => {
    expect(twinStateMessage(TWIN, CTX).content).not.toContain("rough day");
  });

  it("tells the coach to be gentle, with the reason when there is one", () => {
    const text = twinStateMessage(TWIN, { ...CTX, roughDay: { reasonLabel: "Bad news", streakPaused: true } }).content;
    expect(text).toContain("Today they marked a rough day (bad news).");
    expect(text).toContain("Be brief and kind; don't push plans, workouts or targets today.");
    expect(text).toContain("Their daily streak is paused for today, not broken.");
  });

  it("claims no pause past the month's cap, and no reason it wasn't given", () => {
    const text = twinStateMessage(TWIN, { ...CTX, roughDay: { streakPaused: false } }).content;
    expect(text).toContain("Today they marked a rough day.");
    expect(text).not.toContain("paused");
  });
});
