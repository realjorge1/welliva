import { describe, expect, it } from "vitest";

import { weekKeyOf } from "../platform/clock";
import { MemoryRepository } from "../memory/MemoryRepository";
import { SummaryStore } from "../memory/SummaryStore";
import { buildEvent } from "../timeline/events";
import { TimelineRepository } from "../timeline/TimelineRepository";
import { MemoryStore } from "./helpers/MemoryStore";

function setup() {
  const store = new MemoryStore();
  const timeline = new TimelineRepository(store);
  const summaries = new SummaryStore(store);
  const memory = new MemoryRepository(timeline, summaries);
  return { timeline, summaries, memory };
}

const DAY = "2026-06-15";

function mealEvent(id: string, calories: number, date = DAY) {
  return buildEvent({
    type: "nutrition.meal.logged",
    id,
    localDate: date,
    source: "user",
    payload: { name: id, calories },
  });
}

describe("MemoryRepository", () => {
  it("lazily compacts a day on first read and persists it", async () => {
    const { timeline, summaries, memory } = setup();
    await timeline.append(mealEvent("m1", 300));

    expect(await summaries.getDay(DAY)).toBeNull();
    const day = await memory.getDaySummary(DAY);
    expect(day.nutrition.calories).toBe(300);
    expect(await summaries.getDay(DAY)).not.toBeNull(); // now cached
  });

  it("returns the cached summary on a second read (no recompute)", async () => {
    const { timeline, memory } = setup();
    await timeline.append(mealEvent("m1", 300));
    const first = await memory.getDaySummary(DAY);
    const second = await memory.getDaySummary(DAY);
    expect(second.computedAt).toBe(first.computedAt); // same object, not recomputed
  });

  it("recompacts after a correction (derived stats follow the latest event)", async () => {
    const { timeline, memory } = setup();
    await timeline.append(mealEvent("m1", 100));
    expect((await memory.getDaySummary(DAY)).nutrition.calories).toBe(100);

    await timeline.correct("m1", { name: "fixed", calories: 500 });
    const after = await memory.recompactDay(DAY);
    expect(after.nutrition.calories).toBe(500);
    expect(after.nutrition.mealsLogged).toBe(1);
  });

  it("recomputes a dirty day lazily on the next read", async () => {
    const { timeline, summaries, memory } = setup();
    await timeline.append(mealEvent("m1", 100));
    await memory.getDaySummary(DAY); // cache at 100

    await timeline.redact("m1");
    await summaries.markDirty(DAY);
    const after = await memory.getDaySummary(DAY);
    expect(after.nutrition.calories).toBe(0);
    expect(after.nutrition.tracked).toBe(false);
  });

  it("compactDayIfPresent is a no-op when the Timeline has no events for the day", async () => {
    const { summaries, memory } = setup();
    const result = await memory.compactDayIfPresent("2026-06-20");
    expect(result).toBeNull();
    expect(await summaries.getDay("2026-06-20")).toBeNull();
  });

  it("rolls a week up from day summaries (L2), not L1", async () => {
    const { timeline, memory } = setup();
    // three days in the same week
    await timeline.appendMany([
      mealEvent("a", 2000, "2026-06-15"),
      mealEvent("b", 2200, "2026-06-16"),
      mealEvent("c", 1800, "2026-06-17"),
    ]);
    // compact each day so the summary index knows about them
    for (const d of ["2026-06-15", "2026-06-16", "2026-06-17"]) {
      await memory.getDaySummary(d);
    }
    const week = await memory.getWeekSummary(weekKeyOf("2026-06-15"));
    expect(week.fromDayCount).toBe(3);
    expect(week.nutrition.avgCalories).toBe(2000);
  });
});
