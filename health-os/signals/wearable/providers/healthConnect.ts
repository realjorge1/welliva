/**
 * health-os/signals/wearable/providers/healthConnect.ts
 *
 * The Android Health Connect provider — the counterpart to appleHealth.ts, and
 * the same contract: lazily required, `unavailable` without its module, reads
 * LOCAL-ONLY, never a zero-filled snapshot.
 *
 * ── HOW ANDROID DIFFERS, AND WHY IT'S EASIER ────────────────────────────────
 * Health Connect WILL tell you what was granted. `getGrantedPermissions()`
 * returns the actual set, so unlike HealthKit this provider can distinguish
 * "you said no" from "there is no data", and `getStatus` reports the truth
 * rather than the strongest available guess.
 *
 * It also differs in shape. Sleep is a SESSION with nested stages rather than a
 * pile of overlapping samples, steps come from an aggregate rather than a sum
 * of records, and HRV is `HeartRateVariabilityRmssd` — which is genuinely RMSSD
 * in milliseconds, where HealthKit's is SDNN in seconds. Both feed the same
 * `WearableSnapshot`, so the two are not perfectly comparable across platforms;
 * that is fine and is why `recoveryAdjustment` only ever compares HRV against
 * the SAME DEVICE'S own baseline, never against an absolute threshold.
 *
 * ── DEFENSIVE READS ARE NOT PARANOIA HERE ───────────────────────────────────
 * `react-native-health-connect` changed `readRecords` from returning an array
 * to returning `{ records: [...] }` between major versions, and the package is
 * not a dependency of this repo (see docs/companion/health-native-cutover.md),
 * so the version present at cutover time is not knowable from here. Every
 * result is unwrapped through {@link asRecords}, which accepts both. The cost is
 * six lines; the alternative is a provider that silently reads nothing on half
 * the versions it might meet.
 */

import type { SignalPermission, SignalStatus } from "../../types";
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

interface HealthConnectModule {
  initialize(): Promise<boolean>;
  requestPermission(permissions: unknown[]): Promise<unknown>;
  getGrantedPermissions?(): Promise<unknown>;
  getSdkStatus?(): Promise<number | string>;
  readRecords(recordType: string, options: unknown): Promise<unknown>;
  aggregateRecord?(request: unknown): Promise<unknown>;
}

function loadHealthConnect(): HealthConnectModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-health-connect");
    return (mod?.default ?? mod) as HealthConnectModule;
  } catch {
    return null;
  }
}

/** Everything Welliva asks for. Read-only, always. */
const READ_TYPES = [
  "SleepSession",
  "HeartRateVariabilityRmssd",
  "RestingHeartRate",
  "Steps",
  "ActiveCaloriesBurned",
] as const;

const PERMISSIONS = READ_TYPES.map((recordType) => ({
  accessType: "read" as const,
  recordType,
}));

/** Unwrap both `readRecords` return shapes — see the header. */
function asRecords(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object") {
    const records = (result as { records?: unknown }).records;
    if (Array.isArray(records)) return records as Record<string, unknown>[];
  }
  return [];
}

function toMs(value: unknown): number {
  if (typeof value === "string") return Date.parse(value);
  if (typeof value === "number") return value;
  return Number.NaN;
}

function numeric(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object") {
    // Health Connect wraps some quantities, e.g. { inKilocalories: 412 }.
    for (const k of ["inKilocalories", "inCalories", "inMilliseconds", "value"]) {
      const v = (value as Record<string, unknown>)[k];
      if (typeof v === "number") return v;
    }
  }
  return Number.NaN;
}

/**
 * Health Connect sleep stages, narrowed to "asleep".
 *
 * Stage 1 is AWAKE, 2 is SLEEPING, 3 OUT_OF_BED, 4 LIGHT, 5 DEEP, 6 REM,
 * 7 AWAKE_IN_BED. Only 2/4/5/6 count. Excluding AWAKE_IN_BED is the same
 * judgement HealthKit's `INBED` exclusion makes: time in bed is not sleep.
 */
const ASLEEP_STAGES = new Set([2, 4, 5, 6]);
const ASLEEP_STAGE_NAMES = new Set([
  "SLEEPING",
  "LIGHT",
  "DEEP",
  "REM",
  "STAGE_TYPE_SLEEPING",
  "STAGE_TYPE_LIGHT",
  "STAGE_TYPE_DEEP",
  "STAGE_TYPE_REM",
]);

function isAsleepStage(stage: Record<string, unknown>): boolean {
  const raw = stage.stage;
  if (typeof raw === "number") return ASLEEP_STAGES.has(raw);
  if (typeof raw === "string") return ASLEEP_STAGE_NAMES.has(raw.toUpperCase());
  return false;
}

/**
 * Sleep sessions → asleep intervals.
 *
 * A session with STAGES is described by its stages; a session WITHOUT them (a
 * manual entry, or a writer that only records totals) is taken whole. Taking
 * both would double-count, which is the overlap problem ../normalize.ts exists
 * to solve — here it is avoided at the source, because Health Connect's nesting
 * makes the relationship explicit where HealthKit's flat list does not.
 */
export function sleepIntervalsFromSessions(
  sessions: Record<string, unknown>[],
): Interval[] {
  const out: Interval[] = [];
  for (const session of sessions) {
    const stages = Array.isArray(session.stages)
      ? (session.stages as Record<string, unknown>[])
      : [];

    if (stages.length > 0) {
      for (const stage of stages) {
        if (!isAsleepStage(stage)) continue;
        out.push({ start: toMs(stage.startTime), end: toMs(stage.endTime) });
      }
    } else {
      out.push({ start: toMs(session.startTime), end: toMs(session.endTime) });
    }
  }
  return out.filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end));
}

function toDatedValues(
  records: Record<string, unknown>[],
  field: string,
): DatedValue[] {
  return records
    .map((r) => ({
      at: toMs(r.time ?? r.endTime ?? r.startTime),
      value: numeric(r[field]),
    }))
    .filter((d) => Number.isFinite(d.at) && Number.isFinite(d.value));
}

function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const BASELINE_DAYS = 30;

/** Pure mapping — everything worth testing. Exported for the test suite. */
export function snapshotFromHealthConnect(
  raw: {
    sleepSessions: Record<string, unknown>[];
    hrv: Record<string, unknown>[];
    restingHr: Record<string, unknown>[];
    steps: number | undefined;
    activeEnergyKcal: number | undefined;
  },
  now: Date,
): WearableSnapshot | null {
  const window = lastNightWindow(now);

  const sleepHours = plausible(
    "sleepHours",
    sleepHoursFromSamples(sleepIntervalsFromSessions(raw.sleepSessions), window),
  );

  // Health Connect's RMSSD is already in milliseconds — no unit rescue needed,
  // unlike HealthKit's seconds-valued SDNN.
  const hrvHistory = toDatedValues(raw.hrv, "heartRateVariabilityMillis");
  const hrHistory = toDatedValues(raw.restingHr, "beatsPerMinute");

  const hrvMs = plausible("hrvMs", latest(hrvHistory)?.value);
  const restingHr = plausible("restingHr", latest(hrHistory)?.value);
  const steps = plausible("steps", raw.steps);
  const activeEnergyKcal = plausible("activeEnergyKcal", raw.activeEnergyKcal);

  const hrvBaselineMs = rollingBaseline(hrvHistory, { now, days: BASELINE_DAYS });
  const restingHrBaselineMs = rollingBaseline(hrHistory, { now, days: BASELINE_DAYS });

  // Same rule as the HealthKit provider: no reading is null, never zeroes.
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
    source: "health_connect",
    fetchedAt: now.toISOString(),
  };
}

function between(start: number, end: number) {
  return {
    timeRangeFilter: {
      operator: "between",
      startTime: new Date(start).toISOString(),
      endTime: new Date(end).toISOString(),
    },
  };
}

export class HealthConnectProvider implements WearableProvider {
  private mod: HealthConnectModule | null | undefined;
  private initialized = false;

  private module(): HealthConnectModule | null {
    if (this.mod === undefined) this.mod = loadHealthConnect();
    return this.mod;
  }

  private async init(): Promise<boolean> {
    const mod = this.module();
    if (!mod) return false;
    if (this.initialized) return true;
    try {
      this.initialized = (await mod.initialize()) !== false;
      return this.initialized;
    } catch {
      // Health Connect isn't installed or is below the minimum SDK.
      return false;
    }
  }

  /**
   * How many of our five record types were granted.
   *
   * PARTIAL GRANTS ARE NORMAL on Android — the permission sheet is per record
   * type and people routinely allow steps while declining heart data. So this
   * is a count rather than a boolean, and any grant at all makes the source
   * ready: reading three of five metrics is much better than reading none, and
   * the snapshot is sparse by design.
   */
  private async grantedCount(): Promise<number> {
    const mod = this.module();
    if (!mod?.getGrantedPermissions) return 0;
    try {
      const granted = asRecords(await mod.getGrantedPermissions());
      return granted.filter(
        (p) =>
          p.accessType === "read" &&
          typeof p.recordType === "string" &&
          (READ_TYPES as readonly string[]).includes(p.recordType),
      ).length;
    } catch {
      return 0;
    }
  }

  async getStatus(): Promise<SignalStatus> {
    if (!this.module()) return { permission: "unavailable", ready: false };
    if (!(await this.init())) return { permission: "unavailable", ready: false };
    const granted = await this.grantedCount();
    const permission: SignalPermission = granted > 0 ? "granted" : "undetermined";
    return { permission, ready: granted > 0 };
  }

  async requestAccess(): Promise<SignalStatus> {
    const mod = this.module();
    if (!mod) return { permission: "unavailable", ready: false };
    if (!(await this.init())) return { permission: "unavailable", ready: false };
    try {
      await mod.requestPermission(PERMISSIONS);
    } catch {
      return { permission: "denied", ready: false };
    }
    const granted = await this.grantedCount();
    return granted > 0
      ? { permission: "granted", ready: true }
      : { permission: "denied", ready: false };
  }

  private async read(recordType: string, start: number, end: number) {
    const mod = this.module();
    if (!mod) return [];
    try {
      return asRecords(await mod.readRecords(recordType, between(start, end)));
    } catch {
      // A single declined record type must not take the other four down.
      return [];
    }
  }

  private async aggregate(
    recordType: string,
    start: number,
    end: number,
    fields: string[],
  ): Promise<number | undefined> {
    const mod = this.module();
    if (!mod?.aggregateRecord) return undefined;
    try {
      const res = (await mod.aggregateRecord({
        recordType,
        ...between(start, end),
      })) as Record<string, unknown> | null;
      if (!res) return undefined;
      for (const f of fields) {
        const v = numeric(res[f]);
        if (Number.isFinite(v)) return v;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  async readToday(now: Date): Promise<WearableSnapshot | null> {
    if (!this.module()) return null;
    if (!(await this.init())) return null;
    if ((await this.grantedCount()) === 0) return null;

    const window = lastNightWindow(now);
    const baselineStart = now.getTime() - BASELINE_DAYS * 86_400_000;
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const [sleepSessions, hrv, restingHr, steps, activeEnergyKcal] = await Promise.all([
      this.read("SleepSession", window.start, window.end),
      this.read("HeartRateVariabilityRmssd", baselineStart, now.getTime()),
      this.read("RestingHeartRate", baselineStart, now.getTime()),
      this.aggregate("Steps", dayStart.getTime(), now.getTime(), [
        "COUNT_TOTAL",
        "count",
      ]),
      this.aggregate("ActiveCaloriesBurned", dayStart.getTime(), now.getTime(), [
        "ACTIVE_CALORIES_TOTAL",
        "energy",
      ]),
    ]);

    return snapshotFromHealthConnect(
      { sleepSessions, hrv, restingHr, steps, activeEnergyKcal },
      now,
    );
  }
}
