/**
 * TARGETS VERSION — the honest-correction path.
 *
 * The notice is the whole point of the version bump: silently recalculating an
 * installed base's calorie targets is a worse failure than the bug it fixes. So
 * these tests care about WHO sees the notice, and that it says true things.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { calculateNutritionTargets } from "../../NutritionService";
import {
  TARGETS_ALGO_KEY,
  TARGETS_ALGO_VERSION,
  dismissTargetsNotice,
  getPendingTargetsNotice,
  reconcileTargetsVersion,
} from "../TargetsVersion";
import type { UserBio } from "../../../models/user";

const bio = (overrides: Partial<UserBio> = {}): UserBio =>
  ({
    age: 65,
    sex: "male",
    heightCm: 180,
    weightKg: 80,
    activityLevel: "moderate",
    exerciseLevel: "intermediate",
    primaryGoal: "better_health",
    dietaryRestriction: "none",
    allergies: [],
    medicalConditions: [],
    mealsPerDay: 3,
    ...overrides,
  }) as UserBio;

beforeEach(async () => {
  await AsyncStorage.removeItem(TARGETS_ALGO_KEY);
});

describe("who sees the correction notice", () => {
  it("stages one for an existing user whose numbers moved", async () => {
    const b = bio({ age: 65 }); // the 61+ bracket — the worst of the double count
    const targets = calculateNutritionTargets(b);
    await reconcileTargetsVersion(b, targets, /* hasHistory */ true);

    const notice = await getPendingTargetsNotice();
    expect(notice).not.toBeNull();
    expect(notice!.toVersion).toBe(TARGETS_ALGO_VERSION);
    expect(notice!.current.calories).toBe(targets.calories);
    // The old algorithm's 0.85 multiplier really did under-feed this user.
    expect(notice!.previous.calories).toBeLessThan(notice!.current.calories);
    expect(notice!.message).toContain("age");
    expect(notice!.message).toContain(notice!.previous.calories.toLocaleString());
    expect(notice!.message).toContain(notice!.current.calories.toLocaleString());
  });

  it("never shows one to a user who is onboarding right now", async () => {
    const b = bio({ age: 65 });
    await reconcileTargetsVersion(b, calculateNutritionTargets(b), /* hasHistory */ false);
    expect(await getPendingTargetsNotice()).toBeNull();
  });

  it("says nothing when the correction didn't move that user's numbers", async () => {
    // 18–30 had a 1.0 age factor and a normal BMI keeps actual-weight protein,
    // so nothing changed for them — and an unnecessary notice is just noise.
    const b = bio({ age: 26, weightKg: 72, heightCm: 178 });
    await reconcileTargetsVersion(b, calculateNutritionTargets(b), true);
    expect(await getPendingTargetsNotice()).toBeNull();
  });

  it("explains a protein drop for a high-BMI user", async () => {
    const b = bio({ age: 26, weightKg: 130, heightCm: 170 });
    const targets = calculateNutritionTargets(b);
    await reconcileTargetsVersion(b, targets, true);

    const notice = await getPendingTargetsNotice();
    expect(notice).not.toBeNull();
    expect(notice!.current.proteinG).toBeLessThan(notice!.previous.proteinG);
    expect(notice!.message).toMatch(/adjusted body weight/i);
  });
});

describe("the notice is shown once", () => {
  it("clears on dismissal and never returns", async () => {
    const b = bio({ age: 65 });
    await reconcileTargetsVersion(b, calculateNutritionTargets(b), true);
    expect(await getPendingTargetsNotice()).not.toBeNull();

    await dismissTargetsNotice();
    expect(await getPendingTargetsNotice()).toBeNull();

    // A later launch on the same (current) version must not resurrect it.
    await reconcileTargetsVersion(b, calculateNutritionTargets(b), true);
    expect(await getPendingTargetsNotice()).toBeNull();
  });

  it("is idempotent across repeated launches before dismissal", async () => {
    const b = bio({ age: 65 });
    const targets = calculateNutritionTargets(b);
    await reconcileTargetsVersion(b, targets, true);
    const first = await getPendingTargetsNotice();
    await reconcileTargetsVersion(b, targets, true);
    const second = await getPendingTargetsNotice();
    expect(second).toEqual(first);
  });
});

describe("storage record", () => {
  it("records the current version and numbers for the NEXT bump", async () => {
    const b = bio({ age: 40 });
    const targets = calculateNutritionTargets(b);
    await reconcileTargetsVersion(b, targets, true);

    const raw = await AsyncStorage.getItem(TARGETS_ALGO_KEY);
    const stored = JSON.parse(raw!) as { version: number; calories: number };
    expect(stored.version).toBe(TARGETS_ALGO_VERSION);
    // v3 will compare against THIS, so it must be the post-fix number.
    expect(stored.calories).toBe(targets.calories);
  });
});
