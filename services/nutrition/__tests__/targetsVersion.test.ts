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
import { TARGET_MOVES_KEY, loadMoves } from "../weightRetarget";
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
  await AsyncStorage.removeItem(TARGET_MOVES_KEY);
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

describe("version 3: every notice names its real cause", () => {
  /** An account that last launched on v2, holding the numbers v2 gave it. */
  const onV2 = async (b: UserBio, calories: number, proteinG: number) => {
    await AsyncStorage.setItem(TARGETS_ALGO_KEY, JSON.stringify({ version: 2, calories, proteinG, pending: null }));
    await reconcileTargetsVersion(b, calculateNutritionTargets(b), true);
    return getPendingTargetsNotice();
  };

  it("the ceiling: says the cap was removed, with both numbers, and never blames age", async () => {
    const athlete = bio({ age: 22, weightKg: 95, heightCm: 190, activityLevel: "very_active", primaryGoal: "athletic_performance" });
    const notice = await onV2(athlete, 3200, 152);
    expect(notice).not.toBeNull();
    expect(notice!.message).toMatch(/removed the cap/);
    expect(notice!.message).toContain("3,200");
    expect(notice!.message).toContain(calculateNutritionTargets(athlete).calories.toLocaleString());
    expect(notice!.message).not.toMatch(/age/);
  });

  it("protein in a deficit: says why it rose", async () => {
    const loser = bio({ age: 30, sex: "female", weightKg: 60, heightCm: 165, activityLevel: "light", primaryGoal: "lose_weight" });
    const notice = await onV2(loser, 1315, 72);
    expect(notice!.message).toMatch(/higher while you're losing weight, which protects muscle/);
    expect(notice!.message).toContain("72 g to 96 g");
    // Her calories didn't move (no pace chosen: the −500 is kept), so no calorie line.
    expect(notice!.message).not.toMatch(/daily target moved/);
    expect(notice!.message).not.toMatch(/age/);
  });

  it("fibre is mentioned only when it moved by 5 g or more", async () => {
    const loser = bio({ age: 30, sex: "female", weightKg: 60, heightCm: 165, activityLevel: "light", primaryGoal: "lose_weight" });
    const notice = await onV2(loser, 1315, 72);
    expect(notice!.message).toMatch(/fibre goal now follows how much you eat/);
    expect(notice!.message).toContain("25 g to 20 g");

    await AsyncStorage.removeItem(TARGETS_ALGO_KEY);
    const maintainer = bio({ age: 30, weightKg: 80, heightCm: 180 }); // 38 → 39 g
    expect(await onV2(maintainer, 2759, 96)).toBeNull();
  });

  it("under 18: says no cut is set, calmly", async () => {
    const teen = bio({ age: 17, sex: "female", weightKg: 60, heightCm: 165, activityLevel: "light", primaryGoal: "lose_weight" });
    const notice = await onV2(teen, 1405, 72);
    expect(notice!.message).toMatch(/under 18 I don't set a calorie cut/);
    expect(notice!.message).toContain("1,405 to 1,905 kcal");
    expect(notice!.message).not.toMatch(/underweight|eating disorder/i);
  });

  it("underweight: says no cut is set, without a diagnosis", async () => {
    const light = bio({ age: 26, sex: "female", weightKg: 47, heightCm: 165, activityLevel: "light", primaryGoal: "lose_weight" });
    const notice = await onV2(light, 1200, 56);
    expect(notice!.message).toMatch(/no longer set a calorie cut at your current weight for your height/);
    expect(notice!.message).not.toMatch(/underweight|too thin|eating disorder/i);
  });

  it("names both causes for an account that skipped v2 entirely", async () => {
    // No stored record = a v1 account. Age (v1→v2) AND the ceiling (v2→v3):
    // v1 = 2,993 × 0.95 + 300 = 3,143; v2 = capped 3,200; v3 = 3,293.
    // (Someone capped under BOTH old versions gets no age line — the age fix
    // never moved their number, and the notice says only what happened.)
    const big = bio({ age: 45, weightKg: 83, heightCm: 180, activityLevel: "active", primaryGoal: "build_muscle" });
    await reconcileTargetsVersion(big, calculateNutritionTargets(big), true);
    const notice = await getPendingTargetsNotice();
    expect(notice!.message).toMatch(/account for your age/);
    expect(notice!.message).toMatch(/removed the cap/);
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

/**
 * The notice is erased the moment she taps "Got it". Without a durable record,
 * the Word export's "Why your numbers changed" answered "your daily numbers
 * haven't moved by themselves" on the very day they moved most.
 */
describe("the correction outlives its own notice", () => {
  it("keeps the correction as a move, with the same sentence", async () => {
    const b = bio({ age: 65 });
    const targets = calculateNutritionTargets(b);
    await reconcileTargetsVersion(b, targets, true);

    const notice = await getPendingTargetsNotice();
    const moves = await loadMoves();
    expect(moves).toHaveLength(1);
    expect(moves[0].kind).toBe("correction");
    expect(moves[0].message).toBe(notice!.message);
    expect(moves[0].to.calories).toBe(targets.calories);
    expect(moves[0].from.calories).toBe(notice!.previous.calories);
  });

  it("still has it after she taps Got it", async () => {
    const b = bio({ age: 65 });
    await reconcileTargetsVersion(b, calculateNutritionTargets(b), true);
    await dismissTargetsNotice();

    expect(await getPendingTargetsNotice()).toBeNull();
    const moves = await loadMoves();
    expect(moves).toHaveLength(1);
    expect(moves[0].message).toContain("age");
  });

  it("stores it seen, so the move card never repeats the correction card", async () => {
    const b = bio({ age: 65 });
    await reconcileTargetsVersion(b, calculateNutritionTargets(b), true);
    const moves = await loadMoves();
    expect(moves[0].seen).toBe(true);
  });

  it("records nothing for a user onboarding right now", async () => {
    const b = bio({ age: 65 });
    await reconcileTargetsVersion(b, calculateNutritionTargets(b), /* hasHistory */ false);
    expect(await loadMoves()).toEqual([]);
  });

  it("records nothing when the algorithm left her numbers alone", async () => {
    const b = bio({ age: 40 });
    const targets = calculateNutritionTargets(b);
    await AsyncStorage.setItem(
      TARGETS_ALGO_KEY,
      JSON.stringify({
        version: TARGETS_ALGO_VERSION - 1,
        calories: targets.calories,
        proteinG: targets.proteinG,
        fiberG: targets.fiberG,
        pending: null,
      }),
    );
    await reconcileTargetsVersion(b, targets, true);

    expect(await getPendingTargetsNotice()).toBeNull();
    expect(await loadMoves()).toEqual([]);
  });

  it("does not stack a second move on the next launch", async () => {
    const b = bio({ age: 65 });
    const targets = calculateNutritionTargets(b);
    await reconcileTargetsVersion(b, targets, true);
    await reconcileTargetsVersion(b, targets, true);
    expect(await loadMoves()).toHaveLength(1);
  });
});
