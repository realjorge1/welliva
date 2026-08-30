/**
 * health-os/signals/wearable/providers/appleHealth.ts
 *
 * The Apple HealthKit provider — sleep, HRV, resting heart rate, steps and
 * active energy, read LOCALLY and never transmitted. Only the derived recovery
 * score is ever surfaced (see WearableSource).
 *
 * ── THE NATIVE MODULE IS OPTIONAL, AND STAYS OPTIONAL ───────────────────────
 * `react-native-health` is required lazily inside a try/catch, exactly like
 * CalendarSource does with expo-calendar. Absent, this provider reports
 * `unavailable` and every read is a safe no-op — which is the state the app
 * ships in today, byte for byte identical in behaviour to the
 * `nullWearableProvider` it replaces.
 *
 * That is deliberate. Adding HealthKit is a native cutover with a store-review
 * dimension (the entitlement, the usage strings, an App Review question about
 * why a nutrition app reads heart data). Landing the ADAPTER without landing
 * the dependency means the mapping below is written, reviewed and tested now,
 * and the cutover is one `npx expo install` plus a rebuild — with no code left
 * to write at the moment somebody is trying to ship a build.
 * See docs/companion/health-native-cutover.md.
 *
 * ── THE HEALTHKIT SUBTLETY THAT BITES EVERY INTEGRATION ─────────────────────
 * HealthKit DOES NOT TELL YOU WHETHER READ ACCESS WAS GRANTED. By design: the
 * mere fact an app can see that you declined to share heart data is itself
 * information about you. `getAuthStatus` reports write status honestly and read
 * status as "not determined" essentially always.
 *
 * The consequence is that a denied permission and an empty health store are
 * indistinguishable — both are "no samples". So this provider does NOT claim
 * `granted` on the strength of a successful init; it reports `granted` because
 * that is the only thing HealthKit will let it say, and the app's honesty is
 * carried elsewhere: `readToday` returns null rather than a zero-filled
 * snapshot, and WearableSource caches nothing when it gets null. A user who
 * declined sees "no wearable data", not "you took 0 steps".
 *
 * ── EVERYTHING PURE LIVES IN ../normalize.ts ────────────────────────────────
 * Sleep-sample overlap merging, baselines and the plausibility ranges are
 * shared with the Health Connect provider and tested there. This file is the
 * thin, untestable-without-a-device part: talking to the module, and mapping
 * its vocabulary onto ours.
 */

import type { SignalStatus } from "../../types";
import {
  latest,
  lastNightWindow,
  plausible,
  rollingBaseline,
  sleepHoursFromSamples,
  type DatedValue,
  type Interval,
} from "../normalize";
import type { WearableSnapshot } from "../wearable";
import type { WearableProvider } from "../WearableSource";

/**
 * The shape this provider needs from `react-native-health`.
 *
 * Declared structurally rather than imported, because the package is not a
 * dependency — importing its types would break `tsc` for everyone. Every method
 * is optional and every result is read defensively: this is an interface we
 * hope the module satisfies, not one it has promised us.
 */
interface HealthKitModule {
  initHealthKit(
    options: unknown,
    callback: (error: string | null, result?: unknown) => void,
  ): void;
  getSleepSamples?(options: unknown, callback: HealthCallback): void;
  getHeartRateVariabilitySamples?(options: unknown, callback: HealthCallback): void;
  getRestingHeartRateSamples?(options: unknown, callback: HealthCallback): void;
  getStepCount?(options: unknown, callback: HealthCallback): void;
  getActiveEnergyBurned?(options: unknown, callback: HealthCallback): void;
  Constants?: { Permissions?: Record<string, string> };
}

type HealthCallback = (error: string | null, results?: unknown) => void;

/** A raw HealthKit sample, as far as we're willing to assume. */
interface RawSample {
  startDate?: string;
  endDate?: string;
  value?: number | string;
}

function loadHealthKit(): HealthKitModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-health");
    return (mod?.default ?? mod) as HealthKitModule;
  } catch {
    return null;
  }
}

/** Promisify one of the module's callback methods; never rejects. */
function call(
  fn: ((options: unknown, cb: HealthCallback) => void) | undefined,
  options: unknown,
): Promise<unknown[]> {
  if (!fn) return Promise.resolve([]);
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: unknown[]) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    /*
     * A watchdog, because these are CALLBACKS, not promises. If the native side
     * never calls back — which HealthKit does on some permission states — an
     * un-timed promise would leave `getToday` pending forever and the recovery
     * fold would hang the screen that awaited it. Ten seconds, then empty.
     */
    const timer = setTimeout(() => done([]), 10_000);
    try {
      fn(options, (error, results) => {
        clearTimeout(timer);
        if (error) return done([]);
        done(Array.isArray(results) ? results : results === undefined ? [] : [results]);
      });
    } catch {
      clearTimeout(timer);
      done([]);
    }
  });
}

function toMs(value: unknown): number {
  if (typeof value !== "string") return Number.NaN;
  return Date.parse(value);
}

function numeric(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number.NaN;
}

/**
 * HealthKit's sleep vocabulary, narrowed to "was this person asleep".
 *
 * `INBED` is excluded — lying in bed reading is not sleep, and including it is
 * the second-most-common way an integration over-reports a night (the first is
 * failing to merge overlaps; see ../normalize.ts). `ASLEEP` and the three stage
 * values all mean asleep and all overlap each other, which the merge handles.
 */
const ASLEEP_VALUES = new Set([
  "ASLEEP",
  "ASLEEP_UNSPECIFIED",
  "ASLEEP_CORE",
  "ASLEEP_DEEP",
  "ASLEEP_REM",
  "CORE",
  "DEEP",
  "REM",
]);

function isAsleep(sample: RawSample): boolean {
  const v = String(sample.value ?? "").toUpperCase().replace(/[\s-]/g, "_");
  return ASLEEP_VALUES.has(v);
}

/** Samples → intervals, for the pure merger. */
function toIntervals(samples: RawSample[]): Interval[] {
  return samples
    .map((s) => ({ start: toMs(s.startDate), end: toMs(s.endDate) }))
    .filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end));
}

/** Samples → dated scalar readings, for latest-value and baselines. */
function toDatedValues(samples: RawSample[]): DatedValue[] {
  return samples
    .map((s) => ({ at: toMs(s.endDate ?? s.startDate), value: numeric(s.value) }))
    .filter((d) => Number.isFinite(d.at) && Number.isFinite(d.value));
}

/** ISO date string for a Date, in local time — matches WearableSnapshot.date. */
function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * How far back to read for the HRV / resting-HR baselines.
 *
 * 30 days matches `rollingBaseline`'s default window. Reading less would make
 * the baseline unreachable for anyone who doesn't wear their device nightly,
 * and the HRV term of the recovery fold does nothing without one.
 */
const BASELINE_DAYS = 30;

/**
 * Build the snapshot from already-fetched sample sets.
 *
 * Separated from the fetching so the mapping — which is all the logic — can be
 * exercised without a device. Exported for the tests.
 */
export function snapshotFromHealthKit(
  raw: {
    sleep: RawSample[];
    hrv: RawSample[];
    restingHr: RawSample[];
    steps: RawSample[];
    activeEnergy: RawSample[];
  },
  now: Date,
): WearableSnapshot | null {
  const window = lastNightWindow(now);

  const sleepHours = plausible(
    "sleepHours",
    sleepHoursFromSamples(toIntervals(raw.sleep.filter(isAsleep)), window),
  );

  const hrvHistory = toDatedValues(raw.hrv);
  const hrHistory = toDatedValues(raw.restingHr);

  /*
   * HealthKit reports HRV (SDNN) in SECONDS. `recoveryAdjustment` compares
   * against a baseline computed from the same feed, so a consistent unit error
   * would cancel out in the ratio — but the number is also shown to the user and
   * checked against a 5–300 ms plausibility range, both of which would break.
   * Values under 1 are seconds; anything larger is already milliseconds.
   */
  const toMsIfSeconds = (v: number) => (v > 0 && v < 1 ? v * 1000 : v);
  const hrvMsHistory = hrvHistory.map((d) => ({ at: d.at, value: toMsIfSeconds(d.value) }));

  const hrvMs = plausible("hrvMs", latest(hrvMsHistory)?.value);
  const restingHr = plausible("restingHr", latest(hrHistory)?.value);

  /*
   * NO SAMPLES IS NOT ZERO.
   *
   * Summing an empty array gives 0, and 0 steps is inside the plausible range,
   * so a naive reduce turns "HealthKit told us nothing" into "you took no steps
   * today" — which, given HealthKit refuses to report read permission at all
   * (see the header), is exactly what a user who DECLINED would be shown. The
   * sum only happens when there is something to sum.
   */
  const sumSamples = (samples: RawSample[]): number | undefined => {
    const values = samples.map((s) => numeric(s.value)).filter((v) => Number.isFinite(v));
    if (values.length === 0) return undefined;
    return values.reduce((a, b) => a + b, 0);
  };

  const steps = plausible("steps", sumSamples(raw.steps));
  const activeEnergyKcal = plausible("activeEnergyKcal", sumSamples(raw.activeEnergy));

  const hrvBaselineMs = rollingBaseline(hrvMsHistory, { now, days: BASELINE_DAYS });
  const restingHrBaselineMs = rollingBaseline(hrHistory, { now, days: BASELINE_DAYS });

  /*
   * Nothing read means nothing to say. Returning a zero-filled snapshot here is
   * the failure this whole file is careful about: with HealthKit unable to
   * report read-permission, an empty result is exactly what a DECLINED user
   * produces, and writing "0 steps, 0 hours slept" into the cache would state as
   * fact something we were never told. See the header.
   */
  if (
    sleepHours === undefined &&
    hrvMs === undefined &&
    restingHr === undefined &&
    steps === undefined &&
    activeEnergyKcal === undefined
  ) {
    return null;
  }

  return {
    date: localDate(now),
    ...(sleepHours !== undefined ? { sleepHours } : {}),
    ...(hrvMs !== undefined ? { hrvMs } : {}),
    ...(restingHr !== undefined ? { restingHr } : {}),
    ...(steps !== undefined ? { steps: Math.round(steps) } : {}),
    ...(activeEnergyKcal !== undefined
      ? { activeEnergyKcal: Math.round(activeEnergyKcal) }
      : {}),
    ...(hrvBaselineMs !== undefined ? { hrvBaselineMs } : {}),
    ...(restingHrBaselineMs !== undefined ? { restingHrBaselineMs } : {}),
    source: "healthkit",
    fetchedAt: now.toISOString(),
  };
}

/** READ-ONLY. Welliva never writes to a user's health store. */
function permissionSet(mod: HealthKitModule): unknown {
  const P = mod.Constants?.Permissions ?? {};
  const read = [
    P.SleepAnalysis ?? "SleepAnalysis",
    P.HeartRateVariability ?? "HeartRateVariability",
    P.RestingHeartRate ?? "RestingHeartRate",
    P.Steps ?? "Steps",
    P.StepCount ?? "StepCount",
    P.ActiveEnergyBurned ?? "ActiveEnergyBurned",
  ].filter((v, i, a) => a.indexOf(v) === i);
  return { permissions: { read, write: [] } };
}

export class AppleHealthProvider implements WearableProvider {
  private mod: HealthKitModule | null | undefined;
  private initialized = false;

  private module(): HealthKitModule | null {
    if (this.mod === undefined) this.mod = loadHealthKit();
    return this.mod;
  }

  /** Init once per process; resolves false when the module or init fails. */
  private init(): Promise<boolean> {
    const mod = this.module();
    if (!mod) return Promise.resolve(false);
    if (this.initialized) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 10_000);
      try {
        mod.initHealthKit(permissionSet(mod), (error) => {
          clearTimeout(timer);
          this.initialized = !error;
          resolve(!error);
        });
      } catch {
        clearTimeout(timer);
        resolve(false);
      }
    });
  }

  async getStatus(): Promise<SignalStatus> {
    if (!this.module()) return { permission: "unavailable", ready: false };
    // Not yet asked: `undetermined` is honest and stops WearableSource reading.
    if (!this.initialized) return { permission: "undetermined", ready: false };
    // See the header: HealthKit will not report read access, so this is the
    // strongest claim available. An actual refusal shows up as null data.
    return { permission: "granted", ready: true };
  }

  async requestAccess(): Promise<SignalStatus> {
    if (!this.module()) return { permission: "unavailable", ready: false };
    const ok = await this.init();
    return ok
      ? { permission: "granted", ready: true }
      : { permission: "denied", ready: false };
  }

  async readToday(now: Date): Promise<WearableSnapshot | null> {
    const mod = this.module();
    if (!mod) return null;
    if (!(await this.init())) return null;

    const window = lastNightWindow(now);
    const nightRange = {
      startDate: new Date(window.start).toISOString(),
      endDate: new Date(window.end).toISOString(),
    };
    const baselineRange = {
      startDate: new Date(now.getTime() - BASELINE_DAYS * 86_400_000).toISOString(),
      endDate: now.toISOString(),
    };
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayRange = { startDate: dayStart.toISOString(), endDate: now.toISOString() };

    // Issued together: five sequential round trips through the bridge is a
    // visible delay on the screen that awaits this.
    const [sleep, hrv, restingHr, steps, activeEnergy] = await Promise.all([
      call(mod.getSleepSamples?.bind(mod), nightRange),
      call(mod.getHeartRateVariabilitySamples?.bind(mod), baselineRange),
      call(mod.getRestingHeartRateSamples?.bind(mod), baselineRange),
      call(mod.getStepCount?.bind(mod), dayRange),
      call(mod.getActiveEnergyBurned?.bind(mod), dayRange),
    ]);

    return snapshotFromHealthKit(
      {
        sleep: sleep as RawSample[],
        hrv: hrv as RawSample[],
        restingHr: restingHr as RawSample[],
        steps: steps as RawSample[],
        activeEnergy: activeEnergy as RawSample[],
      },
      now,
    );
  }
}
