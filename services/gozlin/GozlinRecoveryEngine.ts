/**
 * GOZLIN — Recovery Intelligence (Phase 2 §8).
 *
 * A lightweight, transparent readiness signal. Welliva has no wearables, so this
 * is honestly a *training-load & density* proxy (not HRV/sleep) — and the output
 * says so in `basis`. Future sleep/HRV/soreness inputs slot in behind the same
 * RecoveryState interface as extra penalties/bonuses, with no downstream changes.
 *
 * Pure & deterministic: same inputs (with injected `now`) → same RecoveryState.
 */

import type { WorkoutLogEntry, WorkoutSession } from "../../models/workout";
import { parseLocalDate, todayDate, toLocalDateString } from "../OfflineStorage";
// Type-only import from the substrate (erased at runtime — no cycle).
import type { WearableSnapshot } from "@/health-os";
import { recoveryAdjustment, wearableBasis } from "@/health-os";
import type { RecoveryLevel, RecoveryState } from "./gozlin.types";

export interface RecoveryInput {
  workoutLog: WorkoutLogEntry[];
  todaySession: WorkoutSession | null;
  /**
   * Real wearable metrics (sleep / HRV / resting HR), when connected. When present, the
   * training-load proxy becomes a true readiness signal — the engine folds the wearable
   * adjustment into the score and says so in `basis`. Absent = unchanged proxy behaviour.
   */
  wearable?: WearableSnapshot | null;
  now?: Date;
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

  const score = Math.round(clamp(100 - penalty + restBonus + adjDelta, 0, 100));
  const level = levelFor(score);

  // ── Drivers (explainability) ──
  const drivers: string[] = [];
  // Wearable drivers lead — they're the strongest, most personal signal.
  if (wearableAdj?.hasSignal) drivers.push(...wearableAdj.drivers);
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

  return {
    score,
    level,
    drivers,
    recommendation,
    basis: wearableAdj?.hasSignal
      ? wearableBasis(input.wearable!)
      : "training-load proxy (no wearable data yet)",
  };
}
