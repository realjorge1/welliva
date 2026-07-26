import { describe, expect, it, vi } from "vitest";

import type { LifeContextRepository } from "@/health-os";
import type { RecapInput } from "@/services/MonthlyRecapService";
import {
  aggregate,
  buildAnniversaryStory,
  buildDueStories,
  buildYearStory,
  ensureJourneyAnniversary,
  storyNotification,
} from "@/services/StoryService";

function input(): RecapInput {
  return {
    workoutLog: [
      { date: "2025-06-01", completionPercent: 100, durationMinutes: 45 },
      { date: "2025-06-02", completionPercent: 80, durationMinutes: 30 },
    ] as unknown as RecapInput["workoutLog"],
    sessionHistory: [
      { date: "2025-06-01", totalReps: 200 },
    ] as unknown as RecapInput["sessionHistory"],
    dietHistory: [
      { date: "2025-06-01", mealsConsumed: 4, status: "completed" },
    ] as unknown as RecapInput["dietHistory"],
    bodyLogs: [
      { date: "2025-02-01", weightKg: 80 },
      { date: "2026-01-10", weightKg: 78 },
    ] as unknown as RecapInput["bodyLogs"],
    streak: { longestStreak: 5 } as unknown as RecapInput["streak"],
    earnedAchievements: {},
    completedChallenges: {},
    trophies: [],
    proteinTargetG: null,
    waterGoalDates: [],
  };
}

describe("StoryService aggregate (pure)", () => {
  it("aggregates only what falls in the range", () => {
    const s = aggregate(input(), "2025-01-01", "2025-12-31");
    expect(s.workouts).toBe(2);
    expect(s.totalReps).toBe(200);
    // active = two workout days + the Feb weigh-in day
    expect(s.activeDays).toBe(3);
    expect(s.hasActivity).toBe(true);
  });

  it("computes a measured body delta across the window", () => {
    const s = aggregate(input(), "2025-01-01", "2026-12-31");
    expect(s.bodyDeltaKg).toBe(-2);
    expect(s.bodyDirection).toBe("down");
  });
});

describe("horizon builders (deterministic)", () => {
  const NOW = new Date("2026-06-30T09:00:00");

  it("buildYearStory is deterministic for fixed inputs + now", () => {
    const a = buildYearStory(input(), 2025, NOW);
    const b = buildYearStory(input(), 2025, NOW);
    expect(a).toEqual(b);
    expect(a.id).toBe("year:2025");
    expect(a.horizon).toBe("year");
    expect(a.sections.length).toBeGreaterThan(0);
  });

  it("buildAnniversaryStory returns null under a year, an artifact after", () => {
    expect(buildAnniversaryStory(input(), "2026-03-01", NOW)).toBeNull(); // < 1 year
    const s = buildAnniversaryStory(input(), "2025-01-15", NOW);
    expect(s?.id).toBe("anniversary:1");
  });

  it("storyNotification carries a deep link", () => {
    const s = buildYearStory(input(), 2025, NOW);
    const n = storyNotification(s);
    expect(n.route).toBe("/story/year%3A2025");
    expect(n.id).toBe("year:2025");
  });
});

describe("buildDueStories", () => {
  it("offers the documentary once the journey is meaningful", () => {
    const due = buildDueStories(input(), "2025-01-15", new Date("2026-06-30T09:00:00"));
    expect(due.some((s) => s.id === "documentary:journey")).toBe(true);
  });

  it("offers the anniversary story within the post-anniversary window", () => {
    const due = buildDueStories(input(), "2025-01-15", new Date("2026-01-20T09:00:00"));
    expect(due.some((s) => s.id === "anniversary:1")).toBe(true);
  });
});

describe("ensureJourneyAnniversary", () => {
  it("stamps the NEXT anniversary as a forward Life Context entry", async () => {
    const add = vi.fn();
    const fakeLc = { add } as unknown as LifeContextRepository;
    await ensureJourneyAnniversary(fakeLc, "2025-01-15", new Date("2026-06-30T09:00:00"));
    expect(add).toHaveBeenCalledTimes(1);
    const arg = add.mock.calls[0][0] as unknown as {
      id: string;
      kind: string;
      window: { start: string };
    };
    expect(arg.id).toBe("anniversary:2");
    expect(arg.kind).toBe("anniversary");
    expect(arg.window.start).toBe("2027-01-15");
  });

  it("does nothing without a journey start", async () => {
    const add = vi.fn();
    await ensureJourneyAnniversary({ add } as unknown as LifeContextRepository, undefined);
    expect(add).not.toHaveBeenCalled();
  });
});
