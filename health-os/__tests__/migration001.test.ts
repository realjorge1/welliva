import { describe, expect, it } from "vitest";

import { migrate, LATEST_VERSION } from "../platform/migrations";
import { K, LEGACY } from "../platform/storage/keys";
import type { KeyValueStore } from "../platform/storage/KeyValueStore";
import { TimelineRepository } from "../timeline/TimelineRepository";
import {
  edgeExpected,
  edgeUser,
  freshExpected,
  freshUser,
  heavyExpected,
  heavyUser,
  lightExpected,
  lightUser,
  seed,
  type ExpectedCounts,
  type LegacyFixture,
} from "./__fixtures__/legacy";
import { MemoryStore } from "./helpers/MemoryStore";

async function summarize(store: KeyValueStore) {
  const repo = new TimelineRepository(store);
  const all = await repo.query({ includeRedacted: true });
  const byType: Record<string, number> = {};
  for (const e of all) byType[e.type] = (byType[e.type] ?? 0) + 1;
  const index = await repo.index();
  return { total: all.length, byType, partitions: Object.keys(index.partitions).length, index };
}

const cases: { name: string; fixture: LegacyFixture; expected: ExpectedCounts }[] = [
  { name: "light user", fixture: lightUser, expected: lightExpected },
  { name: "heavy user (two months)", fixture: heavyUser, expected: heavyExpected },
  { name: "edge user (missing/invalid records)", fixture: edgeUser, expected: edgeExpected },
  { name: "fresh install", fixture: freshUser, expected: freshExpected },
];

describe("migration 001 — backfill timeline", () => {
  for (const { name, fixture, expected } of cases) {
    describe(name, () => {
      it("backfills the exact expected events (lossless)", async () => {
        const store = new MemoryStore();
        await seed(store, fixture);
        await migrate(store);

        const got = await summarize(store);
        expect(got.total).toBe(expected.total);
        expect(got.partitions).toBe(expected.partitions);
        for (const [type, count] of Object.entries(expected.byType)) {
          expect(got.byType[type] ?? 0).toBe(count);
        }
        // no unexpected event types leaked in
        expect(Object.keys(got.byType).sort()).toEqual(
          Object.keys(expected.byType).sort(),
        );
      });

      it("advances schema_version to the latest", async () => {
        const store = new MemoryStore();
        await seed(store, fixture);
        await migrate(store);
        expect(await store.get<number>(K.SCHEMA_VERSION, 0)).toBe(LATEST_VERSION);
      });

      it("is idempotent — re-running produces no duplicates", async () => {
        const store = new MemoryStore();
        await seed(store, fixture);
        await migrate(store);
        const first = await summarize(store);
        // force the gate open and run again; deterministic ids must dedupe
        await store.set(K.SCHEMA_VERSION, 0);
        await migrate(store);
        const second = await summarize(store);
        expect(second.total).toBe(first.total);
        expect(second.byType).toEqual(first.byType);
      });

      it("retains the original silos (nothing destroyed)", async () => {
        const store = new MemoryStore();
        await seed(store, fixture);
        await migrate(store);
        if (fixture.diet) {
          expect(await store.get(LEGACY.DIET_HISTORY, [])).toHaveLength(
            fixture.diet.length,
          );
        }
        if (fixture.body) {
          expect(await store.get(LEGACY.BODY_LOGS, [])).toHaveLength(
            fixture.body.length,
          );
        }
      });
    });
  }

  it("a sampled day folds back to its legacy totals (round-trip is lossless)", async () => {
    const store = new MemoryStore();
    await seed(store, lightUser);
    await migrate(store);
    const repo = new TimelineRepository(store);
    const day = await repo.byDay("2026-06-25");

    const dayClosed = day.find((e) => e.type === "nutrition.day.closed");
    expect(dayClosed).toBeDefined();
    const payload = dayClosed!.payload as { consumedCalories?: number; mealsConsumed: number };
    expect(payload.consumedCalories).toBe(2000);
    expect(payload.mealsConsumed).toBe(3);

    const logged = day.filter((e) => e.type === "nutrition.meal.logged");
    expect(logged).toHaveLength(3); // matches consumedMeals.length for that day
  });
});
