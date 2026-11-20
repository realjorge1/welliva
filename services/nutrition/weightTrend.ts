/**
 * WEIGHT TREND — the weight her target is calculated from, read off the scale
 * without being fooled by it.
 *
 * A single weigh-in carries ±0.5–1 kg of water, glycogen and gut content, so a
 * target that followed raw readings would twitch every morning. This is a
 * time-aware exponentially weighted trend (the "trend weight" MacroFactor and
 * Libra/Happy Scale show): each reading pulls the trend about 10% of the way
 * per day since the last one, so a reading after a long gap counts for more.
 *
 * Three guards, each with its reason:
 *  - SANITY: 25–400 kg. Outside it the reading is a typo (760 for 76.0) and is
 *    dropped entirely.
 *  - TYPO GUARD: a reading further from the trend than a real body can move in
 *    the time since (OUTLIER_KG plus a little per day) is HELD. It is used only
 *    if a second reading within HOLD_DAYS agrees with it; otherwise it is
 *    dropped. One noisy reading never moves a target.
 *  - NOISY DAYS (the cycle tracker's "water, not fat" days) count at a quarter
 *    of the usual pull — down-weighted, never invented away, the same rule as
 *    the learning filter's NOISY_SCALE_FACTOR.
 *
 * An EXPLICIT entry (typed on the Profile as "this is my weight") restarts the
 * trend at that value: she corrected the number on purpose, and that wins.
 *
 * Pure: no storage, no clock. Dates are YYYY-MM-DD, local.
 */
import { NOISY_SCALE_FACTOR } from "../../health-os/learning/tdee";

/** Share of the gap to a new reading the trend closes per day elapsed. */
export const TREND_ALPHA_PER_DAY = 0.1;
/** Readings outside this range are typos, not bodies. */
export const SANE_MIN_KG = 25;
export const SANE_MAX_KG = 400;
/** A jump past this (plus REAL_KG_PER_DAY per day since the trend) is held as a possible typo. */
export const OUTLIER_KG = 5;
/** The fastest a body plausibly really changes, kg/day, for the outlier allowance. */
export const REAL_KG_PER_DAY = 0.2;
/** A held reading needs a second, agreeing reading within this many days. */
export const HOLD_DAYS = 3;
/** "Agreeing": the second reading within this distance of the held one. */
export const AGREE_KG = 2;

export interface WeighInPoint {
  date: string;
  kg: number;
  explicit?: boolean;
}

export interface TrendResult {
  /** The trend weight after the last usable reading, or null with none. */
  trendKg: number | null;
  /** Date of the last reading that moved (or set) the trend. */
  asOf: string | null;
  /** The trend as it stood after each reading that moved it, oldest first. */
  path: { date: string; trendKg: number }[];
  /** Readings dropped as typos or never confirmed. */
  rejected: WeighInPoint[];
}

const dayNum = (date: string): number => {
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The trend through a set of weigh-ins. Order doesn't matter (sorted here);
 * one reading per date is the store's rule, and a second for the same date is
 * read as a re-weigh (the later in the list wins).
 */
export function weightTrend(
  readings: readonly WeighInPoint[],
  opts: { noisyDates?: ReadonlySet<string> | readonly string[] } = {},
): TrendResult {
  const noisy = new Set(opts.noisyDates ?? []);
  const byDate = new Map<string, WeighInPoint>();
  const rejected: WeighInPoint[] = [];
  for (const r of readings) {
    if (!r || typeof r.kg !== "number" || !Number.isFinite(r.kg) || !r.date) continue;
    if (r.kg < SANE_MIN_KG || r.kg > SANE_MAX_KG) {
      rejected.push(r);
      continue;
    }
    byDate.set(r.date, r);
  }
  let points = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // An explicit entry restarts the trend: everything before it is history.
  const lastExplicit = points.map((p) => !!p.explicit).lastIndexOf(true);
  if (lastExplicit > 0) points = points.slice(lastExplicit);

  const path: TrendResult["path"] = [];
  let trend: number | null = null;
  let asOf: string | null = null;
  let held: WeighInPoint | null = null;

  const pull = (p: WeighInPoint, from: string | null) => {
    if (trend === null || from === null || p.explicit) {
      trend = p.kg;
    } else {
      const days = Math.max(1, dayNum(p.date) - dayNum(from));
      let a = 1 - Math.pow(1 - TREND_ALPHA_PER_DAY, days);
      if (noisy.has(p.date)) a /= NOISY_SCALE_FACTOR;
      trend = trend + a * (p.kg - trend);
    }
    asOf = p.date;
    path.push({ date: p.date, trendKg: round2(trend) });
  };

  for (const p of points) {
    if (trend === null || asOf === null) {
      pull(p, null);
      continue;
    }
    // A held reading that has waited too long without a second opinion is dropped.
    if (held && dayNum(p.date) - dayNum(held.date) > HOLD_DAYS) {
      rejected.push(held);
      held = null;
    }
    const allowed = OUTLIER_KG + REAL_KG_PER_DAY * Math.max(0, dayNum(p.date) - dayNum(asOf));
    const jump = Math.abs(p.kg - trend);
    if (jump <= allowed) {
      // An ordinary reading. A held one it doesn't agree with stays held until
      // its window closes (above), then goes.
      pull(p, asOf);
      continue;
    }
    if (held && Math.abs(p.kg - held.kg) <= AGREE_KG) {
      // Two readings agree on the new level: it's real. Both count, in order.
      const confirmed: WeighInPoint = held;
      held = null;
      pull(confirmed, asOf);
      pull(p, asOf);
      continue;
    }
    if (held) rejected.push(held);
    held = p;
  }
  // A reading still held here is waiting for a second opinion: it does not
  // move the trend yet, and is not counted as rejected until its window closes.

  return { trendKg: trend === null ? null : round2(trend), asOf, path, rejected };
}

/** The trend as it stood on `date` (the last point at or before it), or null. */
export function trendOn(result: TrendResult, date: string): number | null {
  let out: number | null = null;
  for (const p of result.path) {
    if (p.date > date) break;
    out = p.trendKg;
  }
  return out;
}
