/**
 * FitnessProfileStore — persistence round-trip, hydration of new fields,
 * favorites, recommendation memory and the data-safety surface.
 */

import { beforeEach, describe, expect, it } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FITNESS_PROFILE_KEY,
  buildFitnessExport,
  clearFitnessProfile,
  createDefaultProfile,
  loadFitnessProfile,
  rememberRecommendation,
  resetRecommendationMemory,
  saveFitnessProfile,
  subscribeFitnessProfile,
  toggleFavorite,
  updateFitnessProfile,
} from "@/fitness/services/FitnessProfileStore";

beforeEach(async () => {
  await AsyncStorage.removeItem(FITNESS_PROFILE_KEY);
});

describe("persistence", () => {
  it("returns defaults when nothing is stored", async () => {
    const p = await loadFitnessProfile();
    expect(p.setupComplete).toBe(false);
    expect(p.musicEnabled).toBe(true);
    expect(p.daysAvailable).toEqual([0, 2, 4]);
  });

  it("round-trips a saved profile", async () => {
    const p = createDefaultProfile();
    p.goals = ["get_stronger"];
    p.typicalDurationMin = 30;
    await saveFitnessProfile(p);
    const loaded = await loadFitnessProfile();
    expect(loaded.goals).toEqual(["get_stronger"]);
    expect(loaded.typicalDurationMin).toBe(30);
  });

  it("hydrates missing fields from defaults (forward-compat)", async () => {
    await AsyncStorage.setItem(
      FITNESS_PROFILE_KEY,
      JSON.stringify({ goals: ["lose_fat"] }),
    );
    const p = await loadFitnessProfile();
    expect(p.goals).toEqual(["lose_fat"]);
    expect(p.reminders.hour).toBe(17); // default filled in
    expect(p.musicVolume).toBe(0.8);
  });

  it("survives corrupted storage", async () => {
    await AsyncStorage.setItem(FITNESS_PROFILE_KEY, "not-json{");
    const p = await loadFitnessProfile();
    expect(p.setupComplete).toBe(false);
  });

  it("patch-updates deep reminder prefs without losing siblings", async () => {
    await updateFitnessProfile({ reminders: { hydration: true } });
    const p = await loadFitnessProfile();
    expect(p.reminders.hydration).toBe(true);
    expect(p.reminders.hour).toBe(17);
  });

  it("notifies subscribers on save", async () => {
    let seen = 0;
    const unsub = subscribeFitnessProfile(() => {
      seen += 1;
    });
    await saveFitnessProfile(createDefaultProfile());
    unsub();
    await saveFitnessProfile(createDefaultProfile());
    expect(seen).toBe(1);
  });
});

describe("favorites & recommendation memory", () => {
  it("toggles favorites on and off", () => {
    let p = createDefaultProfile();
    p = toggleFavorite(p, "sweat-twelve");
    expect(p.favorites).toContain("sweat-twelve");
    p = toggleFavorite(p, "sweat-twelve");
    expect(p.favorites).not.toContain("sweat-twelve");
  });

  it("records recommendation outcomes idempotently and caps history", () => {
    let p = createDefaultProfile();
    p = rememberRecommendation(p, { date: "2026-07-01", workoutId: "a", completed: false });
    p = rememberRecommendation(p, { date: "2026-07-01", workoutId: "a", completed: true });
    expect(p.recommendationHistory).toHaveLength(1);
    expect(p.recommendationHistory[0].completed).toBe(true);

    for (let i = 1; i <= 30; i++) {
      p = rememberRecommendation(p, {
        date: `2026-08-${String(i).padStart(2, "0")}`,
        workoutId: "b",
        completed: false,
      });
    }
    expect(p.recommendationHistory.length).toBeLessThanOrEqual(21);
  });
});

describe("data safety", () => {
  it("reset recommendations clears only the adaptation memory", async () => {
    let p = createDefaultProfile();
    p.favorites = ["morning-ignition"];
    p = rememberRecommendation(p, { date: "2026-07-01", workoutId: "a", completed: false });
    await saveFitnessProfile(p);

    await resetRecommendationMemory();
    const after = await loadFitnessProfile();
    expect(after.recommendationHistory).toEqual([]);
    expect(after.favorites).toEqual(["morning-ignition"]);
  });

  it("clearFitnessProfile returns the module to first-run defaults", async () => {
    const p = createDefaultProfile();
    p.setupComplete = true;
    await saveFitnessProfile(p);
    await clearFitnessProfile();
    const after = await loadFitnessProfile();
    expect(after.setupComplete).toBe(false);
  });

  it("builds a portable JSON export", () => {
    const json = buildFitnessExport({
      profile: createDefaultProfile(),
      workoutLog: [{ id: "1" }],
      sessionHistory: [],
    });
    const parsed = JSON.parse(json);
    expect(parsed.kind).toBe("fitness-data-export");
    expect(parsed.workoutLog).toHaveLength(1);
    expect(parsed.profile.version).toBe(1);
  });
});
