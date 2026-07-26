/**
 * CHALLENGE SERVICE — Seasonal / monthly challenges.
 *
 * The longevity engine. Achievements are a finite ladder; challenges are an
 * *infinite, time-boxed* loop — a fresh, themed set every month that gives a
 * years-long user a reason to come back THIS month. "You had to be there"
 * scarcity, the single highest-leverage retention mechanic in live products.
 *
 * It deliberately reuses the achievement stats engine instead of tracking
 * anything new. Each challenge measures a DELTA: when a month begins we snapshot
 * the lifetime `AchievementStats` as a baseline, and a challenge's progress is
 * simply `currentStat − baselineStat`. So "Train 16 times in June" is just
 * `workoutsCompleted` today minus what it was on June 1st — honest, non-gameable,
 * and free of any new persistence beyond the baseline snapshot.
 *
 * The monthly set is generated procedurally from a template pool, seeded by the
 * period key (YYYY-MM). That means it's deterministic — stable all month, the
 * same for every user in a given month (so shared/social challenges drop in
 * later for free) — yet different month to month. No content team required to
 * keep the product fresh for years.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Palette } from "@/constants/theme";
import type { AchievementStats } from "./AchievementService";
import { EMPTY_STATS } from "./AchievementService";

const CHAL_KEY = "@welliva_challenges";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

/**
 * Only CUMULATIVE counters are valid challenge metrics — a delta is meaningful
 * for "meals logged" but nonsense for a point-in-time value like `currentStreak`.
 */
export type ChallengeMetricKey =
  | "workoutsCompleted"
  | "perfectWorkouts"
  | "totalReps"
  | "earlyWorkouts"
  | "mealsLogged"
  | "perfectDays"
  | "proteinGoalDays"
  | "waterGoalDays"
  | "weighIns"
  | "totalActiveDays";

export interface ChallengeDef {
  /** Fully-qualified, period-scoped id: `${periodKey}:${baseId}`. */
  id: string;
  baseId: string;
  periodKey: string; // YYYY-MM
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  metric: ChallengeMetricKey;
  /** Within-month target (delta from the period baseline). */
  target: number;
  points: number;
  accent: string; // hex
  unit?: string;
}

/** Persisted state for the active season. */
export interface ChallengeRecord {
  periodKey: string;
  /** Lifetime stats snapshot captured the moment this period began. */
  baseline: AchievementStats;
  /** challengeId → ISO timestamp first completed. */
  completed: Record<string, string>;
}

export const EMPTY_CHALLENGE_RECORD: ChallengeRecord = {
  periodKey: "",
  baseline: { ...EMPTY_STATS },
  completed: {},
};

export interface EvaluatedChallenge {
  def: ChallengeDef;
  value: number; // capped at target for display
  rawValue: number; // uncapped delta
  target: number;
  progress: number; // 0–1
  completed: boolean;
  completedAt: string | null;
}

export interface ChallengeSummary {
  completedCount: number;
  total: number;
  points: number; // points from completed challenges this season
  maxPoints: number;
  periodLabel: string; // "June 2026"
  seasonTitle: string; // "June Momentum"
  daysLeft: number;
}

// ──────────────────────────────────────────────
// PERIOD HELPERS
// ──────────────────────────────────────────────

export function currentPeriodKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parsePeriod(periodKey: string): { year: number; month: number } {
  const [y, m] = periodKey.split("-").map((n) => parseInt(n, 10));
  return { year: y, month: (m || 1) - 1 };
}

export function periodLabel(periodKey: string): string {
  const { year, month } = parsePeriod(periodKey);
  return `${MONTHS[month] ?? "—"} ${year}`;
}

/** Days remaining in the period (inclusive of today). */
export function daysLeftInPeriod(
  periodKey: string,
  now: Date = new Date(),
): number {
  const { year, month } = parsePeriod(periodKey);
  const lastDay = new Date(year, month + 1, 0).getDate();
  if (currentPeriodKey(now) !== periodKey) return 0;
  return Math.max(0, lastDay - now.getDate() + 1);
}

/** A themed name per month so each season feels distinct. */
const SEASON_THEMES = [
  "Fresh Start", "Heart & Hustle", "Spring Forward", "Bloom",
  "Momentum", "Midyear Mountain", "Peak Summer", "Relentless August",
  "Sharpen", "Harvest Strength", "Foundations", "Year-End Finish",
];

export function seasonTitle(periodKey: string): string {
  const { month } = parsePeriod(periodKey);
  return SEASON_THEMES[month] ?? "Challenge";
}

// ──────────────────────────────────────────────
// SEEDED PROCEDURAL GENERATION
// ──────────────────────────────────────────────

/** Deterministic 32-bit hash of a string → seed. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — tiny, good-enough deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Template {
  baseId: string;
  title: (t: number) => string;
  description: (t: number) => string;
  icon: keyof typeof Ionicons.glyphMap;
  metric: ChallengeMetricKey;
  target: number;
  points: number;
  accent: string;
  unit?: string;
}

/**
 * The template pool. Targets are tuned to be a genuine month's stretch for a
 * committed user — reachable, but not a gimme. The generator picks a varied
 * few each month.
 */
const TEMPLATES: Template[] = [
  {
    baseId: "train",
    title: (t) => `Train ${t} times`,
    description: (t) => `Complete ${t} workouts before the month is out.`,
    icon: "barbell",
    metric: "workoutsCompleted",
    target: 16,
    points: 40,
    accent: Palette.fat,
  },
  {
    baseId: "reps",
    title: (t) => `Push ${t.toLocaleString()} reps`,
    description: (t) => `Rack up ${t.toLocaleString()} reps across your sessions.`,
    icon: "repeat",
    metric: "totalReps",
    target: 12000,
    points: 35,
    accent: Palette.fat,
    unit: "reps",
  },
  {
    baseId: "flawless",
    title: (t) => `${t} flawless workouts`,
    description: (t) => `Finish ${t} workouts at 100% completion.`,
    icon: "ribbon",
    metric: "perfectWorkouts",
    target: 8,
    points: 40,
    accent: Palette.protein,
  },
  {
    baseId: "early",
    title: (t) => `${t} sunrise sessions`,
    description: (t) => `Knock out ${t} workouts before 9am.`,
    icon: "sunny",
    metric: "earlyWorkouts",
    target: 6,
    points: 35,
    accent: Palette.calories,
  },
  {
    baseId: "meals",
    title: (t) => `Log ${t} meals`,
    description: (t) => `Track ${t} meals on your plan this month.`,
    icon: "restaurant",
    metric: "mealsLogged",
    target: 90,
    points: 30,
    accent: Palette.protein,
    unit: "meals",
  },
  {
    baseId: "perfectdays",
    title: (t) => `${t} perfect plates`,
    description: (t) => `Eat every planned meal on ${t} separate days.`,
    icon: "star",
    metric: "perfectDays",
    target: 10,
    points: 45,
    accent: Palette.gold,
    unit: "days",
  },
  {
    baseId: "protein",
    title: (t) => `${t} protein days`,
    description: (t) => `Hit your protein target on ${t} days.`,
    icon: "egg",
    metric: "proteinGoalDays",
    target: 18,
    points: 35,
    accent: Palette.protein,
    unit: "days",
  },
  {
    baseId: "water",
    title: (t) => `${t} hydration days`,
    description: (t) => `Reach your daily water goal on ${t} days.`,
    icon: "water",
    metric: "waterGoalDays",
    target: 20,
    points: 30,
    accent: Palette.water,
    unit: "days",
  },
  {
    baseId: "weigh",
    title: (t) => `${t} check-ins`,
    description: (t) => `Record ${t} weigh-ins to keep the trend honest.`,
    icon: "body",
    metric: "weighIns",
    target: 8,
    points: 25,
    accent: Palette.water,
  },
  {
    baseId: "active",
    title: (t) => `${t} active days`,
    description: (t) => `Show up and log activity on ${t} days.`,
    icon: "flame",
    metric: "totalActiveDays",
    target: 24,
    points: 40,
    accent: Palette.calories,
    unit: "days",
  },
];

const CHALLENGES_PER_MONTH = 3;

/**
 * The themed challenge set for a period. Deterministic in `periodKey`: stable
 * all month and identical across users, but different month to month.
 */
export function generateChallenges(periodKey: string): ChallengeDef[] {
  const rng = mulberry32(hashSeed(periodKey));
  // Seeded Fisher–Yates over a copy, then take the first N (distinct metrics).
  const pool = [...TEMPLATES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen: Template[] = [];
  const usedMetrics = new Set<ChallengeMetricKey>();
  for (const t of pool) {
    if (usedMetrics.has(t.metric)) continue;
    usedMetrics.add(t.metric);
    chosen.push(t);
    if (chosen.length >= CHALLENGES_PER_MONTH) break;
  }
  return chosen.map((t) => ({
    id: `${periodKey}:${t.baseId}`,
    baseId: t.baseId,
    periodKey,
    title: t.title(t.target),
    description: t.description(t.target),
    icon: t.icon,
    metric: t.metric,
    target: t.target,
    points: t.points,
    accent: t.accent,
    unit: t.unit,
  }));
}

// ──────────────────────────────────────────────
// PERSISTENCE
// ──────────────────────────────────────────────

export async function loadChallengeRecord(): Promise<ChallengeRecord> {
  try {
    const raw = await AsyncStorage.getItem(CHAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChallengeRecord>;
      return {
        periodKey: parsed.periodKey ?? "",
        baseline: { ...EMPTY_STATS, ...(parsed.baseline ?? {}) },
        completed: parsed.completed ?? {},
      };
    }
  } catch (e) {
    console.error("Error loading challenges:", e);
  }
  return { ...EMPTY_CHALLENGE_RECORD, baseline: { ...EMPTY_STATS } };
}

export async function saveChallengeRecord(record: ChallengeRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAL_KEY, JSON.stringify(record));
  } catch (e) {
    console.error("Error saving challenges:", e);
  }
}

/**
 * Roll the record to the current period when needed. On a fresh month (or first
 * ever run) it re-baselines to the current lifetime stats and clears the
 * completed set — so the new month's deltas start at zero. Returns the same
 * reference when already current (no churn).
 */
export function ensurePeriod(
  record: ChallengeRecord,
  stats: AchievementStats,
  now: Date = new Date(),
): ChallengeRecord {
  const periodKey = currentPeriodKey(now);
  if (record.periodKey === periodKey) return record;
  return { periodKey, baseline: { ...stats }, completed: {} };
}

// ──────────────────────────────────────────────
// EVALUATION
// ──────────────────────────────────────────────

function delta(
  stats: AchievementStats,
  baseline: AchievementStats,
  key: ChallengeMetricKey,
): number {
  return Math.max(0, Math.round(stats[key] - baseline[key]));
}

/** Resolve this period's challenges against current stats + the baseline. */
export function evaluateChallenges(
  stats: AchievementStats,
  record: ChallengeRecord,
): EvaluatedChallenge[] {
  const defs = generateChallenges(record.periodKey || currentPeriodKey());
  return defs.map((def) => {
    const rawValue = delta(stats, record.baseline, def.metric);
    const completed = rawValue >= def.target || Boolean(record.completed[def.id]);
    return {
      def,
      rawValue,
      value: Math.min(rawValue, def.target),
      target: def.target,
      progress: def.target > 0 ? Math.min(1, rawValue / def.target) : 0,
      completed,
      completedAt: record.completed[def.id] ?? null,
    };
  });
}

/**
 * Mark newly-finished challenges complete. Idempotent — already-completed ones
 * are skipped, so the same stats never re-fire a celebration.
 */
export function reconcileChallengeCompletions(
  stats: AchievementStats,
  record: ChallengeRecord,
): { record: ChallengeRecord; newlyCompleted: ChallengeDef[] } {
  const defs = generateChallenges(record.periodKey || currentPeriodKey());
  const now = new Date().toISOString();
  const completed = { ...record.completed };
  const newlyCompleted: ChallengeDef[] = [];

  for (const def of defs) {
    if (completed[def.id]) continue;
    if (delta(stats, record.baseline, def.metric) >= def.target) {
      completed[def.id] = now;
      newlyCompleted.push(def);
    }
  }

  if (newlyCompleted.length === 0) return { record, newlyCompleted };
  return { record: { ...record, completed }, newlyCompleted };
}

export function getChallengeSummary(
  evaluated: EvaluatedChallenge[],
  periodKey: string,
  now: Date = new Date(),
): ChallengeSummary {
  let completedCount = 0;
  let points = 0;
  let maxPoints = 0;
  for (const c of evaluated) {
    maxPoints += c.def.points;
    if (c.completed) {
      completedCount += 1;
      points += c.def.points;
    }
  }
  return {
    completedCount,
    total: evaluated.length,
    points,
    maxPoints,
    periodLabel: periodLabel(periodKey),
    seasonTitle: seasonTitle(periodKey),
    daysLeft: daysLeftInPeriod(periodKey, now),
  };
}
