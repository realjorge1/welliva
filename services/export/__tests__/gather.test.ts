/**
 * THE SEAM — what `recordMove` writes must survive the trip to the page.
 *
 * myData.test.ts proves the page prints a move it is handed; targetsVersion
 * .test.ts proves a correction is recorded. This covers the join between them,
 * which is the part no unit test touched and the part that was broken: the
 * correction reached storage and still never reached the document.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { calculateNutritionTargets } from "../../NutritionService";
import { TARGETS_ALGO_KEY, reconcileTargetsVersion } from "../../nutrition/TargetsVersion";
import { TARGET_MOVES_KEY } from "../../nutrition/weightRetarget";
import { gatherStoredData } from "../gather";
import { buildMyDataBlocks, type MyDataInput } from "../myData";
import type { UserBio } from "../../../models/user";

const bio = {
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
} as UserBio;

beforeEach(async () => {
  await AsyncStorage.removeItem(TARGETS_ALGO_KEY);
  await AsyncStorage.removeItem(TARGET_MOVES_KEY);
});

/** Everything the page needs that does not come out of storage. */
const page = (stored: Awaited<ReturnType<typeof gatherStoredData>>): MyDataInput => ({
  exportedAt: new Date("2026-11-20T21:00:00.000Z"),
  bio: null,
  goals: null,
  bodyLogs: [],
  dietHistory: [],
  workouts: [],
  habits: [],
  cycle: { status: "off" },
  ...stored,
});

describe("a correction reaches the document", () => {
  it("survives storage, the gather, and the dismissal", async () => {
    // She launches on the new algorithm: the correction is staged and recorded.
    await reconcileTargetsVersion(bio, calculateNutritionTargets(bio), /* hasHistory */ true);
    // …and she taps "Got it", which erases the notice.
    const raw = JSON.parse((await AsyncStorage.getItem(TARGETS_ALGO_KEY))!);
    await AsyncStorage.setItem(TARGETS_ALGO_KEY, JSON.stringify({ ...raw, pending: null }));

    const stored = await gatherStoredData();
    expect(stored.targets.moves).toHaveLength(1);

    const blocks = buildMyDataBlocks(page(stored));
    const start = blocks.findIndex(
      (b) => b.kind === "heading" && b.text === "Why your numbers changed",
    );
    const table = blocks.slice(start + 1).find((b) => b.kind === "table");

    expect(table).toBeDefined();
    // The sentence she saw on the card, months later, in her own copy.
    expect(table!.kind === "table" && table!.rows[0][1]).toContain("age");
    expect(table!.kind === "table" && table!.rows[0][1]).toBe(stored.targets.moves[0].message);
  });

  it("says nothing moved when the algorithm left her alone", async () => {
    await AsyncStorage.setItem(TARGET_MOVES_KEY, JSON.stringify([]));

    const blocks = buildMyDataBlocks(page(await gatherStoredData()));
    const start = blocks.findIndex(
      (b) => b.kind === "heading" && b.text === "Why your numbers changed",
    );
    expect(blocks[start + 1]).toEqual({
      kind: "paragraph",
      text: "Your daily numbers haven't moved by themselves.",
    });
  });
});
