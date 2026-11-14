import { describe, expect, it } from "vitest";
import {
  FAT_KCAL_PER_KG,
  LOOKBACK_MAX_DAYS,
  scaleJump,
  sinceWords,
  type ScaleDayIntake,
  type ScaleJumpInput,
} from "../body/scaleJump";
import { addDays } from "../cycle/dates";

const TODAY = "2026-11-14"; // a Saturday

function base(over: Partial<ScaleJumpInput> = {}): ScaleJumpInput {
  return {
    weighIns: [
      { date: "2026-11-13", kg: 80 },
      { date: TODAY, kg: 81.2 },
    ],
    intake: { "2026-11-13": { kcal: 2000, carbsG: 200 } },
    maintenanceKcal: 2400,
    workoutDates: [],
    today: TODAY,
    ...over,
  };
}

describe("scaleJump", () => {
  it("says water when the food logged can't explain the rise", () => {
    const j = scaleJump(base());
    expect(j).not.toBeNull();
    expect(j!.upKg).toBe(1.2);
    expect(j!.text).toContain("Up 1.2 kg since yesterday.");
    expect(j!.text).toContain("about 9,200 calories");
    expect(j!.text).toContain("fewer than it burns");
    expect(j!.text).toContain("most of this is water");
    expect(j!.text).toContain("settles within a few days");
  });

  it("does the tilted sum: possible fat counts unlogged food and a slower burn", () => {
    // 1 day: 2000 + 800 − 0.9 × 2400 = 640 kcal → 0.08 → 0.1 kg at most.
    const j = scaleJump(base());
    expect(j!.maxFatKg).toBe(Math.round((640 / FAT_KCAL_PER_KG) * 10) / 10);
  });

  it("names the most fat it could be when they ate over", () => {
    const j = scaleJump(base({ intake: { "2026-11-13": { kcal: 3400, carbsG: 300 } } }));
    expect(j).not.toBeNull();
    expect(j!.text).toContain("about 1,000 more than it burns");
    expect(j!.text).toMatch(/0\.\d kg of fat at most, so the rest is water/);
  });

  it("stays quiet when food could explain half the rise", () => {
    // A week of big surpluses: plenty of room for 0.6 kg of fat.
    const intake: Record<string, ScaleDayIntake> = {};
    for (const d of ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]) {
      intake[d] = { kcal: 3200, carbsG: 300 };
    }
    const j = scaleJump(
      base({
        weighIns: [
          { date: "2026-11-08", kg: 80 },
          { date: TODAY, kg: 80.6 },
        ],
        intake,
      }),
    );
    expect(j).toBeNull();
  });

  it("stays quiet when a day in between has nothing logged (unknown is not zero)", () => {
    const j = scaleJump(
      base({
        weighIns: [
          { date: "2026-11-12", kg: 80 },
          { date: TODAY, kg: 81.2 },
        ],
        intake: { "2026-11-13": { kcal: 1800, carbsG: 150 } },
      }),
    );
    expect(j).toBeNull();
  });

  it("only speaks about today's reading", () => {
    expect(
      scaleJump(
        base({
          weighIns: [
            { date: "2026-11-12", kg: 80 },
            { date: "2026-11-13", kg: 81.2 },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("ignores small moves and old comparisons", () => {
    expect(scaleJump(base({ weighIns: [{ date: "2026-11-13", kg: 80 }, { date: TODAY, kg: 80.4 }] }))).toBeNull();
    const old = "2026-11-06"; // 8 days back
    expect(LOOKBACK_MAX_DAYS).toBe(7);
    expect(scaleJump(base({ weighIns: [{ date: old, kg: 80 }, { date: TODAY, kg: 82 }] }))).toBeNull();
  });

  it("never fires on a drop", () => {
    expect(scaleJump(base({ weighIns: [{ date: "2026-11-13", kg: 81.2 }, { date: TODAY, kg: 80 }] }))).toBeNull();
  });

  it("gives a logged workout as the likely reason", () => {
    const j = scaleJump(base({ workoutDates: ["2026-11-13"] }));
    expect(j!.text).toContain("You trained yesterday, and muscles hold extra water while they recover.");
  });

  it("gives a carb-heavy day as the reason only against their own usual", () => {
    const intake: Record<string, ScaleDayIntake> = {};
    for (let d = 2; d <= 11; d++) intake[addDays(TODAY, -d)] = { kcal: 2000, carbsG: 150 };
    intake["2026-11-13"] = { kcal: 2000, carbsG: 260 };
    const j = scaleJump(base({ intake }));
    expect(j!.text).toContain("Yesterday had more carbs than you usually eat");
  });

  it("never tells anyone to eat less", () => {
    const j = scaleJump(base({ workoutDates: ["2026-11-13"] }));
    expect(j!.text).not.toMatch(/eat less|cut|reduce|fewer calories/i);
  });

  it("names a weekday for an older reading", () => {
    expect(sinceWords("2026-11-10", TODAY)).toBe("Tuesday");
    expect(sinceWords("2026-11-13", TODAY)).toBe("yesterday");
  });
});
