import { describe, expect, it } from "vitest";

import { computeRecovery, buildAnticipations } from "@/services/gozlin";
import type { WorkoutLogEntry } from "@/models/workout";
import { ConsentRepository } from "../privacy/ConsentRepository";
import {
  WearableSource,
  lazyPlatformProvider,
  wearableSource,
} from "../signals/wearable/WearableSource";
import {
  recoveryAdjustment,
  wearableBasis,
  wearableHints,
  type WearableSnapshot,
} from "../signals/wearable/wearable";
import { MemoryStore } from "./helpers/MemoryStore";

function snap(o: Partial<WearableSnapshot> = {}): WearableSnapshot {
  return { date: "2026-06-29", source: "manual", fetchedAt: "2026-06-29T07:00:00", ...o };
}

describe("wearable core (pure)", () => {
  it("penalises short sleep and rewards good sleep", () => {
    expect(recoveryAdjustment(snap({ sleepHours: 4.5 })).delta).toBeLessThan(-10);
    expect(recoveryAdjustment(snap({ sleepHours: 8.5 })).delta).toBeGreaterThan(0);
  });

  it("compares HRV to the personal baseline, not an absolute", () => {
    const low = recoveryAdjustment(snap({ hrvMs: 40, hrvBaselineMs: 60 }));
    expect(low.delta).toBeLessThan(0);
    expect(low.drivers.join(" ")).toMatch(/HRV/);
    // Same HRV, but it IS the baseline → no penalty.
    expect(recoveryAdjustment(snap({ hrvMs: 60, hrvBaselineMs: 60 })).delta).toBe(0);
  });

  it("reports no signal when no metrics are present", () => {
    const adj = recoveryAdjustment(snap());
    expect(adj.hasSignal).toBe(false);
    expect(adj.delta).toBe(0);
  });

  it("describes the basis from the metrics it used", () => {
    expect(wearableBasis(snap({ sleepHours: 7, hrvMs: 55 }))).toMatch(/sleep/);
    expect(wearableBasis(snap())).toMatch(/proxy/);
  });

  it("surfaces sleep-debt and strain hints", () => {
    expect(wearableHints(snap({ sleepHours: 5 })).some((h) => h.kind === "sleep")).toBe(true);
    expect(
      wearableHints(snap({ hrvMs: 45, hrvBaselineMs: 60 })).some((h) => h.kind === "strain"),
    ).toBe(true);
    expect(wearableHints(snap({ sleepHours: 8 }))).toHaveLength(0);
  });
});

describe("GozlinRecoveryEngine wearable fold", () => {
  const NOW = new Date("2026-06-29T08:00:00");
  const noLog: WorkoutLogEntry[] = [];

  it("lowers the score and updates basis with poor sleep", () => {
    const proxy = computeRecovery({ workoutLog: noLog, todaySession: null, now: NOW });
    const folded = computeRecovery({
      workoutLog: noLog,
      todaySession: null,
      wearable: snap({ sleepHours: 4 }),
      now: NOW,
    });
    expect(folded.score).toBeLessThan(proxy.score);
    expect(folded.basis).toMatch(/wearable/);
    expect(folded.drivers.join(" ")).toMatch(/sleep/);
  });

  it("leaves the proxy untouched when there's no wearable", () => {
    const a = computeRecovery({ workoutLog: noLog, todaySession: null, now: NOW });
    expect(a.basis).toMatch(/proxy/);
  });
});

describe("anticipations from wearable", () => {
  it("emits a sleep beat when the night was short", () => {
    const res = buildAnticipations({
      twin: null,
      bio: null,
      lifeEvents: [],
      wearable: snap({ sleepHours: 4.5 }),
      now: new Date("2026-06-29T08:00:00"),
    });
    expect(res.anticipations.some((a) => a.id === "wearable_sleep")).toBe(true);
  });
});

describe("WearableSource (manual ingest + consent)", () => {
  it("ingests manual metrics and serves them from cache", async () => {
    const store = new MemoryStore();
    const src = new WearableSource(store, new ConsentRepository(new MemoryStore()));
    const now = new Date("2026-06-29T07:30:00");
    await src.ingest({ sleepHours: 6.2 }, now);
    const got = await src.lastKnown();
    expect(got?.sleepHours).toBe(6.2);
    expect(got?.source).toBe("manual");
  });

  it("getToday returns cache and never reads a native provider without consent", async () => {
    const store = new MemoryStore();
    const consent = new ConsentRepository(new MemoryStore());
    const src = new WearableSource(store, consent);
    const now = new Date("2026-06-29T07:30:00");
    await src.ingest({ sleepHours: 7 }, now);
    // default provider is unavailable; without consent we just serve the cache
    const got = await src.getToday({ now });
    expect(got?.sleepHours).toBe(7);
  });
});

// ============================================================================
// THE DEFAULT PROVIDER
// ============================================================================

/**
 * `WearableSource` used to default to `nullWearableProvider` — a hard-coded
 * "unavailable", forever. It now defaults to `lazyPlatformProvider`, which
 * resolves to Apple HealthKit on iOS and Health Connect on Android.
 *
 * THIS SUITE PINS THAT THE CHANGE IS INERT UNTIL THE NATIVE CUTOVER. Neither
 * native package is a dependency yet, so both providers must fail their guarded
 * require and degrade to exactly the previous behaviour: unavailable, no read,
 * no throw, no permission prompt. "We wired the seam and nothing regressed" is
 * a claim, and this is the thing that makes it checkable.
 *
 * These assertions are expected to CHANGE at the cutover — on a device with the
 * packages installed the platform provider reports something else. That is the
 * point at which someone should be reading
 * docs/companion/health-native-cutover.md rather than editing this file.
 */
describe("the default provider is inert until the native cutover", () => {
  it("reports unavailable under Node, where neither health store exists", async () => {
    const status = await lazyPlatformProvider.getStatus();
    expect(status.permission).toBe("unavailable");
    expect(status.ready).toBe(false);
  });

  it("reads nothing rather than throwing", async () => {
    // A resolver that threw here would take down every screen that awaits a
    // recovery score, which is most of the fitness surface.
    await expect(lazyPlatformProvider.readToday(new Date())).resolves.toBeNull();
  });

  it("requesting access fails soft instead of prompting", async () => {
    const status = await lazyPlatformProvider.requestAccess();
    expect(status.ready).toBe(false);
  });

  it("resolves lazily without a circular-import blowup", async () => {
    // ./providers imports nullWearableProvider from WearableSource as a VALUE,
    // so resolving at module scope would close a require loop and hand one of
    // the two a half-initialised module. Calling through the app-wide singleton
    // is what proves the deferral works in the real graph.
    await expect(wearableSource.getStatus()).resolves.toEqual({
      permission: "unavailable",
      ready: false,
    });
  });
});
