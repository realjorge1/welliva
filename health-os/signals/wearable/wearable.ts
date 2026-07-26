/**
 * health-os/signals/wearable/wearable.ts
 *
 * PURE wearable core (no native imports). Defines the normalized `WearableSnapshot`
 * (sleep / HRV / resting HR / steps) and turns it into the recovery adjustment + coach
 * hints that make `GozlinRecoveryEngine` REAL instead of a training-load proxy. The
 * adapter (WearableSource) owns the platform health store; this file owns the meaning.
 *
 * Everything here is deterministic and thresholds-only, so the recovery fold is testable
 * offline. See docs/companion/00-proactive-companion-blueprint.md §3.2 + §4 (P4).
 */

export type WearableSource = "healthkit" | "health_connect" | "manual";

export interface WearableSnapshot {
  /** Local `YYYY-MM-DD` the metrics pertain to (last night / today). */
  date: string;
  /** Hours of sleep last night. */
  sleepHours?: number;
  /** HRV (RMSSD) in ms — higher generally means better recovered. */
  hrvMs?: number;
  /** Resting heart rate (bpm). */
  restingHr?: number;
  steps?: number;
  activeEnergyKcal?: number;
  /** A rolling personal HRV baseline, when known (compared against, never absolute). */
  hrvBaselineMs?: number;
  /** A rolling personal resting-HR baseline. */
  restingHrBaselineMs?: number;
  source: WearableSource;
  /** ISO timestamp the snapshot was read/ingested. */
  fetchedAt: string;
}

export interface RecoveryAdjustment {
  /** Points to add to the training-load recovery score (negative = more fatigued). */
  delta: number;
  /** Human drivers for the explainability trail. */
  drivers: string[];
  /** True once at least one real wearable metric contributed. */
  hasSignal: boolean;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * How real wearable metrics nudge the recovery score. Sleep and HRV-vs-baseline are the
 * load-bearing signals; resting-HR elevation is a softer corroborator. Bounded so a single
 * bad night can flag recovery without erasing the training-load picture entirely.
 */
export function recoveryAdjustment(w: WearableSnapshot): RecoveryAdjustment {
  let delta = 0;
  const drivers: string[] = [];
  let hasSignal = false;

  if (typeof w.sleepHours === "number") {
    hasSignal = true;
    const h = w.sleepHours;
    if (h < 5) {
      delta -= 18;
      drivers.push(`only ${h.toFixed(1)}h sleep last night`);
    } else if (h < 6) {
      delta -= 10;
      drivers.push(`${h.toFixed(1)}h sleep (short)`);
    } else if (h < 7) {
      delta -= 4;
      drivers.push(`${h.toFixed(1)}h sleep`);
    } else if (h >= 8) {
      delta += 6;
      drivers.push(`${h.toFixed(1)}h sleep (well rested)`);
    }
  }

  if (typeof w.hrvMs === "number" && typeof w.hrvBaselineMs === "number" && w.hrvBaselineMs > 0) {
    hasSignal = true;
    const ratio = w.hrvMs / w.hrvBaselineMs;
    if (ratio < 0.8) {
      delta -= 14;
      drivers.push("HRV well below your baseline");
    } else if (ratio < 0.9) {
      delta -= 7;
      drivers.push("HRV a bit below baseline");
    } else if (ratio > 1.1) {
      delta += 6;
      drivers.push("HRV above your baseline");
    }
  }

  if (
    typeof w.restingHr === "number" &&
    typeof w.restingHrBaselineMs === "number" &&
    w.restingHrBaselineMs > 0 &&
    w.restingHr > w.restingHrBaselineMs + 6
  ) {
    hasSignal = true;
    delta -= 5;
    drivers.push("resting heart rate elevated");
  }

  return { delta: clamp(delta, -30, 12), drivers, hasSignal };
}

/** A short basis string describing which real metrics were used (for RecoveryState.basis). */
export function wearableBasis(w: WearableSnapshot): string {
  const parts: string[] = [];
  if (typeof w.sleepHours === "number") parts.push("sleep");
  if (typeof w.hrvMs === "number") parts.push("HRV");
  if (typeof w.restingHr === "number") parts.push("resting HR");
  if (parts.length === 0) return "training-load proxy (no wearable metrics yet)";
  return `training load + ${parts.join(" / ")} from your wearable`;
}

export interface WearableHint {
  kind: "sleep" | "strain";
  title: string;
  message: string;
  priority: number;
}

/** Forward coach hints from a snapshot (short sleep, suppressed HRV). Highest-leverage first. */
export function wearableHints(w: WearableSnapshot): WearableHint[] {
  const out: WearableHint[] = [];

  if (typeof w.sleepHours === "number" && w.sleepHours < 6.5) {
    const severe = w.sleepHours < 5.5;
    out.push({
      kind: "sleep",
      title: severe ? "You're running on little sleep" : "Sleep ran short",
      message: severe
        ? `Only ${w.sleepHours.toFixed(1)}h last night — let's keep today easy: lighter training, steady food, water early, and an earlier night. Pushing hard on a deficit like this rarely pays.`
        : `${w.sleepHours.toFixed(1)}h last night is a little light. I'll keep intensity moderate and we'll aim to bank an earlier night tonight.`,
      priority: severe ? 80 : 64,
    });
  }

  if (typeof w.hrvMs === "number" && typeof w.hrvBaselineMs === "number" && w.hrvBaselineMs > 0) {
    const ratio = w.hrvMs / w.hrvBaselineMs;
    if (ratio < 0.85) {
      out.push({
        kind: "strain",
        title: "Your body's carrying some load",
        message:
          "Your HRV is reading below your normal — a sign your system's still catching up. Let's favour mobility, a walk or easy cardio today over a hard session, and prioritise recovery.",
        priority: 76,
      });
    }
  }

  return out.sort((a, b) => b.priority - a.priority);
}
