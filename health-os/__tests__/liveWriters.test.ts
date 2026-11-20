/**
 * The live timeline writers and migration 005 — the learning model finally
 * receives the days it was built to learn from.
 *
 * Fix 2 acceptance (the part that's about data reaching the model): a fresh
 * install that logs 30 days and weighs in every few days ends up with a
 * timeline event for every closed day and every weigh-in, written by the live
 * code (no one-time import involved), and an unlogged day reaches the filter
 * as unknown.
 */
import { describe, expect, it } from "vitest";

import type { DietHistoryEntry } from "@/models/diet";
import type { BodyLogEntry } from "@/models/workout";

import { buildSeries } from "../learning/engine";
import { migration001 } from "../platform/migrations/001-backfill-timeline";
import { migration005 } from "../platform/migrations/005-catch-up-learning-days";
import { runMigrations } from "../platform/migrations/runner";
import { LEGACY } from "../platform/storage/keys";
import { TimelineRepository } from "../timeline/TimelineRepository";
import { emitBodyMeasurement, emitDayClosed } from "../timeline/writers";
import { MemoryStore } from "./helpers/MemoryStore";

const date = (i: number) => {
  const d = new Date(2026, 9, 1 + i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const closed = (i: number, kcal: number, meals = 3): DietHistoryEntry => ({
  date: date(i),
  dietId: "everyday",
  dietName: "Everyday",
  mealsConsumed: meals,
  totalMeals: 3,
  status: meals === 3 ? "completed" : meals > 0 ? "partial" : "skipped",
  consumedCalories: kcal,
  consumedProteinG: Math.round(kcal / 40),
  consumedCarbsG: Math.round(kcal / 8),
  consumedFatG: Math.round(kcal / 30),
  loggedness: kcal === 0 ? "none" : meals === 3 ? "inferred" : "partial",
  targetCalories: 1800,
});

const count = async (repo: TimelineRepository, type: string) =>
  (await repo.query({})).filter((e) => e.type === type).length;

describe("a fresh install, 30 days of live writes", () => {
  it("has an event for every closed day and every weigh-in, and an unlogged day is unknown", async () => {
    const repo = new TimelineRepository(new MemoryStore());
    for (let i = 0; i < 30; i++) {
      // Day 10 and 20: nothing logged (day-close still writes the 0 kcal row).
      await emitDayClosed(closed(i, i === 10 || i === 20 ? 0 : 1750, i === 10 || i === 20 ? 0 : 3), repo);
      if (i % 3 === 0) await emitBodyMeasurement({ date: date(i), weightKg: 80 - i * 0.05 }, repo);
    }
    expect(await count(repo, "nutrition.day.closed")).toBe(30);
    expect(await count(repo, "body.measurement.logged")).toBe(10);

    const series = buildSeries(await repo.query({}), date(29), { targetKcal: 1800 });
    expect(series.find((r) => r.date === date(10))!.intakeKcal).toBeNull();
    expect(series.find((r) => r.date === date(11))!.intakeKcal).toBe(1750);
  });
});

describe("the writers are idempotent", () => {
  it("re-closing a day with the same totals writes nothing", async () => {
    const repo = new TimelineRepository(new MemoryStore());
    await emitDayClosed(closed(0, 1750), repo);
    await emitDayClosed(closed(0, 1750), repo);
    await emitDayClosed(closed(0, 1750), repo);
    expect((await repo.query({ includeSuperseded: true })).length).toBe(1);
  });

  it("a changed day is corrected, and the read sees only the latest", async () => {
    const repo = new TimelineRepository(new MemoryStore());
    await emitDayClosed(closed(0, 300, 1), repo); // a snack, closed
    await emitDayClosed(closed(0, 1750, 3), repo); // back-logged lunch and dinner
    const resolved = (await repo.query({})).filter((e) => e.type === "nutrition.day.closed");
    expect(resolved).toHaveLength(1);
    expect((resolved[0]!.payload as { consumedCalories: number }).consumedCalories).toBe(1750);
    // The original stays in the audit trail.
    expect((await repo.query({ includeSuperseded: true })).length).toBe(2);
  });

  it("a re-weigh the same day corrects the weigh-in, never adds a second", async () => {
    const repo = new TimelineRepository(new MemoryStore());
    await emitBodyMeasurement({ date: date(0), weightKg: 80.4 }, repo);
    await emitBodyMeasurement({ date: date(0), weightKg: 80.1 }, repo);
    await emitBodyMeasurement({ date: date(0), weightKg: 80.1 }, repo);
    const resolved = (await repo.query({})).filter((e) => e.type === "body.measurement.logged");
    expect(resolved).toHaveLength(1);
    expect((resolved[0]!.payload as { weightKg: number }).weightKg).toBe(80.1);
  });

  it("re-emitting a day migration 001 backfilled is the SAME event (shared seed)", async () => {
    const store = new MemoryStore();
    const legacy = { ...closed(0, 1750) };
    delete legacy.loggedness;
    delete legacy.targetCalories;
    await store.set(LEGACY.DIET_HISTORY, [legacy]);
    await runMigrations(store, [migration001]);
    const repo = new TimelineRepository(store);
    await emitDayClosed(legacy, repo);
    expect(await count(repo, "nutrition.day.closed")).toBe(1);
    expect((await repo.query({ includeSuperseded: true })).filter((e) => e.type === "nutrition.day.closed")).toHaveLength(1);
  });

  it("a weigh-in 001 backfilled (seeded by position) is matched by date, not duplicated", async () => {
    const store = new MemoryStore();
    const weigh: BodyLogEntry = { date: date(0), weightKg: 80 };
    await store.set(LEGACY.BODY_LOGS, [weigh]);
    await runMigrations(store, [migration001]);
    const repo = new TimelineRepository(store);
    await emitBodyMeasurement(weigh, repo);
    expect(await count(repo, "body.measurement.logged")).toBe(1);
  });
});

describe("migration 005 — catch the model up", () => {
  const history = Array.from({ length: 40 }, (_, i) => closed(i, 1700));
  const logs: BodyLogEntry[] = Array.from({ length: 14 }, (_, i) => ({ date: date(i * 3), weightKg: 80 - i * 0.2 }));

  it("on an empty timeline (installed after the import), adds every day and weigh-in", async () => {
    const store = new MemoryStore();
    await store.set(LEGACY.DIET_HISTORY, history);
    await store.set(LEGACY.BODY_LOGS, logs);
    await runMigrations(store, [migration005]);
    const repo = new TimelineRepository(store);
    expect(await count(repo, "nutrition.day.closed")).toBe(40);
    expect(await count(repo, "body.measurement.logged")).toBe(14);
  });

  it("on a timeline missing a month, adds only that month", async () => {
    const store = new MemoryStore();
    const repo = new TimelineRepository(store);
    for (const d of history.slice(0, 10)) await emitDayClosed(d, repo);
    await store.set(LEGACY.DIET_HISTORY, history);
    await store.set(LEGACY.BODY_LOGS, []);
    await runMigrations(store, [migration005]);
    expect(await count(repo, "nutrition.day.closed")).toBe(40);
    // Nothing that was there was touched: no corrections were made.
    expect((await repo.query({ includeSuperseded: true })).length).toBe(40);
  });

  it("on a complete timeline, adds nothing — and a re-run adds nothing", async () => {
    const store = new MemoryStore();
    const repo = new TimelineRepository(store);
    for (const d of history) await emitDayClosed(d, repo);
    for (const b of logs) await emitBodyMeasurement(b, repo);
    await store.set(LEGACY.DIET_HISTORY, history);
    await store.set(LEGACY.BODY_LOGS, logs);
    const before = (await repo.query({ includeSuperseded: true })).length;
    const report = await migration005.up({ store, now: new Date() });
    expect(report).toEqual({ daysAdded: 0, weighInsAdded: 0 });
    await migration005.up({ store, now: new Date() });
    expect((await repo.query({ includeSuperseded: true })).length).toBe(before);
  });
});
