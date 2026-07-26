/**
 * CalendarService — the month model: statuses, padding and counts.
 */

import { describe, expect, it } from "vitest";
import { buildCalendarMonth, shiftMonth } from "@/fitness/services/CalendarService";
import type { GeneratedWorkoutPlan, WorkoutLogEntry } from "@/models/workout";

const PLAN: GeneratedWorkoutPlan = {
  id: "p1",
  createdAt: "2026-07-01T00:00:00Z",
  weekStart: "2026-06-29",
  splitType: "3-Day Full Body",
  inputHash: "h",
  sessions: [
    // Mon / Wed / Fri
    { id: "a", dayLabel: "Day 1 – Full Body", dayOfWeek: 0, focus: "A", warmupMinutes: 5, exercises: [], cooldownMinutes: 5, totalDurationMinutes: 30, isRestDay: false },
    { id: "b", dayLabel: "Day 2 – Full Body", dayOfWeek: 2, focus: "B", warmupMinutes: 5, exercises: [], cooldownMinutes: 5, totalDurationMinutes: 30, isRestDay: false },
    { id: "c", dayLabel: "Day 3 – Full Body", dayOfWeek: 4, focus: "C", warmupMinutes: 5, exercises: [], cooldownMinutes: 5, totalDurationMinutes: 30, isRestDay: false },
  ],
};

function log(date: string): WorkoutLogEntry {
  return {
    id: `l_${date}`,
    date,
    sessionId: "a",
    sessionLabel: "Day 1 – Full Body",
    exercisesCompleted: 5,
    totalExercises: 5,
    completionPercent: 100,
    durationMinutes: 30,
    completedAt: `${date}T18:00:00Z`,
  };
}

describe("buildCalendarMonth", () => {
  const month = buildCalendarMonth({
    year: 2026,
    month: 7,
    today: "2026-07-15", // Wednesday
    plan: PLAN,
    workoutLog: [log("2026-07-01"), log("2026-07-06")],
  });

  const day = (date: string) => {
    for (const week of month.weeks) {
      const hit = week.find((d) => d.date === date);
      if (hit) return hit;
    }
    throw new Error(`day ${date} not found`);
  };

  it("labels the month and pads to full weeks (Monday-first)", () => {
    expect(month.label).toBe("July 2026");
    for (const week of month.weeks) expect(week).toHaveLength(7);
    // 2026-07-01 is a Wednesday → two leading pad cells.
    expect(month.weeks[0][0].inMonth).toBe(false);
    expect(month.weeks[0][2].date).toBe("2026-07-01");
  });

  it("marks logged days completed, even off-plan ones", () => {
    expect(day("2026-07-01").status).toBe("completed"); // Wed, planned + done
    expect(day("2026-07-06").status).toBe("completed"); // Mon, planned + done
  });

  it("marks past planned-but-unlogged days as missed", () => {
    expect(day("2026-07-03").status).toBe("missed"); // Fri before today, no log
    expect(day("2026-07-08").status).toBe("missed"); // Wed before today, no log
  });

  it("marks today's and future plan days as planned, and no-plan days as rest/future", () => {
    expect(day("2026-07-15").isToday).toBe(true);
    expect(day("2026-07-15").status).toBe("planned"); // Wednesday session
    expect(day("2026-07-17").status).toBe("planned"); // future Friday
    expect(day("2026-07-04").status).toBe("rest"); // past Saturday
    expect(day("2026-07-16").status).toBe("future"); // future Thursday
  });

  it("tallies counts", () => {
    expect(month.completedCount).toBe(2);
    expect(month.missedCount).toBeGreaterThan(0);
    expect(month.plannedCount).toBeGreaterThan(0);
  });
});

describe("shiftMonth", () => {
  it("wraps across year boundaries", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 6, 1)).toEqual({ year: 2026, month: 7 });
  });
});
