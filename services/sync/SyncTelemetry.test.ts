/**
 * SyncTelemetry — the retry/observability wrapper every sync slice runs through.
 *
 * The behaviour that actually matters here is the retry CLASSIFICATION: a
 * network blip should be retried, but an RLS rejection never will fix itself and
 * retrying it just delays the failure by ~1.2s on a screen the user is waiting
 * on. These tests pin that distinction, plus the counters a debug screen reads.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSyncHealth,
  getSyncHealth,
  withSyncTelemetry,
} from "./SyncTelemetry";

/** Fails `failures` times with `message`, then succeeds. Counts its calls. */
function flaky(failures: number, message: string) {
  const state = { calls: 0 };
  const fn = async () => {
    state.calls += 1;
    if (state.calls <= failures) throw new Error(message);
    return "ok-value";
  };
  return { fn, state };
}

beforeEach(async () => {
  // The module keeps an in-memory cache across tests — reset it.
  await clearSyncHealth();
});

describe("withSyncTelemetry", () => {
  it("records a first-try success as 'ok' and returns the value", async () => {
    const result = await withSyncTelemetry("profile.pull", async () => 42);
    expect(result).toBe(42);

    const health = await getSyncHealth();
    expect(health.events).toHaveLength(1);
    expect(health.events[0]).toMatchObject({
      op: "profile.pull",
      outcome: "ok",
    });
    // No retries happened, so `attempts` is omitted entirely.
    expect(health.events[0]?.attempts).toBeUndefined();
    expect(health.counters["profile.pull"]).toMatchObject({ ok: 1, failed: 0 });
  });

  it("does NOT retry a non-transient error — it fails fast", async () => {
    const { fn, state } = flaky(99, "new row violates row-level security policy");

    await expect(
      withSyncTelemetry("profile.push", fn, { retries: 3 }),
    ).rejects.toThrow(/row-level security/);

    // The whole point: one call, not four. An RLS rejection is permanent.
    expect(state.calls).toBe(1);

    const health = await getSyncHealth();
    expect(health.events[0]).toMatchObject({
      op: "profile.push",
      outcome: "failed",
    });
    expect(health.counters["profile.push"]).toMatchObject({ failed: 1, ok: 0 });
    expect(health.counters["profile.push"]?.lastError).toMatch(
      /row-level security/,
    );
  });

  it("retries a transient error and reports the eventual success as 'retried'", async () => {
    const { fn, state } = flaky(1, "Network request failed");

    const result = await withSyncTelemetry("profile.push", fn, { retries: 2 });
    expect(result).toBe("ok-value");
    expect(state.calls).toBe(2); // one failure + one success

    const health = await getSyncHealth();
    expect(health.events[0]).toMatchObject({
      op: "profile.push",
      outcome: "retried",
      attempts: 2,
    });
    // A retried success still counts as ok — it did succeed.
    expect(health.counters["profile.push"]).toMatchObject({
      ok: 1,
      retried: 1,
      failed: 0,
    });
  });

  it("gives up after the retry budget and surfaces the error", async () => {
    const { fn, state } = flaky(99, "fetch timeout");

    await expect(
      withSyncTelemetry("storage.upload", fn, { retries: 2 }),
    ).rejects.toThrow(/timeout/);

    expect(state.calls).toBe(3); // initial + 2 retries
    const health = await getSyncHealth();
    expect(health.events[0]).toMatchObject({
      op: "storage.upload",
      outcome: "failed",
      attempts: 3,
    });
  });

  it("keeps the newest event first and caps the log so it can't grow forever", async () => {
    for (let i = 0; i < 55; i += 1) {
      await withSyncTelemetry("storage.signUrl", async () => i, { retries: 0 });
    }

    const health = await getSyncHealth();
    // MAX_EVENTS = 50: this log lives in AsyncStorage on a phone.
    expect(health.events).toHaveLength(50);
    // Counters are lifetime totals and keep counting past the ring buffer.
    expect(health.counters["storage.signUrl"]).toMatchObject({ ok: 55 });
  });

  it("tracks each operation separately", async () => {
    await withSyncTelemetry("profile.pull", async () => 1);
    await expect(
      withSyncTelemetry("profile.push", async () => {
        throw new Error("duplicate key value");
      }, { retries: 0 }),
    ).rejects.toThrow();

    const health = await getSyncHealth();
    expect(health.counters["profile.pull"]).toMatchObject({ ok: 1, failed: 0 });
    expect(health.counters["profile.push"]).toMatchObject({ ok: 0, failed: 1 });
  });

  it("hands back a copy, so a caller can't mutate the live log", async () => {
    await withSyncTelemetry("profile.pull", async () => 1);

    const first = await getSyncHealth();
    first.events.length = 0;

    const second = await getSyncHealth();
    expect(second.events).toHaveLength(1);
  });
});
