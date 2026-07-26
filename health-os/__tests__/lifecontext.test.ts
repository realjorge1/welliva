import { describe, expect, it } from "vitest";

import {
  addDays,
  computeExpiresAt,
  countdownLabel,
  daysBetween,
  isExpired,
  isValidDate,
  phaseOf,
  type LifeEvent,
} from "../lifecontext/lifecontext.types";
import { LifeContextRepository } from "../lifecontext/LifeContextRepository";
import { TimelineRepository } from "../timeline/TimelineRepository";
import { MemoryStore } from "./helpers/MemoryStore";

function setup() {
  const store = new MemoryStore();
  const timeline = new TimelineRepository(store);
  const repo = new LifeContextRepository(store, timeline);
  return { store, timeline, repo };
}

/** A fixed "now" so the suite is deterministic regardless of the machine's clock. */
const NOW = new Date(2026, 5, 29, 9, 0, 0); // 2026-06-29 local
const TODAY = "2026-06-29";

function evt(overrides: Partial<LifeEvent> = {}): LifeEvent {
  return {
    id: "e1",
    kind: "travel",
    title: "Trip",
    window: { start: "2026-07-10" },
    source: "user",
    confidence: 1,
    status: "active",
    createdAt: "2026-06-29T09:00:00+00:00",
    updatedAt: "2026-06-29T09:00:00+00:00",
    expiresAt: computeExpiresAt({ start: "2026-07-10" }),
    ...overrides,
  };
}

describe("lifecontext pure helpers", () => {
  it("addDays / daysBetween are local-date exact", () => {
    expect(addDays("2026-06-29", 7)).toBe("2026-07-06");
    expect(addDays("2026-06-29", -1)).toBe("2026-06-28");
    expect(daysBetween("2026-06-29", "2026-07-10")).toBe(11);
    expect(daysBetween("2026-07-10", "2026-06-29")).toBe(-11);
  });

  it("isValidDate rejects impossible dates", () => {
    expect(isValidDate("2026-07-10")).toBe(true);
    expect(isValidDate("2026-02-31")).toBe(false);
    expect(isValidDate("2026-7-10")).toBe(false);
    expect(isValidDate("nope")).toBe(false);
  });

  it("computeExpiresAt adds the grace day past the window end", () => {
    expect(computeExpiresAt({ start: "2026-07-10" })).toBe("2026-07-11");
    expect(computeExpiresAt({ start: "2026-07-10", end: "2026-07-18" })).toBe("2026-07-19");
  });

  it("phaseOf classifies upcoming / imminent / active / past", () => {
    expect(phaseOf(evt({ window: { start: "2026-08-30" } }), TODAY)).toBe("upcoming");
    expect(phaseOf(evt({ window: { start: "2026-07-03" } }), TODAY)).toBe("imminent");
    expect(phaseOf(evt({ window: { start: "2026-06-27", end: "2026-07-02" } }), TODAY)).toBe("active");
    expect(phaseOf(evt({ window: { start: "2026-06-20", end: "2026-06-25" } }), TODAY)).toBe("past");
  });

  it("countdownLabel reads naturally", () => {
    expect(countdownLabel(evt({ window: { start: "2026-07-10" } }), TODAY)).toBe("in 11 days");
    expect(countdownLabel(evt({ window: { start: "2026-06-30" } }), TODAY)).toBe("tomorrow");
    expect(countdownLabel(evt({ window: { start: "2026-06-29" } }), TODAY)).toBe("today");
  });

  it("isExpired is true only past the grace day", () => {
    const e = evt({ window: { start: "2026-06-25" }, expiresAt: "2026-06-26" });
    expect(isExpired(e, "2026-06-26")).toBe(false); // on the grace day
    expect(isExpired(e, "2026-06-27")).toBe(true); // after it
  });
});

describe("LifeContextRepository lifecycle", () => {
  it("add persists an active entry and appends a life.added Timeline event", async () => {
    const { repo, timeline } = setup();
    const e = await repo.add(
      { kind: "wedding", title: "Sister's wedding", window: { start: "2026-08-12" } },
      NOW,
    );
    expect(e.status).toBe("active");
    expect(e.expiresAt).toBe("2026-08-13");

    const active = await repo.listActive(NOW);
    expect(active).toHaveLength(1);

    const events = await timeline.query({ types: ["life.added"] });
    expect(events).toHaveLength(1);
    expect((events[0].payload as { refId: string }).refId).toBe(e.id);
  });

  it("rejects an invalid window", async () => {
    const { repo } = setup();
    await expect(
      repo.add({ kind: "travel", title: "x", window: { start: "2026-02-31" } }, NOW),
    ).rejects.toThrow();
    await expect(
      repo.add(
        { kind: "travel", title: "x", window: { start: "2026-07-10", end: "2026-07-01" } },
        NOW,
      ),
    ).rejects.toThrow();
  });

  it("add is idempotent on a provided id (re-import is a no-op)", async () => {
    const { repo } = setup();
    await repo.add({ id: "cal-1", kind: "travel", title: "Trip", window: { start: "2026-07-10" } }, NOW);
    await repo.add({ id: "cal-1", kind: "travel", title: "Trip", window: { start: "2026-07-10" } }, NOW);
    expect(await repo.list({ includeResolved: true })).toHaveLength(1);
  });

  it("complete and dismiss move an entry to a terminal state with an audit event", async () => {
    const { repo, timeline } = setup();
    const a = await repo.add({ kind: "competition", title: "10k", window: { start: "2026-07-05" } }, NOW);
    const b = await repo.add({ kind: "travel", title: "Trip", window: { start: "2026-07-20" } }, NOW);

    await repo.complete(a.id, NOW);
    await repo.dismiss(b.id, NOW);

    expect(await repo.listActive(NOW)).toHaveLength(0);
    const all = await repo.list({ includeResolved: true });
    expect(all.find((e) => e.id === a.id)?.status).toBe("completed");
    expect(all.find((e) => e.id === b.id)?.status).toBe("dismissed");

    const resolved = await timeline.query({ types: ["life.resolved"] });
    expect(resolved).toHaveLength(2);
  });

  it("does not double-resolve an already-terminal entry", async () => {
    const { repo, timeline } = setup();
    const a = await repo.add({ kind: "travel", title: "Trip", window: { start: "2026-07-20" } }, NOW);
    await repo.complete(a.id, NOW);
    await repo.dismiss(a.id, NOW); // no-op: already completed
    expect((await repo.get(a.id))?.status).toBe("completed");
    expect(await timeline.query({ types: ["life.resolved"] })).toHaveLength(1);
  });

  it("expireDue terminates only entries past their grace day", async () => {
    const { repo } = setup();
    // already-past event (ended last week) + a future one
    await repo.add({ kind: "vacation", title: "Old trip", window: { start: "2026-06-10", end: "2026-06-20" } }, NOW);
    await repo.add({ kind: "wedding", title: "Future", window: { start: "2026-08-12" } }, NOW);

    const expired = await repo.expireDue(NOW);
    expect(expired).toBe(1);

    const active = await repo.listActive(NOW);
    expect(active).toHaveLength(1);
    expect(active[0].title).toBe("Future");

    const all = await repo.list({ includeResolved: true });
    expect(all.find((e) => e.title === "Old trip")?.status).toBe("expired");
  });

  it("listUpcoming respects the horizon and listActive sorts soonest-first", async () => {
    const { repo } = setup();
    await repo.add({ kind: "travel", title: "Soon", window: { start: "2026-07-02" } }, NOW);
    await repo.add({ kind: "wedding", title: "Later", window: { start: "2026-08-20" } }, NOW);
    await repo.add({ kind: "deadline", title: "Far", window: { start: "2027-01-01" } }, NOW);

    const active = await repo.listActive(NOW);
    expect(active.map((e) => e.title)).toEqual(["Soon", "Later", "Far"]);

    const within60 = await repo.listUpcoming(60, NOW);
    expect(within60.map((e) => e.title)).toEqual(["Soon", "Later"]); // "Far" is beyond 60 days
  });

  it("remove hard-deletes an entry", async () => {
    const { repo } = setup();
    const a = await repo.add({ kind: "travel", title: "Trip", window: { start: "2026-07-20" } }, NOW);
    expect(await repo.remove(a.id)).toBe(true);
    expect(await repo.list({ includeResolved: true })).toHaveLength(0);
    expect(await repo.remove(a.id)).toBe(false); // already gone
  });
});
