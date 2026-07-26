/**
 * BODY LOG SERVICE
 *
 * The persistence + math for the user's actual body data — weigh-ins and tape
 * measurements. This is the empirical ground truth the Transformation Forecast
 * trusts over the energy-balance prediction: when the scale and the math
 * disagree, the scale wins.
 *
 * Pure & offline-first (AsyncStorage via OfflineStorage). All "today" logic is
 * local time. Reads/writes the single `@welliva_body_logs` key reserved in the
 * storage schema (previously declared but unwired).
 */

import type { BodyLogEntry } from "../models/workout";
import { KEYS, parseLocalDate, readJSON, toLocalDateString, writeJSON } from "./OfflineStorage";

// ── Persistence ─────────────────────────────────────────────────────

/** All weigh-ins, ascending by date. */
export async function loadBodyLogs(): Promise<BodyLogEntry[]> {
  const logs = await readJSON<BodyLogEntry[]>(KEYS.BODY_LOGS, []);
  return sortAsc(logs);
}

/**
 * Add (or replace) a weigh-in. One entry per calendar day — re-logging the same
 * day overwrites it so the trend never double-counts a day. Returns the new list.
 */
export async function addBodyLog(entry: BodyLogEntry): Promise<BodyLogEntry[]> {
  const existing = await loadBodyLogs();
  const deduped = existing.filter((e) => e.date !== entry.date);
  const next = sortAsc([...deduped, entry]);
  await writeJSON(KEYS.BODY_LOGS, next);
  return next;
}

function sortAsc(logs: BodyLogEntry[]): BodyLogEntry[] {
  return [...logs].sort((a, b) => a.date.localeCompare(b.date));
}

// ── Derived reads ───────────────────────────────────────────────────

/** Most recent recorded weight, or null if never weighed in. */
export function latestWeight(logs: BodyLogEntry[]): number | null {
  if (logs.length === 0) return null;
  return sortAsc(logs)[logs.length - 1].weightKg;
}

/** Earliest recorded weight (the journey's starting line), or null. */
export function startWeight(logs: BodyLogEntry[]): number | null {
  if (logs.length === 0) return null;
  return sortAsc(logs)[0].weightKg;
}

/** Most recent weigh-in date (YYYY-MM-DD), or null. */
export function lastWeighInDate(logs: BodyLogEntry[]): string | null {
  if (logs.length === 0) return null;
  return sortAsc(logs)[logs.length - 1].date;
}

export interface WeightTrend {
  /** Signed kg/week from a least-squares fit (negative = losing). Null if <2 points. */
  perWeek: number | null;
  /** Number of weigh-ins used. */
  points: number;
  /** Days spanned by the fit window (first → last used point). */
  spanDays: number;
  /** Goodness-of-fit 0–1 (R²) — how cleanly the points fall on the line. */
  fit: number;
}

const DAY_MS = 86_400_000;

/**
 * Least-squares weight trend (kg/week) over weigh-ins within `windowDays` of
 * `today`. A regression — not just last-minus-first — so a single noisy weigh-in
 * (water weight, a heavy meal) can't whipsaw the projection. Returns R² so the
 * forecast can down-weight a scattered, low-confidence trend.
 */
export function computeWeightTrend(
  logs: BodyLogEntry[],
  today: string,
  windowDays = 28,
): WeightTrend {
  const end = parseLocalDate(today);
  const cutoff = new Date(end);
  cutoff.setDate(end.getDate() - windowDays);

  const pts = sortAsc(logs)
    .filter((l) => {
      const d = parseLocalDate(l.date);
      return d >= cutoff && d <= end;
    })
    .map((l) => ({ t: parseLocalDate(l.date).getTime() / DAY_MS, w: l.weightKg }));

  if (pts.length < 2) {
    return { perWeek: null, points: pts.length, spanDays: 0, fit: 0 };
  }

  const spanDays = Math.round(pts[pts.length - 1].t - pts[0].t);

  // Center time on the first point for numerical stability.
  const t0 = pts[0].t;
  const xs = pts.map((p) => p.t - t0);
  const ys = pts.map((p) => p.w);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }

  if (sxx === 0) {
    // All weigh-ins on the same day — no slope to read.
    return { perWeek: null, points: n, spanDays, fit: 0 };
  }

  const slopePerDay = sxy / sxx; // kg/day
  const fit = syy === 0 ? 1 : Math.max(0, Math.min(1, (sxy * sxy) / (sxx * syy))); // R²

  return {
    perWeek: Math.round(slopePerDay * 7 * 100) / 100,
    points: n,
    spanDays,
    fit: Math.round(fit * 100) / 100,
  };
}

/** Convenience for callers that just want a `YYYY-MM-DD` stamped entry today. */
export function makeWeighIn(
  weightKg: number,
  opts: { waistCm?: number; notes?: string; now?: Date } = {},
): BodyLogEntry {
  const date = toLocalDateString(opts.now ?? new Date());
  return {
    date,
    weightKg,
    ...(opts.waistCm != null ? { waistCm: opts.waistCm } : {}),
    ...(opts.notes ? { notes: opts.notes } : {}),
  };
}
