import { describe, expect, it } from "vitest";

import type { WaterAddedPayload } from "../timeline/catalog";
import { buildEvent } from "../timeline/events";
import { TimelineRepository } from "../timeline/TimelineRepository";
import { MemoryStore } from "./helpers/MemoryStore";

function water(id: string, date: string, ml: number) {
  return buildEvent<WaterAddedPayload>({
    id,
    type: "hydration.water.added",
    localDate: date,
    ts: `${date}T12:00:00+00:00`,
    source: "app",
    payload: { ml },
  });
}

describe("TimelineRepository", () => {
  it("appends and reads back by day", async () => {
    const repo = new TimelineRepository(new MemoryStore());
    await repo.append(water("a", "2026-06-10", 250));
    const day = await repo.byDay("2026-06-10");
    expect(day).toHaveLength(1);
    expect((day[0].payload as WaterAddedPayload).ml).toBe(250);
  });

  it("is idempotent on id (re-append is a no-op)", async () => {
    const repo = new TimelineRepository(new MemoryStore());
    await repo.append(water("a", "2026-06-10", 250));
    await repo.append(water("a", "2026-06-10", 250));
    expect(await repo.byDay("2026-06-10")).toHaveLength(1);
  });

  it("excludes redacted events from every read", async () => {
    const repo = new TimelineRepository(new MemoryStore());
    await repo.append(water("a", "2026-06-10", 250));
    await repo.append(water("b", "2026-06-10", 300));
    await repo.redact("a");
    expect(await repo.byDay("2026-06-10")).toHaveLength(1);
    expect(await repo.query({})).toHaveLength(1);
    // ...but it is still physically stored (auditable / recoverable)
    expect(await repo.query({ includeRedacted: true })).toHaveLength(2);
  });

  it("correction-by-append supersedes the original without deleting it", async () => {
    const repo = new TimelineRepository(new MemoryStore());
    await repo.append(water("a", "2026-06-10", 250));
    const corrected = await repo.correct<WaterAddedPayload>("a", { ml: 999 });
    expect(corrected).not.toBeNull();

    const visible = await repo.byDay("2026-06-10");
    expect(visible).toHaveLength(1); // only the corrected value shows
    expect((visible[0].payload as WaterAddedPayload).ml).toBe(999);

    // the original is retained for the audit trail (Memory Center "show history")
    expect(await repo.query({ includeSuperseded: true })).toHaveLength(2);
    // ...but a normal read never resurfaces it
    expect(await repo.query({})).toHaveLength(1);
  });

  it("queries by type and date range across month partitions", async () => {
    const repo = new TimelineRepository(new MemoryStore());
    await repo.append(water("a", "2026-05-31", 100));
    await repo.append(water("b", "2026-06-01", 200));
    await repo.append(water("c", "2026-06-15", 300));

    const june = await repo.query({ from: "2026-06-01", to: "2026-06-30" });
    expect(june).toHaveLength(2);

    const index = await repo.index();
    expect(Object.keys(index.partitions).sort()).toEqual(["2026-05", "2026-06"]);
    expect(index.total).toBe(3);
  });

  it("hard-erases matching events and updates the index", async () => {
    const repo = new TimelineRepository(new MemoryStore());
    await repo.append(water("a", "2026-06-10", 250));
    await repo.append(water("b", "2026-06-11", 300));
    const removed = await repo.eraseHard((e) => e.id === "a");
    expect(removed).toBe(1);
    expect(await repo.query({ includeRedacted: true })).toHaveLength(1);
    expect((await repo.index()).total).toBe(1);
  });

  it("applies user tags", async () => {
    const repo = new TimelineRepository(new MemoryStore());
    await repo.append(water("a", "2026-06-10", 250));
    await repo.tag("a", ["travel"]);
    const [e] = await repo.byDay("2026-06-10");
    expect(e.tags).toEqual(["travel"]);
  });
});
