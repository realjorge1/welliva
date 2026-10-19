import { describe, expect, it } from "vitest";
import { pickHomeFact, type HomeFactInput } from "../homeFact";

const NOW = Date.parse("2026-10-17T15:00:00Z");

const base: HomeFactInput = {
  hour: 15,
  today: "2026-10-17",
  yesterday: "2026-10-16",
  streak: 0,
  keptToday: false,
  atRisk: false,
  totalDays: 0,
  yesterdayIntake: null,
  targets: { calories: 2000, proteinG: 100 },
  workouts: [],
  nowMs: NOW,
  waterMl: 0,
  waterGoalMl: 2500,
  weighIns: [],
};

const pick = (o: Partial<HomeFactInput>) => pickHomeFact({ ...base, ...o });

describe("pickHomeFact", () => {
  it("states something true on an empty account", () => {
    expect(pick({}).key).toBe("fresh-day");
  });

  it("never reports yesterday for a day nothing was logged", () => {
    expect(pick({ yesterdayIntake: null }).key).toBe("fresh-day");
    expect(pick({ yesterdayIntake: { calories: 0, proteinG: 0 } }).key).toBe("fresh-day");
  });

  it("reports a session finished inside 24h, not one outside it", () => {
    const hit = pick({ workouts: [{ completedAt: "2026-10-17T09:00:00Z", durationMinutes: 42 }] });
    expect(hit.text).toBe("TRAINED 42 MIN");
    const old = pick({ workouts: [{ completedAt: "2026-10-15T09:00:00Z", durationMinutes: 42 }] });
    expect(old.key).toBe("fresh-day");
  });

  it("names the protein hit and calls on-target calories", () => {
    const f = pick({ yesterdayIntake: { calories: 2300, proteinG: 112 } });
    expect(f.text).toBe("PROTEIN 112% YESTERDAY");
    expect(pick({ yesterdayIntake: { calories: 2010, proteinG: 60 } }).key).toBe("kcal-on-target");
  });

  it("puts an open streak first late in the day, and a milestone above it", () => {
    expect(pick({ streak: 12, atRisk: true, hour: 20 }).key).toBe("streak-risk");
    expect(pick({ streak: 12, atRisk: true, hour: 10 }).key).toBe("streak");
    expect(pick({ streak: 7, keptToday: true, totalDays: 9 }).key).toBe("streak-milestone");
  });

  it("reports a fresh weigh-in delta, signed", () => {
    const f = pick({
      weighIns: [
        { date: "2026-10-09", weightKg: 80.4 },
        { date: "2026-10-17", weightKg: 80.0 },
      ],
    });
    expect(f.text).toBe("-0.4 KG SINCE OCT 9");
  });
});
