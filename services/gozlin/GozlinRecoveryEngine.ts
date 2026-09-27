/**
 * GOZLIN — Recovery Intelligence (Phase 2 §8).
 *
 * A lightweight, transparent readiness signal. At its core a *training-load &
 * density* proxy, with two folds on top: a wearable's sleep/HRV when one is
 * connected, and the day's check-in (hours slept, "Tired"/"Drained") when one
 * was logged. `basis` always says which of these the score actually used.
 *
 * Pure & deterministic: same inputs (with injected `now`) → same RecoveryState.
 */

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

// ── Self-report fold ────────────────────────────────────────────────────────
//
// Recovery used to be training load alone for anyone without a watch. Someone
// who logged "4 hours, Drained" at breakfast was told they had fresh legs,
// because they hadn't trained in two days — the score contradicted the one
// thing they had just told us. Self-report is noisier than a sensor, so it is
// weighted a little below the wearable's bands and never overrides it.

/** A feeling logged longer ago than this is yesterday's, not this morning's. */
const FEELING_FRESH_MS = 18 * 3_600_000;

/** Labels that describe the body running low, not a mood. */
const FATIGUE_LABELS = new Set(["Tired", "Drained"]);
/** Load-under-pressure labels. Stress costs recovery, but less than exhaustion. */
const PRESSURE_LABELS = new Set(["Stressed", "Overwhelmed", "Anxious", "Worried"]);

interface CheckinAdjustment {
  delta: number;
  /**
   * A ceiling, not a penalty. Rested legs max the load score out — a rested
   * user starts at 100 plus a rest bonus — so a subtraction alone left "4 hours,
   * Drained" reading green. When they say they are running on empty, the level
   * follows what they said, however fresh the training log looks.
   */
  cap?: number;
  drivers: string[];
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
  const used: CheckinAdjustment["used"] = [];

  // Sleep: last night's, from TODAY's daily entry only — yesterday's entry is
  // the night before. A measured night from a wearable wins outright.
  const daily = checkins.find((c) => c.date === today && (c.kind ?? "daily") === "daily");
  const h = daily?.sleepHours;
  if (!wearableHasSleep && typeof h === "number" && Number.isFinite(h) && h > 0) {
    used.push("sleep");
    if (h < 5) {
      delta -= 15;
      drivers.push(`you logged ${fmtHours(h)}h sleep`);
    } else if (h < 6) {
      delta -= 8;
      drivers.push(`you logged ${fmtHours(h)}h sleep (short)`);
    } else if (h < 7) {
      delta -= 3;
      drivers.push(`you logged ${fmtHours(h)}h sleep`);
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
    delta -= 12;
    drivers.push(`you said you felt ${fatigue.toLowerCase()}`);
  } else if (pressure) {
    used.push("feeling");
    delta -= 6;
    drivers.push(`you said you felt ${pressure.toLowerCase()}`);
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

  return { delta: clamp(delta, -24, 5), ...(cap !== undefined ? { cap } : {}), drivers, used };
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
  const today = input.now ? toLocalDateString(input.now) : todayDate();
  const todayD = parseLocalDate(today);

  const trained = new Set(input.workoutLog.map((l) => l.date));

  // Sessions in the last 3 calendar days (incl. today), with their intensity.
  const recent: WorkoutLogEntry[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(todayD);
    d.setDate(todayD.getDate() - i);
    const ds = toLocalDateString(d);
    for (const l of input.workoutLog) if (l.date === ds) recent.push(l);
  }

  // ── Load penalty: each recent session costs readiness, scaled by intensity. ──
  let penalty = 0;
  for (const s of recent) {
    const intensity = clamp((s.completionPercent ?? 0) / 100, 0, 1);
    const durFactor = clamp((s.durationMinutes ?? 0) / 45, 0, 1.5);
    penalty += 8 + 12 * intensity + 6 * durFactor; // ~8–26 per session
  }

  // ── Density penalty: back-to-back-to-back training without rest. ──
  const density = consecutiveTrainedDays(trained, todayD);
  if (density >= 3) penalty += (density - 2) * 12;

  // ── Rest bonus: no training today or yesterday → recovering. ──
  const yesterday = new Date(todayD);
  yesterday.setDate(todayD.getDate() - 1);
  const restedRecently =
    !trained.has(today) && !trained.has(toLocalDateString(yesterday));
  const restBonus = restedRecently ? 16 : 0;

  // ── Wearable fold: real sleep/HRV makes this a true readiness signal (P4). ──
  const wearableAdj = input.wearable ? recoveryAdjustment(input.wearable) : null;
  const adjDelta = wearableAdj?.hasSignal ? wearableAdj.delta : 0;

  // ── Check-in fold: what they told us this morning. ──
  const selfReport = input.checkins?.length
    ? checkinAdjustment(
        input.checkins,
        today,
        (input.now ?? new Date()).getTime(),
        typeof input.wearable?.sleepHours === "number",
      )
    : null;
  // Applied AFTER the load score is clamped: a rested user's load score sits at
  // the 100 ceiling with bonus to spare, and folding the check-in in before the
  // clamp let the spare bonus swallow it whole.
  const loadScore = clamp(100 - penalty + restBonus + adjDelta, 0, 100);
  let score = Math.round(clamp(loadScore + (selfReport?.delta ?? 0), 0, 100));
  if (selfReport?.cap !== undefined) score = Math.min(score, selfReport.cap);
  const level = levelFor(score);

  // ── Drivers (explainability) ──
  const drivers: string[] = [];
  // Wearable drivers lead — they're the strongest, most personal signal.
  if (wearableAdj?.hasSignal) drivers.push(...wearableAdj.drivers);
  // Then what they said themselves, ahead of the load arithmetic.
  if (selfReport) drivers.push(...selfReport.drivers);
  if (recent.length > 0)
    drivers.push(
      `${recent.length} session${recent.length === 1 ? "" : "s"} in the last 3 days`,
    );
  if (density >= 3) drivers.push(`${density} training days in a row`);
  if (restedRecently) drivers.push("rested in the last 2 days");
  if (drivers.length === 0) drivers.push("light recent training load");

  // ── Recommendation, tuned to today's plan + level ──
  let recommendation: string;
  if (level === "red") {
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
    level,
    drivers,
    recommendation,
    basis: !told
      ? loadBasis
      : wearableAdj?.hasSignal
        ? `${loadBasis} + ${told}`
        : `training load + ${told} (no wearable)`,
  };
}
