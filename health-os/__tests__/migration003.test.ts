/**
 * Migration 003 — activity scale remap.
 *
 * The property that matters: extending the scale from four tiers to five must
 * not move any existing user's calorie target. `very_active` used to mean 1.725
 * and now means 1.9, so the stored value has to be rewritten to `active` (the
 * new home of 1.725) for the number to stay put.
 */
import { describe, expect, it } from "vitest";

import { migration003 } from "../platform/migrations/003-activity-level-scale";
import { runMigrations } from "../platform/migrations/runner";
import { K, LEGACY } from "../platform/storage/keys";
import { ACTIVITY_MULTIPLIERS } from "../../models/user";
import type { ActivityLevel } from "../../models/user";
import { MemoryStore } from "./helpers/MemoryStore";

const bioWith = (activityLevel: string) => ({
  age: 31,
  sex: "male",
  heightCm: 180,
  weightKg: 82,
  activityLevel,
});

describe("migration 003 — activity level scale", () => {
  it("rewrites very_active → active so the multiplier does not change", async () => {
    const store = new MemoryStore();
    await store.set(LEGACY.USER_BIO, bioWith("very_active"));

    // What the user's multiplier was BEFORE the scale gained its fifth tier.
    const multiplierBefore = 1.725;

    await runMigrations(store, [migration003]);

    const after = await store.get<{ activityLevel: string }>(LEGACY.USER_BIO, {
      activityLevel: "",
    });
    expect(after.activityLevel).toBe("active");
    expect(ACTIVITY_MULTIPLIERS[after.activityLevel as ActivityLevel]).toBe(
      multiplierBefore,
    );
  });

  it("preserves every other field on the bio", async () => {
    const store = new MemoryStore();
    await store.set(LEGACY.USER_BIO, bioWith("very_active"));

    await runMigrations(store, [migration003]);

    const after = await store.get<Record<string, unknown>>(LEGACY.USER_BIO, {});
    expect(after).toMatchObject({
      age: 31,
      sex: "male",
      heightCm: 180,
      weightKg: 82,
    });
  });

  it("leaves the other four tiers untouched", async () => {
    for (const level of ["sedentary", "light", "moderate", "active"]) {
      const store = new MemoryStore();
      await store.set(LEGACY.USER_BIO, bioWith(level));

      await runMigrations(store, [migration003]);

      const after = await store.get<{ activityLevel: string }>(LEGACY.USER_BIO, {
        activityLevel: "",
      });
      expect(after.activityLevel).toBe(level);
    }
  });

  it("is idempotent — a second run does not re-map active → anything", async () => {
    const store = new MemoryStore();
    await store.set(LEGACY.USER_BIO, bioWith("very_active"));

    await runMigrations(store, [migration003]);
    // Force a re-run by rewinding the version gate.
    await store.set(K.SCHEMA_VERSION, 2);
    await runMigrations(store, [migration003]);

    const after = await store.get<{ activityLevel: string }>(LEGACY.USER_BIO, {
      activityLevel: "",
    });
    expect(after.activityLevel).toBe("active");
  });

  it("is a no-op on a fresh install with no bio, and still advances", async () => {
    const store = new MemoryStore();

    const applied = await runMigrations(store, [migration003]);

    expect(applied).toBe(3);
    expect(await store.get(LEGACY.USER_BIO, null)).toBeNull();
  });

  it("covers all five tiers with the standard Mifflin-St Jeor multipliers", () => {
    expect(ACTIVITY_MULTIPLIERS).toEqual({
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    });
  });
});
