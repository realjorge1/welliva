/**
 * GOZLIN — Recovery Intelligence (Phase 2 §8).
 *
 * A lightweight, transparent readiness signal. At its core a training BATTERY:
 * sessions drain it by the minutes trained, the hours since recharge it, and
 * experience sets how fast both happen (see BATTERY). Two folds sit on top: a
 * wearable's sleep/HRV when one is connected, and the day's check-in (hours
 * slept, "Tired"/"Drained") when one was logged. `basis` always says which of
 * these the score actually used.
 *
 * Pure & deterministic: same inputs (with injected `now`) → same RecoveryState.
 */

import type { ExerciseLevel } from "../../models/user";
import type { WorkoutLogEntry, WorkoutSession } from "../../models/workout";
import { parseLocalDate, todayDate, toLocalDateString } from "../OfflineStorage";
// Type-only import from the substrate (erased at runtime — no cycle).
import type { WearableSnapshot } from "@/health-os";
import { recoveryAdjustment, wearableBasis } from "@/health-os";
import type { GozlinCheckin, RecoveryLevel, RecoveryState } from "./gozlin.types";

export interface RecoveryInput {
  workoutLog: WorkoutLogEntry[];
  todaySession: WorkoutSession | null;
  /**
   * How experienced they are, which sets how hard a minute of training hits
   * the battery and how fast it comes back. Absent = beginner: the default the
   * rest of the app uses for an unknown level, and the one that errs toward rest.
   */
  exerciseLevel?: ExerciseLevel | null;
  /**
   * Real wearable metrics (sleep / HRV / resting HR), when connected. When present, the
   * training-load proxy becomes a true readiness signal — the engine folds the wearable
   * adjustment into the score and says so in `basis`. Absent = unchanged proxy behaviour.
   */
  wearable?: WearableSnapshot | null;
  /**
   * The state-of-mind log. Today's entry says how long they slept and what
   * they felt — "Drained", "Tired" — which is the one readiness signal most
   * users without a watch actually give us. See checkinAdjustment.
   */
  checkins?: GozlinCheckin[] | null;
  now?: Date;
}

const HOUR_MS = 3_600_000;

// ── The battery ─────────────────────────────────────────────────────────────
//
// Recovery used to be a tally of the last three calendar days: every session
// cost a flat 8–26 points whenever it happened, then stopped counting at
// midnight on the third day. Two hours cost barely more than twenty minutes, a
// beginner paid what an athlete paid, and the score moved at midnight instead
// of coming back as the hours passed.
//
// It is a battery now. A session drains it by the minutes trained, every hour
// without training recharges it at a steady rate, and both rates depend on
// experience: the same hour takes more out of someone new to it, and they take
// longer to get it back. Back-to-back hard days need no rule of their own —
// they simply never give the battery time to fill.

interface BatteryRates {
  /** Minutes of fully completed training that empty a full battery. */
  drainMinutes: number;
  /** Points recharged per hour without training. */
  rechargePerHour: number;
}

/**
 * Anchored on each level's usual session (30 / 45 / 60 min, durationFromLevel
 * in WorkoutGenerator). Each costs about 40 points, so anyone finishing their
 * normal session lands in amber: done for now, not done for the week. It comes
 * back in about a day: 25 h for a beginner, 20 h for a regular, 17 h for an
 * experienced trainee. Twice the usual session costs about 80 and takes about
 * two days.
 */
const BATTERY: Record<ExerciseLevel, BatteryRates> = {
  beginner: { drainMinutes: 75, rechargePerHour: 1.6 },
  intermediate: { drainMinutes: 110, rechargePerHour: 2 },
  advanced: { drainMinutes: 150, rechargePerHour: 2.4 },
};

/** The usual session length, standing in for a log entry with no duration. */
const USUAL_MINUTES: Record<ExerciseLevel, number> = {
  beginner: 30,
  intermediate: 45,
  advanced: 60,
};

/**
 * How far back the battery looks. The slowest full recharge (a beginner, from
 * empty) takes under three days, so a week covers every session that can still
 * matter, and starting full a week ago stops a small daily shortfall from
 * compounding without end.
 */
const BATTERY_WINDOW_MS = 7 * 24 * HOUR_MS;

/**
 * When a session ended. An entry with no usable timestamp counts as that
 * evening, but never later than now: a session logged this morning can't be
 * waiting until 6pm to cost anything.
 */
function sessionEnd(l: WorkoutLogEntry, nowMs: number): number {
  const stamped = Date.parse(l.completedAt);
  if (Number.isFinite(stamped)) return Math.min(stamped, nowMs);
  const evening = parseLocalDate(l.date);
  evening.setHours(18, 0, 0, 0);
  return Math.min(evening.getTime(), nowMs);
}

/**
 * The minutes a session logged, and how many of them count against the
 * battery. Half always count, since time in a session is work; the other half
 * scale with how much of it was completed, so a session left open and abandoned
 * doesn't count as an hour of training.
 */
function sessionLoad(
  l: WorkoutLogEntry,
  level: ExerciseLevel,
): { minutes: number; draining: number } {
  const minutes =
    Number.isFinite(l.durationMinutes) && l.durationMinutes >= 0
      ? Math.round(l.durationMinutes)
      : USUAL_MINUTES[level];
  const done = Number.isFinite(l.completionPercent) ? clamp(l.completionPercent / 100, 0, 1) : 1;
  return { minutes, draining: minutes * (0.5 + 0.5 * done) };
}

interface Battery {
  /** 0–100, before the wearable and check-in folds. */
  charge: number;
  /** When it is full again (epoch ms), or null when it already is. */
  fullAt: number | null;
  /** The sessions it is still recharging from: every one since it was last full. */
  owed: { minutes: number; endedAt: number }[];
}

function runBattery(log: WorkoutLogEntry[], level: ExerciseLevel, nowMs: number): Battery {
  const { drainMinutes, rechargePerHour } = BATTERY[level];
  const since = nowMs - BATTERY_WINDOW_MS;
  const sessions = log
    .map((l) => ({ endedAt: sessionEnd(l, nowMs), ...sessionLoad(l, level) }))
    .filter((s) => s.endedAt > since && s.draining > 0)
    .sort((a, b) => a.endedAt - b.endedAt);

  let charge = 100;
  let at = since;
  let owed: Battery["owed"] = [];
  const rechargeUntil = (t: number) => {
    charge = Math.min(100, charge + ((t - at) / HOUR_MS) * rechargePerHour);
    if (charge >= 100) owed = [];
    at = t;
  };
  for (const s of sessions) {
    rechargeUntil(s.endedAt);
    charge = Math.max(0, charge - (s.draining / drainMinutes) * 100);
    owed.push({ minutes: s.minutes, endedAt: s.endedAt });
  }
  rechargeUntil(nowMs);

  return {
    charge,
    fullAt: charge >= 100 ? null : nowMs + ((100 - charge) / rechargePerHour) * HOUR_MS,
    owed,
  };
}

function ago(ms: number): string {
  const hours = ms / HOUR_MS;
  if (hours < 1) return "within the last hour";
  if (hours < 24) {
    const n = Math.round(hours);
    return `${n} hour${n === 1 ? "" : "s"} ago`;
  }
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** The battery's line in the drivers: what it is still recharging from. */
function batteryDriver(owed: Battery["owed"], nowMs: number): string | null {
  if (owed.length === 0) return null;
  if (owed.length === 1) {
    const s = owed[0];
    return `still recharging from a ${s.minutes}-min session ${ago(nowMs - s.endedAt)}`;
  }
  const total = owed.reduce((sum, s) => sum + s.minutes, 0);
  return `still recharging from ${owed.length} sessions (${total} min) since you were last fully recharged`;
}

// ── Self-report fold ────────────────────────────────────────────────────────
//
// Recovery used to be training load alone for anyone without a watch. Someone
// who logged "4 hours, Drained" at breakfast was told they had fresh legs,
// because they hadn't trained in two days — the score contradicted the one
// thing they had just told us. Self-report is noisier than a sensor, so it is
// weighted a little below the wearable's bands and never overrides it.

/** A feeling logged longer ago than this is yesterday's, not this morning's. */
const FEELING_FRESH_MS = 18 * HOUR_MS;

/** Labels that describe the body running low, not a mood. */
const FATIGUE_LABELS = new Set(["Tired", "Drained"]);
/** Load-under-pressure labels. Stress costs recovery, but less than exhaustion. */
const PRESSURE_LABELS = new Set(["Stressed", "Overwhelmed", "Anxious", "Worried"]);

interface CheckinAdjustment {
  delta: number;
  /**
   * A ceiling, not a penalty. Rested legs max the battery out, so a
   * subtraction alone left "4 hours, Drained" reading green. When they say
   * they are running on empty, the level follows what they said, however
   * fresh the training log looks.
   */
  cap?: number;
  drivers: string[];
  /** The drivers that cost points, in the same order. */
  against: string[];
  used: ("sleep" | "feeling")[];
}

/** Level ceilings (see levelFor): both land in amber, the two together lower. */
const CAP_SHORT_NIGHT = 60;
const CAP_FATIGUE = 65;
const CAP_BOTH = 50;

function fmtHours(h: number): string {
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

function checkinAdjustment(
  checkins: GozlinCheckin[],
  today: string,
  nowMs: number,
  wearableHasSleep: boolean,
): CheckinAdjustment {
  let delta = 0;
  const drivers: string[] = [];
  const against: string[] = [];
  const used: CheckinAdjustment["used"] = [];
  const cost = (points: number, driver: string) => {
    delta -= points;
    drivers.push(driver);
    against.push(driver);
  };

  // Sleep: last night's, from TODAY's daily entry only — yesterday's entry is
  // the night before. A measured night from a wearable wins outright.
  const daily = checkins.find((c) => c.date === today && (c.kind ?? "daily") === "daily");
  const h = daily?.sleepHours;
  if (!wearableHasSleep && typeof h === "number" && Number.isFinite(h) && h > 0) {
    used.push("sleep");
    if (h < 5) {
      cost(15, `you logged ${fmtHours(h)}h sleep`);
    } else if (h < 6) {
      cost(8, `you logged ${fmtHours(h)}h sleep (short)`);
    } else if (h < 7) {
      cost(3, `you logged ${fmtHours(h)}h sleep`);
    } else if (h >= 8) {
      delta += 5;
      drivers.push(`you logged ${fmtHours(h)}h sleep`);
    }
  }

  // Feeling: the most recent entry of any kind, if it is still this morning's
  // or last night's. Daily and momentary alike — "Drained" after work counts.
  const fresh = checkins
    .filter((c) => nowMs - c.createdAt >= 0 && nowMs - c.createdAt <= FEELING_FRESH_MS)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  const labels = fresh?.labels ?? [];
  const fatigue = labels.find((l) => FATIGUE_LABELS.has(l));
  const pressure = labels.find((l) => PRESSURE_LABELS.has(l));
  if (fatigue) {
    used.push("feeling");
    cost(12, `you said you felt ${fatigue.toLowerCase()}`);
  } else if (pressure) {
    used.push("feeling");
    cost(6, `you said you felt ${pressure.toLowerCase()}`);
  }

  const shortNight = used.includes("sleep") && typeof h === "number" && h < 5;
  const cap =
    shortNight && fatigue
      ? CAP_BOTH
      : shortNight
        ? CAP_SHORT_NIGHT
        : fatigue
          ? CAP_FATIGUE
          : undefined;

  return {
    delta: clamp(delta, -24, 5),
    ...(cap !== undefined ? { cap } : {}),
    drivers,
    against,
    used,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function levelFor(score: number): RecoveryLevel {
  if (score >= 70) return "green";
  if (score >= 40) return "amber";
  return "red";
}

/**
 * Count consecutive trained days ending today (or yesterday). A "trained day" is
 * any date with a workout log entry.
 */
function consecutiveTrainedDays(trained: Set<string>, today: Date): number {
  let streak = 0;
  const cursor = new Date(today);
  // Allow the streak to count today if trained, otherwise start from yesterday.
  if (!trained.has(toLocalDateString(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (trained.has(toLocalDateString(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeRecovery(input: RecoveryInput): RecoveryState {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const today = input.now ? toLocalDateString(input.now) : todayDate();
  const todayD = parseLocalDate(today);
  const experience: ExerciseLevel =
    input.exerciseLevel && input.exerciseLevel in BATTERY ? input.exerciseLevel : "beginner";

  const trained = new Set(input.workoutLog.map((l) => l.date));

  // ── The battery: what training has taken out, and what the hours since gave back. ──
  const battery = runBattery(input.workoutLog, experience, nowMs);

  // Not scored any more (the battery already pays for back-to-back days), but
  // still named in the drivers: it is the pattern the coach should talk about.
  const density = consecutiveTrainedDays(trained, todayD);

  const yesterday = new Date(todayD);
  yesterday.setDate(todayD.getDate() - 1);
  const restedRecently =
    !trained.has(today) && !trained.has(toLocalDateString(yesterday));

  // ── Wearable fold: real sleep/HRV makes this a true readiness signal (P4). ──
  const wearableAdj = input.wearable ? recoveryAdjustment(input.wearable) : null;
  const adjDelta = wearableAdj?.hasSignal ? wearableAdj.delta : 0;

  // ── Check-in fold: what they told us this morning. ──
  const selfReport = input.checkins?.length
    ? checkinAdjustment(
        input.checkins,
        today,
        nowMs,
        typeof input.wearable?.sleepHours === "number",
      )
    : null;
  // Applied AFTER the load score is clamped: a well-rested night on the
  // wearable can push a full battery past the ceiling, and folding the check-in
  // in before the clamp let that spare swallow it whole.
  const loadScore = clamp(battery.charge + adjDelta, 0, 100);
  let score = Math.round(clamp(loadScore + (selfReport?.delta ?? 0), 0, 100));
  if (selfReport?.cap !== undefined) score = Math.min(score, selfReport.cap);
  const level = levelFor(score);

  // Who is holding the score under 100: a fold (a short night, "Drained") or
  // the battery. Only the battery recharges on a clock, so only it gets a time.
  const foldHolds = adjDelta < 0 || (selfReport?.delta ?? 0) < 0 || selfReport?.cap !== undefined;
  const heldBackBy = foldHolds
    ? (wearableAdj?.hasSignal ? wearableAdj.against[0] : undefined) ?? selfReport?.against[0] ?? null
    : null;
  const fullAt = score < 100 && !foldHolds ? battery.fullAt : null;

  // ── Drivers (explainability) ──
  const drivers: string[] = [];
  // Wearable drivers lead — they're the strongest, most personal signal.
  if (wearableAdj?.hasSignal) drivers.push(...wearableAdj.drivers);
  // Then what they said themselves, ahead of the load arithmetic.
  if (selfReport) drivers.push(...selfReport.drivers);
  const owedLine = batteryDriver(battery.owed, nowMs);
  if (owedLine) drivers.push(owedLine);
  if (density >= 3) drivers.push(`${density} training days in a row`);
  if (restedRecently) drivers.push("rested in the last 2 days");
  if (drivers.length === 0) drivers.push("fully recharged since your last session");

  // ── Recommendation, tuned to today's plan + level ──
  let recommendation: string;
  if (trained.has(today)) {
    // Today's work is done, so "a good day to train at full effort" would be
    // advice about a session they have already had.
    recommendation =
      level === "red"
        ? "You've trained today and you're running low. Rest now — this is when it pays off."
        : level === "amber"
          ? "You've trained today. Keep anything else light and let yourself recharge."
          : "You've trained today and still have plenty in the tank — an easy extra session is fine if you want one.";
  } else if (level === "red") {
    recommendation = input.todaySession
      ? "Consider active recovery today — a walk or mobility over a hard session."
      : "Good day to rest. Recovery is where the progress sticks.";
  } else if (level === "amber") {
    recommendation = input.todaySession
      ? "You're okay to train — keep intensity moderate and listen to your body."
      : "A light, optional session is fine if you feel up to it.";
  } else {
    recommendation = input.todaySession
      ? "Well recovered — a good day to train at full effort."
      : "Fresh legs. If you want a bonus session, your body can take it.";
  }

  const loadBasis = wearableAdj?.hasSignal
    ? wearableBasis(input.wearable!)
    : "training-load proxy (no wearable data yet)";
  const told = selfReport?.used.length
    ? `your check-in (${selfReport.used.map((u) => (u === "sleep" ? "sleep" : "how you felt")).join(", ")})`
    : null;

  return {
    score,
    level: level,
    drivers,
    recommendation,
    basis: !told
      ? loadBasis
      : wearableAdj?.hasSignal
        ? `${loadBasis} + ${told}`
        : `training load + ${told} (no wearable)`,
    fullAt,
    heldBackBy,
  };
}
