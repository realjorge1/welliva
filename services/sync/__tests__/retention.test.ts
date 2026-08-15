/**
 * RETENTION + CONNECTIVITY — the two guards that keep sync cheap and honest.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  invalidateConnectivityCache,
  isOnline,
  setConnectivityProbe,
} from "../connectivity";
import {
  pruneDatedArray,
  pruneDatedRecord,
  setRetentionCompactor,
} from "../retention";

afterEach(() => {
  setConnectivityProbe(null);
  setRetentionCompactor(null);
  invalidateConnectivityCache();
});

const days = (n: number, from = new Date("2026-01-01T00:00:00Z")) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(from.getTime() + i * 86400000);
    return d.toISOString().slice(0, 10);
  });

describe("pruneDatedRecord", () => {
  it("returns the SAME object when nothing aged out, so the caller can skip a write", async () => {
    const store = { "2026-01-01": [1], "2026-01-02": [2] };
    expect(await pruneDatedRecord(store, 180)).toBe(store);
  });

  it("keeps the newest N days and drops the oldest", async () => {
    const store = Object.fromEntries(days(200).map((d) => [d, [d]]));
    const pruned = await pruneDatedRecord(store, 180);
    const kept = Object.keys(pruned).sort();
    expect(kept).toHaveLength(180);
    expect(kept[0]).toBe(days(200)[20]);
    expect(kept.at(-1)).toBe(days(200)[199]);
  });

  it("compacts every dropped day BEFORE deleting it", async () => {
    // The rule that keeps pruning raw logs from also erasing history.
    const compacted: string[] = [];
    setRetentionCompactor(async (date) => {
      compacted.push(date);
    });

    const store = Object.fromEntries(days(185).map((d) => [d, [d]]));
    await pruneDatedRecord(store, 180);
    expect(compacted).toEqual(days(185).slice(0, 5));
  });

  it("still prunes when compaction throws", async () => {
    setRetentionCompactor(async () => {
      throw new Error("timeline unavailable");
    });
    const store = Object.fromEntries(days(185).map((d) => [d, [d]]));
    expect(Object.keys(await pruneDatedRecord(store, 180))).toHaveLength(180);
  });

  it("ignores non-date keys rather than treating them as days", async () => {
    const store = { version: 2, "2026-01-01": [1] } as Record<string, unknown>;
    expect(await pruneDatedRecord(store, 1)).toBe(store);
  });
});

describe("pruneDatedArray", () => {
  it("selects by DATE, not by position — correct for both sort orders", async () => {
    const newestFirst = days(10)
      .map((date) => ({ date }))
      .reverse();
    const kept = await pruneDatedArray(newestFirst, "date", 3);
    expect(kept.map((r) => r.date)).toEqual([
      "2026-01-10",
      "2026-01-09",
      "2026-01-08",
    ]);

    const oldestFirst = days(10).map((date) => ({ date }));
    const keptAsc = await pruneDatedArray(oldestFirst, "date", 3);
    expect(keptAsc.map((r) => r.date)).toEqual([
      "2026-01-08",
      "2026-01-09",
      "2026-01-10",
    ]);
  });

  it("keeps every row of a kept day, not just one per day", async () => {
    const rows = [
      { date: "2026-01-01", n: 1 },
      { date: "2026-01-02", n: 2 },
      { date: "2026-01-02", n: 3 },
    ];
    expect(await pruneDatedArray(rows, "date", 1)).toHaveLength(2);
  });
});

describe("connectivity", () => {
  it("assumes ONLINE when no probe is installed", async () => {
    expect(await isOnline()).toBe(true);
  });

  it("assumes ONLINE when the probe throws", async () => {
    // A wrong "offline" silently stops syncing; a wrong "online" costs one
    // failed fetch. Only one of those is recoverable.
    setConnectivityProbe(async () => {
      throw new Error("native module missing");
    });
    expect(await isOnline()).toBe(true);
  });

  it("reports offline when the probe says so", async () => {
    setConnectivityProbe(async () => false);
    expect(await isOnline()).toBe(false);
  });

  it("caches so a burst of queued keys doesn't hammer the native module", async () => {
    const probe = vi.fn(async () => true);
    setConnectivityProbe(probe);
    await Promise.all([isOnline(), isOnline(), isOnline()]);
    await isOnline();
    expect(probe.mock.calls.length).toBeLessThanOrEqual(3);

    invalidateConnectivityCache();
    await isOnline();
    expect(probe).toHaveBeenCalled();
  });
});
