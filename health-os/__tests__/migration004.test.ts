import { describe, expect, it } from "vitest";

import { migration004 } from "../platform/migrations/004-mind-valence";
import { runMigrations } from "../platform/migrations/runner";
import { K, LEGACY } from "../platform/storage/keys";
import { MemoryStore } from "./helpers/MemoryStore";

// The domain's own copy of the mapping. Imported ONLY so the pin test below can
// prove the two agree — the migration itself must not depend on services/.
import { valenceFromLegacyMood } from "../../services/gozlin/mind";

type Stored = {
  date: string;
  id?: string;
  kind?: string;
  valence?: number;
  mood?: number;
  energy?: number;
  stress?: number;
  sleepHours?: number;
  createdAt?: number;
};

async function seed(store: MemoryStore, list: Stored[]) {
  await store.set(LEGACY.GOZLIN_CHECKINS, list);
}

async function read(store: MemoryStore): Promise<Stored[]> {
  return store.get<Stored[]>(LEGACY.GOZLIN_CHECKINS, []);
}

const run = (store: MemoryStore) => runMigrations(store, [migration004]);

describe("migration 004 — mind valence", () => {
  it("remaps every legacy mood onto its stop", async () => {
    const store = new MemoryStore();
    await seed(store, [
      { date: "2026-09-01", mood: 1, createdAt: 1 },
      { date: "2026-09-02", mood: 2, createdAt: 2 },
      { date: "2026-09-03", mood: 3, createdAt: 3 },
      { date: "2026-09-04", mood: 4, createdAt: 4 },
      { date: "2026-09-05", mood: 5, createdAt: 5 },
    ]);
    await run(store);

    const after = await read(store);
    expect(after.map((c) => c.valence)).toEqual([
      -1,
      -1 / 3,
      0,
      1 / 3,
      1,
    ]);
  });

  it("is symmetric about neutral", async () => {
    const store = new MemoryStore();
    await seed(store, [
      { date: "2026-09-02", mood: 2 },
      { date: "2026-09-04", mood: 4 },
    ]);
    await run(store);
    const [low, high] = await read(store);
    expect(low.valence).toBeCloseTo(-(high.valence ?? 0), 10);
  });

  it("stamps an id and a kind on every record", async () => {
    const store = new MemoryStore();
    await seed(store, [{ date: "2026-09-01", mood: 4 }]);
    await run(store);

    const [c] = await read(store);
    expect(c.id).toBe("daily:2026-09-01");
    // Every pre-004 record was a day's check-in; there was no other kind.
    expect(c.kind).toBe("daily");
  });

  it("keeps sleepHours untouched — it is not a feeling", async () => {
    const store = new MemoryStore();
    await seed(store, [{ date: "2026-09-01", mood: 3, sleepHours: 7.5 }]);
    await run(store);
    expect((await read(store))[0].sleepHours).toBe(7.5);
  });

  it("gives a sleep-only record an identity but no feeling", async () => {
    const store = new MemoryStore();
    await seed(store, [{ date: "2026-09-01", sleepHours: 6 }]);
    const applied = await run(store);

    const [c] = await read(store);
    expect(c.id).toBe("daily:2026-09-01");
    // It never carried a feeling, so it must not acquire one — Neutral is a real
    // answer and this record did not give it.
    expect(c.valence).toBeUndefined();
    expect(applied).toBe(4);
  });

  it("invents no labels from a high stress value", async () => {
    const store = new MemoryStore();
    await seed(store, [{ date: "2026-09-01", mood: 2, stress: 5 }]);
    await run(store);

    const [c] = await read(store) as (Stored & { labels?: string[] })[];
    // The user never chose the word "Stressed". Deriving it here would let the
    // coach report a word as if they had said it.
    expect(c.labels).toBeUndefined();
  });

  it("leaves the dead energy/stress dials in place rather than deleting them", async () => {
    const store = new MemoryStore();
    await seed(store, [{ date: "2026-09-01", mood: 4, energy: 3, stress: 2 }]);
    await run(store);

    const [c] = await read(store);
    expect(c.energy).toBe(3);
    expect(c.stress).toBe(2);
  });

  it("is idempotent — a re-run converts nothing", async () => {
    const store = new MemoryStore();
    await seed(store, [{ date: "2026-09-01", mood: 5 }]);
    await run(store);
    const first = await read(store);

    // Force the gate open the way the other migration tests do.
    await store.set(K.SCHEMA_VERSION, 0);
    await run(store);

    expect(await read(store)).toEqual(first);
  });

  it("does not re-touch a record that already has a valence", async () => {
    const store = new MemoryStore();
    await seed(store, [
      { date: "2026-09-01", id: "moment:x", kind: "momentary", valence: 0.75 },
    ]);
    await run(store);

    const [c] = await read(store);
    expect(c.valence).toBe(0.75);
    expect(c.kind).toBe("momentary");
    expect(c.id).toBe("moment:x");
  });

  it("survives an empty or absent store", async () => {
    const empty = new MemoryStore();
    expect(await run(empty)).toBe(4);

    const seeded = new MemoryStore();
    await seed(seeded, []);
    expect(await run(seeded)).toBe(4);
  });

  it("skips malformed records without failing the migration", async () => {
    const store = new MemoryStore();
    await store.set(LEGACY.GOZLIN_CHECKINS, [
      null,
      { mood: 4 }, // no date
      { date: "2026-09-01", mood: 4 },
    ]);
    const applied = await run(store);

    expect(applied).toBe(4);
    const after = await read(store);
    expect(after).toHaveLength(3);
    expect(after[2].valence).toBeCloseTo(1 / 3, 10);
  });

  it("advances the schema version", async () => {
    const store = new MemoryStore();
    await seed(store, [{ date: "2026-09-01", mood: 3 }]);
    await run(store);
    expect(await store.get<number>(K.SCHEMA_VERSION, 0)).toBe(4);
  });
});

describe("the mapping is pinned to the domain's copy", () => {
  it("agrees with services/gozlin/mind.ts for every legacy answer", async () => {
    // health-os/platform imports nothing from any domain, so the 1–5 table is
    // written twice on purpose. This is the guard that keeps the two identical:
    // if either side is corrected alone, this fails.
    const store = new MemoryStore();
    await seed(
      store,
      [1, 2, 3, 4, 5].map((mood, i) => ({ date: `2026-09-0${i + 1}`, mood })),
    );
    await run(store);

    const after = await read(store);
    after.forEach((c, i) => {
      expect(c.valence).toBeCloseTo(valenceFromLegacyMood(i + 1), 10);
    });
  });
});
