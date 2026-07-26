import { describe, expect, it } from "vitest";

import { K } from "../platform/storage/keys";
import type { Migration } from "../platform/migrations/runner";
import { runMigrations } from "../platform/migrations/runner";
import { MemoryStore } from "./helpers/MemoryStore";

describe("migration runner", () => {
  it("does NOT advance the version when a migration throws (data stays on legacy path)", async () => {
    const store = new MemoryStore();
    const bad: Migration = {
      version: 1,
      name: "bad",
      up: async () => {
        throw new Error("boom");
      },
    };
    const applied = await runMigrations(store, [bad]);
    expect(applied).toBe(0);
    expect(await store.get<number>(K.SCHEMA_VERSION, 0)).toBe(0);
  });

  it("advances on success and is idempotent (re-run does nothing)", async () => {
    const store = new MemoryStore();
    let runs = 0;
    const ok: Migration = {
      version: 1,
      name: "ok",
      up: async () => {
        runs++;
        return { ran: 1 };
      },
    };
    await runMigrations(store, [ok]);
    await runMigrations(store, [ok]);
    expect(runs).toBe(1);
    expect(await store.get<number>(K.SCHEMA_VERSION, 0)).toBe(1);
  });

  it("runs pending migrations lowest-version-first", async () => {
    const store = new MemoryStore();
    const order: number[] = [];
    const mk = (v: number): Migration => ({
      version: v,
      name: `m${v}`,
      up: async () => {
        order.push(v);
        return {};
      },
    });
    await runMigrations(store, [mk(3), mk(1), mk(2)]);
    expect(order).toEqual([1, 2, 3]);
    expect(await store.get<number>(K.SCHEMA_VERSION, 0)).toBe(3);
  });

  it("stops the chain at the first failure, leaving the last good version", async () => {
    const store = new MemoryStore();
    const ok: Migration = { version: 1, name: "ok", up: async () => ({}) };
    const bad: Migration = {
      version: 2,
      name: "bad",
      up: async () => {
        throw new Error("nope");
      },
    };
    const applied = await runMigrations(store, [ok, bad]);
    expect(applied).toBe(1);
    expect(await store.get<number>(K.SCHEMA_VERSION, 0)).toBe(1);
  });
});
