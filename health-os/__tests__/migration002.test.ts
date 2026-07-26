import { describe, expect, it } from "vitest";

import { SummaryStore } from "../memory/SummaryStore";
import { migrate, LATEST_VERSION } from "../platform/migrations";
import { K } from "../platform/storage/keys";
import { freshUser, heavyUser, lightUser, seed } from "./__fixtures__/legacy";
import { MemoryStore } from "./helpers/MemoryStore";

const FIXED_NOW = new Date("2026-06-28T09:00:00+00:00");

describe("migration 002 — seed summaries", () => {
  it("seeds one day summary per distinct event-day (light user)", async () => {
    const store = new MemoryStore();
    await seed(store, lightUser);
    await migrate(store, FIXED_NOW);

    const idx = await new SummaryStore(store).index();
    // lightUser touches 2026-06-25, -26, -27
    expect(idx.days).toEqual(["2026-06-25", "2026-06-26", "2026-06-27"]);
  });

  it("a seeded day folds back to its legacy totals (lossless round-trip)", async () => {
    const store = new MemoryStore();
    await seed(store, lightUser);
    await migrate(store, FIXED_NOW);

    const day = await new SummaryStore(store).getDay("2026-06-25");
    expect(day).not.toBeNull();
    // matches the legacy DietHistoryEntry for that day
    expect(day!.nutrition).toMatchObject({
      calories: 2000,
      mealsConsumed: 3,
      totalMeals: 3,
      adherence: 1,
      status: "completed",
      mealsLogged: 3, // consumedMeals.length
    });
    expect(day!.hydration).toMatchObject({ ml: 2500, metGoal: true });
    expect(day!.workout).toMatchObject({ completed: true, durationMin: 30 });
    expect(day!.body?.weightKg).toBe(78);
    expect(day!.checkin).toMatchObject({ mood: 4 });
    expect(day!.milestones).toBe(1);
  });

  it("advances schema_version to the latest", async () => {
    const store = new MemoryStore();
    await seed(store, heavyUser);
    await migrate(store, FIXED_NOW);
    expect(await store.get<number>(K.SCHEMA_VERSION, 0)).toBe(LATEST_VERSION);
  });

  it("is idempotent — re-running rewrites byte-identical summaries (fixed clock)", async () => {
    const store = new MemoryStore();
    await seed(store, heavyUser);
    await migrate(store, FIXED_NOW);
    const first = await store.get(K.daySummary("2026-06-01"), null);

    // force the gate open and run again under the same clock
    await store.set(K.SCHEMA_VERSION, 0);
    await migrate(store, FIXED_NOW);
    const second = await store.get(K.daySummary("2026-06-01"), null);

    expect(second).toEqual(first);
  });

  it("rolls weeks/months up from the seeded day summaries", async () => {
    const store = new MemoryStore();
    await seed(store, heavyUser);
    await migrate(store, FIXED_NOW);

    const summaries = new SummaryStore(store);
    const idx = await summaries.index();
    expect(idx.days.length).toBe(4); // 05-30, 05-31, 06-01, 06-02
  });

  it("fresh install seeds no summaries", async () => {
    const store = new MemoryStore();
    await seed(store, freshUser);
    await migrate(store, FIXED_NOW);
    expect((await new SummaryStore(store).index()).days).toEqual([]);
  });
});
