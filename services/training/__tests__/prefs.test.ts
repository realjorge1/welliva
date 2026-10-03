/**
 * One set of training days. The plan, the reminders and the weekly target all
 * read `resolveTrainingPrefs`, so the days a user picked are the days, and a
 * user who never picked gets the profile's count spaced for recovery.
 */
import { describe, expect, it } from "vitest";

import { createDefaultProfile } from "../../../fitness/services/FitnessProfileStore";
import type { UserBio } from "../../../models/user";
import { normalizeDays, resolveTrainingPrefs, spacedDays } from "../prefs";

const bio = { primaryGoal: "build_muscle", workoutDaysPerWeek: 4 } as UserBio;

describe("resolveTrainingPrefs", () => {
  it("uses the days the user picked", () => {
    const p = resolveTrainingPrefs(bio, { ...createDefaultProfile(), daysSource: "you", daysAvailable: [5, 1, 3, 3] });
    expect(p.days).toEqual([1, 3, 5]);
    expect(p.daysSource).toBe("you");
  });

  it("keeps days the app derived marked as derived, so the plan never says they were picked", () => {
    const p = resolveTrainingPrefs(bio, { ...createDefaultProfile(), daysSource: "derived", daysAvailable: [0, 1, 3, 4] });
    expect(p.days).toEqual([0, 1, 3, 4]);
    expect(p.daysSource).toBe("derived");
  });

  it("ignores the store's placeholder days until the user has picked", () => {
    const p = resolveTrainingPrefs(bio, createDefaultProfile());
    expect(p.days).toEqual(spacedDays(4));
    expect(p.daysSource).toBe("derived");
  });

  it("treats a finished setup as picked days", () => {
    const p = resolveTrainingPrefs(bio, { ...createDefaultProfile(), setupComplete: true, daysAvailable: [6] });
    expect(p.days).toEqual([6]);
  });

  it("only counts session length the user actually chose", () => {
    expect(resolveTrainingPrefs(bio, createDefaultProfile()).sessionMinutes).toBeNull();
    expect(
      resolveTrainingPrefs(bio, { ...createDefaultProfile(), setupComplete: true, typicalDurationMin: 25 }).sessionMinutes,
    ).toBe(25);
  });

  it("drops picks on days that are no longer training days", () => {
    const p = resolveTrainingPrefs(bio, {
      ...createDefaultProfile(),
      daysSource: "you",
      daysAvailable: [0, 2],
      planMode: "chosen",
      chosenWorkouts: [
        { day: 0, workoutId: "morning-ignition" },
        { day: 4, workoutId: "sweat-twelve" },
      ],
    });
    expect(p.chosen).toEqual([{ day: 0, workoutId: "morning-ignition" }]);
    expect(p.mode).toBe("chosen");
  });

  it("falls back to the goal's default count with no bio count", () => {
    expect(resolveTrainingPrefs({ primaryGoal: "athletic_performance" } as UserBio, null).days).toEqual(spacedDays(5));
  });
});

describe("day helpers", () => {
  it("spaces sessions for recovery and clamps the count", () => {
    expect(spacedDays(3)).toEqual([0, 2, 4]);
    expect(spacedDays(0)).toEqual([2]);
    expect(spacedDays(12)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("normalizes stored days", () => {
    expect(normalizeDays([3, 3, 9, -1, 1.5, "2", 0])).toEqual([0, 3]);
    expect(normalizeDays(undefined)).toEqual([]);
  });
});
