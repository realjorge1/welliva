/**
 * MONTHLY RECAP SERVICE — "Welliva Wrapped" (monthly edition).
 *
 * A Spotify-Wrapped-style recap computed at the end of every calendar month: a
 * playful, narrative, shareable summary of the user's training, nutrition,
 * hydration, consistency and body progress. Monthly cadence (not yearly) is
 * intentional — 12 small reflection + dopamine beats a year, a short feedback
 * loop that compounds the habit. The goal is to move the user's emotional center
 * from badges to OUTCOMES and NARRATIVE.
 *
 * DESIGN
 *  - Pure + deterministic. `buildMonthlyRecap(input, periodKey)` filters every
 *    persisted source to the period and computes the numbers; given the same
 *    inputs it returns the same recap, so ANY past month can be regenerated
 *    identically. No `Date.now()` inside the computation.
 *  - Computed from REAL data only. Everything traces to the persisted logs the
 *    rest of the app already keeps (workoutLog, sessionHistory, dietHistory,
 *    bodyLogs, the earned/completed timestamp maps, trophies). No new tracking.
 *  - ALL copy lives here (headlines, vibe titles, sentences, share text), not in
 *    JSX — matching the project's copy discipline.
 *  - EMOJI EXCEPTION: the app is otherwise emoji-free, but the recap is a
 *    celebration/share surface, so a small curated set is allowed HERE ONLY,
 *    contained in `RECAP_EMOJI` behind `RECAP_EMOJI_ENABLED` so it's trivially
 *    strippable. Emoji never leak into shared/service copy outside the recap
 *    surface — note `recapEpisodeSummary` (a Gozlin memory line) is emoji-free.
 *
 * It deliberately reuses the existing month-period model (ChallengeService's
 * `periodKey`/`periodLabel`) so the recap shares the exact same month boundary
 * as the seasonal challenges and the Consistency League.
 */

import { AchievementTier, ACHIEVEMENTS, TIER_META } from "./AchievementService";
import { generateChallenges, periodLabel } from "./ChallengeService";
import { readJSON, toLocalDateString, writeJSON } from "./OfflineStorage";
import { celebrate, closer } from "./gozlin/GozlinPersona";

import type { DietHistoryEntry } from "../models/diet";
import type { SessionSummaryData } from "../models/session";
import type { BodyLogEntry, WorkoutLogEntry } from "../models/workout";
import type { StreakData } from "./StreakService";
import type { Trophy } from "./TournamentService";

// ──────────────────────────────────────────────
// EMOJI (contained to the recap surface — see file header)
// ──────────────────────────────────────────────

/** Master switch: flip to false to strip every emoji from the recap surface. */
export const RECAP_EMOJI_ENABLED = true;

/** The only place emoji are allowed in the app. Keyed by recap signal/role. */
export const RECAP_EMOJI = {
  streak: "🔥",
  training: "💪",
  body: "📈",
  hydration: "💧",
  nutrition: "🥗",
  consistency: "⭐",
  neutral: "✨",
  trophy: "🏆",
} as const;

type RecapEmojiKey = keyof typeof RECAP_EMOJI;

/** Emoji for a key, or "" when disabled — the single gate the flag controls. */
function emoji(key: RecapEmojiKey): string {
  return RECAP_EMOJI_ENABLED ? RECAP_EMOJI[key] : "";
}

/** Append an emoji to a line when enabled (with a leading space), else no-op. */
function withEmoji(text: string, key: RecapEmojiKey): string {
  const e = emoji(key);
  return e ? `${text} ${e}` : text;
}

// ──────────────────────────────────────────────
// DELIVERY FLAGS / GATE
// ──────────────────────────────────────────────

/**
 * Calm delivery is the default: the recap is reached via a dismissible Profile
 * banner, never an auto-pushed screen on launch. This flag is the documented
 * extension point for a one-time gentle auto-present — DEFAULT OFF.
 */
export const RECAP_AUTO_PRESENT = false;

const RECAP_SEEN_KEY = "@welliva_recap_seen";

/** Last period (YYYY-MM) whose recap was presented/opened. Mirrors the
 *  `setLastWeeklyReview` meta-gate in GozlinMemoryStore. */
export async function loadRecapSeen(): Promise<string | null> {
  return readJSON<string | null>(RECAP_SEEN_KEY, null);
}

export async function setRecapSeen(periodKey: string): Promise<void> {
  await writeJSON(RECAP_SEEN_KEY, periodKey);
}

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

/** Everything the recap is computed from — all already persisted by the app. */
export interface RecapInput {
  workoutLog: WorkoutLogEntry[];
  sessionHistory: SessionSummaryData[];
  dietHistory: DietHistoryEntry[];
  bodyLogs: BodyLogEntry[];
  streak: StreakData;
  /** achievementId → ISO unlocked (achievementRecord.earned). */
  earnedAchievements: Record<string, string>;
  /** challengeId → ISO completed (challengeRecord.completed). */
  completedChallenges: Record<string, string>;
  /** Permanent league trophies (optional — guarded for absence). */
  trophies?: Trophy[];
  /** Daily protein target (g) for adherence — from nutritionTargets, optional. */
  proteinTargetG?: number | null;
  /**
   * Dates (YYYY-MM-DD) the hydration goal was reached. The app does not yet keep
   * a per-day water log (only a lifetime counter + the last hit date), so this
   * is a conservative real signal and a clean extension point: when a dated
   * water log lands later, hydration lights up fully without touching this file.
   */
  waterGoalDates?: string[];
}

export interface RecapTraining {
  workouts: number;
  totalReps: number;
  /** Average completion across the month's logged workouts (0–100). */
  avgCompletion: number;
  perfectWorkouts: number;
  minutes: number;
  /** The standout training day — most reps in one session. */
  bestDay: { date: string; label: string; reps: number } | null;
}

export interface RecapNutrition {
  daysLogged: number;
  mealsLogged: number;
  /** Days every planned meal was eaten (status "completed"). */
  perfectDays: number;
  partialDays: number;
  /** Days protein landed at ≥ 90% of target (0 when no target known). */
  proteinGoalDays: number;
  /** Mean protein adherence as a percent (null when untracked). */
  proteinAdherence: number | null;
}

export interface RecapHydration {
  goalDays: number;
  /** Whether any dated hydration signal exists for the month. */
  tracked: boolean;
}

export interface RecapWeek {
  index: number; // 1-based week of the month
  label: string; // "Week 1"
  rangeLabel: string; // "Jul 1–7"
  activeDays: number;
}

export interface RecapConsistency {
  activeDays: number;
  /** Longest run of consecutive active days WITHIN the month. */
  bestStreak: number;
  /** True when the month contains the user's lifetime-best run. */
  isStreakRecord: boolean;
  weeks: RecapWeek[];
  strongestWeek: RecapWeek | null;
  standoutDay: { date: string; label: string; note: string } | null;
}

export interface RecapBody {
  weighIns: number;
  startKg: number | null;
  endKg: number | null;
  /** end − start (kg), null with fewer than two weigh-ins. */
  deltaKg: number | null;
  direction: "down" | "up" | "flat" | null;
}

export interface RecapMilestoneAchievement {
  id: string;
  name: string;
  tier: AchievementTier;
  tierLabel: string;
  color: string;
}

export interface RecapMilestones {
  achievements: RecapMilestoneAchievement[];
  challenges: { id: string; title: string }[];
  trophy: { title: string; score: number } | null;
}

export interface RecapDelta {
  key: string;
  /** Current-month value. */
  value: number;
  /** Current − prior. */
  delta: number;
  /** "+3 workouts vs June". */
  text: string;
}

export interface RecapDeltas {
  priorPeriodKey: string;
  priorMonthName: string;
  /** Whether the prior month had real activity to compare against. */
  hasPrior: boolean;
  items: RecapDelta[];
}

/** The dominant narrative of the month — drives headline + vibe title. */
export type RecapSignal =
  | "streak"
  | "training"
  | "body"
  | "hydration"
  | "nutrition"
  | "consistency"
  | "neutral";

/** A month with data, for the archive list. */
export interface RecapPeriod {
  periodKey: string;
  label: string;
}

export interface MonthlyRecap {
  periodKey: string;
  label: string; // "July 2026"
  monthName: string; // "July"
  daysInMonth: number;
  hasActivity: boolean;
  signal: RecapSignal;
  /** Playful headline, e.g. "July was lit". */
  headline: string;
  /** Vibe title, e.g. "Well Hydrated". */
  vibeTitle: string;
  /** The single hero metric (active days, ringed against the month). */
  hero: { value: number; total: number; label: string; sub: string };
  training: RecapTraining;
  nutrition: RecapNutrition;
  hydration: RecapHydration;
  consistency: RecapConsistency;
  body: RecapBody;
  milestones: RecapMilestones;
  deltas: RecapDeltas;
}

// ──────────────────────────────────────────────
// PERIOD / DATE HELPERS
// ──────────────────────────────────────────────

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parsePeriod(periodKey: string): { year: number; month: number } {
  const [y, m] = periodKey.split("-").map((n) => parseInt(n, 10));
  return { year: y || 0, month: (m || 1) - 1 };
}

/** Month name for a period key — "July". */
export function periodMonthName(periodKey: string): string {
  return MONTHS_FULL[parsePeriod(periodKey).month] ?? "";
}

/** The period immediately before this one — "2026-07" → "2026-06". */
export function priorPeriodKey(periodKey: string): string {
  const { year, month } = parsePeriod(periodKey);
  const d = new Date(year, month - 1, 1);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}`;
}

/** The period immediately after this one — for the forward-looking sign-off. */
function nextPeriodKey(periodKey: string): string {
  const { year, month } = parsePeriod(periodKey);
  const d = new Date(year, month + 1, 1);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}`;
}

/** Number of days in a period. */
function daysInPeriod(periodKey: string): number {
  const { year, month } = parsePeriod(periodKey);
  return new Date(year, month + 1, 0).getDate();
}

/** YYYY-MM of a local date string (YYYY-MM-DD). */
function dateMonth(dateStr: string): string {
  return (dateStr || "").slice(0, 7);
}

/** YYYY-MM of an ISO timestamp, in LOCAL time (null when unparseable). */
function isoMonth(iso: string): string | null {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return toLocalDateString(t).slice(0, 7);
}

/** "Jul 14" for a YYYY-MM-DD string. */
function dayLabel(dateStr: string): string {
  const mi = parseInt(dateStr.slice(5, 7), 10) - 1;
  const day = parseInt(dateStr.slice(8, 10), 10);
  return `${MONTHS_SHORT[mi] ?? ""} ${day}`;
}

// ──────────────────────────────────────────────
// CORE COMPUTATION (per month, pure)
// ──────────────────────────────────────────────

interface RecapCore {
  daysInMonth: number;
  hasActivity: boolean;
  training: RecapTraining;
  nutrition: RecapNutrition;
  hydration: RecapHydration;
  consistency: RecapConsistency;
  body: RecapBody;
  milestones: RecapMilestones;
}

function computeCore(input: RecapInput, periodKey: string): RecapCore {
  const daysInMonth = daysInPeriod(periodKey);

  // ── Filter every source to the period ──
  const workouts = input.workoutLog.filter((w) => dateMonth(w.date) === periodKey);
  const sessions = input.sessionHistory.filter((s) => dateMonth(s.date) === periodKey);
  const diet = input.dietHistory.filter((d) => dateMonth(d.date) === periodKey);
  const body = input.bodyLogs
    .filter((b) => dateMonth(b.date) === periodKey)
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Training ──
  const totalReps = sessions.reduce((sum, s) => sum + (s.totalReps || 0), 0);
  const minutes = workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);
  const perfectWorkouts = workouts.filter((w) => w.completionPercent >= 100).length;
  const avgCompletion =
    workouts.length > 0
      ? Math.round(
          workouts.reduce((sum, w) => sum + (w.completionPercent || 0), 0) /
            workouts.length,
        )
      : 0;

  // Reps per day (for the standout-day signal) and the best training day.
  const repsByDay = new Map<string, number>();
  for (const s of sessions) {
    repsByDay.set(s.date, (repsByDay.get(s.date) ?? 0) + (s.totalReps || 0));
  }
  let bestDay: RecapTraining["bestDay"] = null;
  for (const [date, reps] of repsByDay) {
    if (!bestDay || reps > bestDay.reps) {
      bestDay = { date, label: dayLabel(date), reps };
    }
  }

  const training: RecapTraining = {
    workouts: workouts.length,
    totalReps,
    avgCompletion,
    perfectWorkouts,
    minutes,
    bestDay,
  };

  // ── Nutrition ──
  const mealsLogged = diet.reduce((sum, d) => sum + (d.mealsConsumed || 0), 0);
  const perfectDays = diet.filter((d) => d.status === "completed").length;
  const partialDays = diet.filter((d) => d.status === "partial").length;
  const daysLogged = diet.filter((d) => (d.mealsConsumed || 0) > 0).length;

  const target = input.proteinTargetG ?? null;
  const proteinDays = diet.filter((d) => d.consumedProteinG != null);
  let proteinGoalDays = 0;
  let proteinAdherence: number | null = null;
  if (target && target > 0 && proteinDays.length > 0) {
    proteinGoalDays = proteinDays.filter(
      (d) => (d.consumedProteinG as number) >= target * 0.9,
    ).length;
    const avg =
      proteinDays.reduce((sum, d) => sum + (d.consumedProteinG as number), 0) /
      proteinDays.length;
    proteinAdherence = Math.round((avg / target) * 100);
  }

  const nutrition: RecapNutrition = {
    daysLogged,
    mealsLogged,
    perfectDays,
    partialDays,
    proteinGoalDays,
    proteinAdherence,
  };

  // ── Hydration (conservative — see RecapInput.waterGoalDates) ──
  const hydrationDays = (input.waterGoalDates ?? []).filter(
    (d) => dateMonth(d) === periodKey,
  ).length;
  const hydration: RecapHydration = {
    goalDays: hydrationDays,
    tracked: hydrationDays > 0,
  };

  // ── Consistency: an "active day" is any day with a real, logged signal ──
  const active = new Set<string>();
  for (const w of workouts) active.add(w.date);
  for (const d of diet) if ((d.mealsConsumed || 0) > 0) active.add(d.date);
  for (const b of body) active.add(b.date);

  const activeDayNums = [...active]
    .map((d) => parseInt(d.slice(8, 10), 10))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);

  // Longest run of consecutive day-numbers within the month.
  let bestStreak = 0;
  let run = 0;
  let prev = -99;
  for (const n of activeDayNums) {
    run = n === prev + 1 ? run + 1 : 1;
    if (run > bestStreak) bestStreak = run;
    prev = n;
  }
  const isStreakRecord =
    bestStreak >= 3 && bestStreak >= (input.streak.longestStreak || 0);

  // Week-by-week activity (calendar weeks-of-month, 7-day buckets).
  const weekCount = Math.ceil(daysInMonth / 7);
  const weeks: RecapWeek[] = [];
  for (let i = 0; i < weekCount; i++) {
    const start = i * 7 + 1;
    const end = Math.min((i + 1) * 7, daysInMonth);
    const days = activeDayNums.filter((n) => n >= start && n <= end).length;
    const { month } = parsePeriod(periodKey);
    const ms = MONTHS_SHORT[month] ?? "";
    weeks.push({
      index: i + 1,
      label: `Week ${i + 1}`,
      rangeLabel: `${ms} ${start}–${end}`,
      activeDays: days,
    });
  }
  let strongestWeek: RecapWeek | null = null;
  for (const w of weeks) {
    if (w.activeDays > 0 && (!strongestWeek || w.activeDays > strongestWeek.activeDays)) {
      strongestWeek = w;
    }
  }

  // Standout day — the richest single day (workout + perfect plate + weigh-in).
  const perfectDateSet = new Set(diet.filter((d) => d.status === "completed").map((d) => d.date));
  const workoutDateSet = new Set(workouts.map((w) => w.date));
  const bodyDateSet = new Set(body.map((b) => b.date));
  let standoutDay: RecapConsistency["standoutDay"] = null;
  let standoutScore = -1;
  for (const date of active) {
    const reps = repsByDay.get(date) ?? 0;
    const didWorkout = workoutDateSet.has(date);
    const perfectPlate = perfectDateSet.has(date);
    const weighIn = bodyDateSet.has(date);
    const score =
      (perfectPlate ? 800 : 0) + (didWorkout ? 500 : 0) + (weighIn ? 100 : 0) + reps;
    if (score > standoutScore) {
      standoutScore = score;
      const parts: string[] = [];
      if (didWorkout) parts.push(reps > 0 ? `a ${reps}-rep workout` : "a workout");
      if (perfectPlate) parts.push("a perfect plate");
      if (weighIn) parts.push("a check-in");
      const note =
        parts.length > 0 ? `${capitalize(joinList(parts))}.` : "You showed up.";
      standoutDay = { date, label: dayLabel(date), note };
    }
  }

  const consistency: RecapConsistency = {
    activeDays: active.size,
    bestStreak,
    isStreakRecord,
    weeks,
    strongestWeek,
    standoutDay,
  };

  // ── Body ──
  let bodyState: RecapBody = {
    weighIns: body.length,
    startKg: null,
    endKg: null,
    deltaKg: null,
    direction: null,
  };
  if (body.length >= 1) {
    const startKg = body[0].weightKg;
    const endKg = body[body.length - 1].weightKg;
    const deltaKg = body.length >= 2 ? round1(endKg - startKg) : null;
    const direction =
      deltaKg == null ? null : deltaKg < -0.1 ? "down" : deltaKg > 0.1 ? "up" : "flat";
    bodyState = { weighIns: body.length, startKg, endKg, deltaKg, direction };
  }

  // ── Milestones ──
  const achMonth: RecapMilestoneAchievement[] = [];
  for (const [id, iso] of Object.entries(input.earnedAchievements)) {
    if (isoMonth(iso) !== periodKey) continue;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) continue;
    const meta = TIER_META[def.tier];
    achMonth.push({
      id,
      name: def.name,
      tier: def.tier,
      tierLabel: meta.label,
      color: meta.color,
    });
  }
  // Highest tiers first (most prestigious named on the share + hero).
  const tierRank: Record<AchievementTier, number> = {
    mythic: 5, platinum: 4, gold: 3, silver: 2, bronze: 1,
  };
  achMonth.sort((a, b) => tierRank[b.tier] - tierRank[a.tier]);

  const challengeTitles = new Map(
    generateChallenges(periodKey).map((c) => [c.id, c.title]),
  );
  const chalMonth: { id: string; title: string }[] = [];
  for (const [id, iso] of Object.entries(input.completedChallenges)) {
    if (isoMonth(iso) !== periodKey) continue;
    chalMonth.push({ id, title: challengeTitles.get(id) ?? "Challenge complete" });
  }

  const wonTrophy = (input.trophies ?? []).find((t) => t.periodKey === periodKey);
  const trophy = wonTrophy ? { title: wonTrophy.title, score: wonTrophy.score } : null;

  const milestones: RecapMilestones = {
    achievements: achMonth,
    challenges: chalMonth,
    trophy,
  };

  const hasActivity =
    active.size > 0 ||
    mealsLogged > 0 ||
    achMonth.length > 0 ||
    chalMonth.length > 0 ||
    body.length > 0;

  return {
    daysInMonth,
    hasActivity,
    training,
    nutrition,
    hydration,
    consistency,
    body: bodyState,
    milestones,
  };
}

// ──────────────────────────────────────────────
// SIGNAL + COPY (deterministic, seeded by period)
// ──────────────────────────────────────────────

/** Deterministic FNV-1a hash → seed for variant selection (no Math.random). */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], seed: string): T {
  return arr[hashSeed(seed) % arr.length];
}

/** The month's dominant narrative — checked in priority order. */
function pickSignal(core: RecapCore): RecapSignal {
  if (core.consistency.isStreakRecord && core.consistency.bestStreak >= 7) return "streak";
  if (core.training.workouts >= 12 || core.training.perfectWorkouts >= 6) return "training";
  if (core.body.deltaKg != null && Math.abs(core.body.deltaKg) >= 0.8) return "body";
  if (core.hydration.goalDays >= 15) return "hydration";
  if (core.nutrition.perfectDays >= 10) return "nutrition";
  if (core.consistency.activeDays >= 18) return "consistency";
  return "neutral";
}

const HEADLINES: Record<RecapSignal, readonly string[]> = {
  streak: ["{M} was unstoppable", "{M}: you never blinked"],
  training: ["{M} was all gains", "{M} went beast mode"],
  body: ["{M} moved the needle", "{M} trended your way"],
  hydration: ["{M} flowed", "{M} stayed topped up"],
  nutrition: ["{M} was dialed in", "{M} ate clean"],
  consistency: ["{M} was locked in", "{M}: you kept showing up"],
  neutral: ["{M}, wrapped", "that was {M}"],
};

const VIBE_TITLES: Record<RecapSignal, string> = {
  streak: "Unstoppable",
  training: "Beast Mode",
  body: "Trending",
  hydration: "Well Hydrated",
  nutrition: "Dialed In",
  consistency: "Locked In",
  neutral: "Monthly Recap",
};

const SIGNAL_EMOJI: Record<RecapSignal, RecapEmojiKey> = {
  streak: "streak",
  training: "training",
  body: "body",
  hydration: "hydration",
  nutrition: "nutrition",
  consistency: "consistency",
  neutral: "neutral",
};

/** Playful headline for the recap — deterministic per month. */
export function recapHeadline(recap: MonthlyRecap): string {
  const base = pick(HEADLINES[recap.signal], recap.periodKey).replace(
    "{M}",
    recap.monthName,
  );
  return withEmoji(base, SIGNAL_EMOJI[recap.signal]);
}

/** Vibe title keyed to the month's dominant signal. */
export function recapVibeTitle(recap: MonthlyRecap): string {
  const base =
    recap.signal === "neutral"
      ? `${recap.monthName} Recap`
      : VIBE_TITLES[recap.signal];
  return base;
}

// ──────────────────────────────────────────────
// BUILD
// ──────────────────────────────────────────────

const DELTA_NOUNS: Record<string, { one: string; many: string }> = {
  workouts: { one: "workout", many: "workouts" },
  activeDays: { one: "active day", many: "active days" },
  perfectDays: { one: "perfect day", many: "perfect days" },
  totalReps: { one: "reps", many: "reps" },
};

/**
 * Build the full, data-driven recap for `periodKey`. Pure + deterministic:
 * filters the inputs to the month, computes every domain, derives the dominant
 * signal + copy, and diffs against the prior month.
 */
export function buildMonthlyRecap(
  input: RecapInput,
  periodKey: string,
): MonthlyRecap {
  const core = computeCore(input, periodKey);
  const monthName = periodMonthName(periodKey);
  const signal = pickSignal(core);

  // ── Month-over-month deltas ──
  const prior = priorPeriodKey(periodKey);
  const priorCore = computeCore(input, prior);
  const priorMonthName = periodMonthName(prior);
  const candidates: { key: string; value: number; prev: number }[] = [
    { key: "workouts", value: core.training.workouts, prev: priorCore.training.workouts },
    { key: "activeDays", value: core.consistency.activeDays, prev: priorCore.consistency.activeDays },
    { key: "perfectDays", value: core.nutrition.perfectDays, prev: priorCore.nutrition.perfectDays },
    { key: "totalReps", value: core.training.totalReps, prev: priorCore.training.totalReps },
  ];
  const items: RecapDelta[] = candidates
    .map((c) => {
      const delta = c.value - c.prev;
      const noun = DELTA_NOUNS[c.key];
      const word = Math.abs(delta) === 1 ? noun.one : noun.many;
      const amount = c.key === "totalReps" ? Math.abs(delta).toLocaleString() : `${Math.abs(delta)}`;
      return {
        key: c.key,
        value: c.value,
        delta,
        text: `${delta >= 0 ? "+" : "−"}${amount} ${word} vs ${priorMonthName}`,
      };
    })
    .filter((d) => d.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  const deltas: RecapDeltas = {
    priorPeriodKey: prior,
    priorMonthName,
    hasPrior: priorCore.hasActivity,
    items: priorCore.hasActivity ? items : [],
  };

  const recap: MonthlyRecap = {
    periodKey,
    label: periodLabel(periodKey),
    monthName,
    daysInMonth: core.daysInMonth,
    hasActivity: core.hasActivity,
    signal,
    headline: "",
    vibeTitle: "",
    hero: {
      value: core.consistency.activeDays,
      total: core.daysInMonth,
      label: "active days",
      sub: `of ${core.daysInMonth} days`,
    },
    training: core.training,
    nutrition: core.nutrition,
    hydration: core.hydration,
    consistency: core.consistency,
    body: core.body,
    milestones: core.milestones,
    deltas,
  };

  recap.headline = recapHeadline(recap);
  recap.vibeTitle = recapVibeTitle(recap);
  return recap;
}

// ──────────────────────────────────────────────
// SHARE / SIGN-OFF / MEMORY COPY
// ──────────────────────────────────────────────

/** A concise, shareable plain-text summary + a deep link (emoji per the flag). */
export function recapShareText(recap: MonthlyRecap): string {
  const lines: string[] = [];
  lines.push(
    withEmoji(`My ${recap.monthName} on Welliva — ${recap.vibeTitle}`, SIGNAL_EMOJI[recap.signal]),
  );

  const t = recap.training;
  if (t.workouts > 0) {
    lines.push(`• ${t.workouts} workouts · ${t.totalReps.toLocaleString()} reps`);
  }
  if (recap.nutrition.perfectDays > 0) {
    lines.push(`• ${recap.nutrition.perfectDays} perfect nutrition days`);
  }
  lines.push(
    `• ${recap.consistency.activeDays} active days · best run ${recap.consistency.bestStreak}`,
  );

  const b = recap.body;
  if (b.deltaKg != null && b.direction && b.direction !== "flat") {
    lines.push(`• ${b.direction === "down" ? "Down" : "Up"} ${Math.abs(b.deltaKg)} kg`);
  }
  const milestoneCount =
    recap.milestones.achievements.length + recap.milestones.challenges.length;
  if (milestoneCount > 0) {
    lines.push(`• ${milestoneCount} milestone${milestoneCount === 1 ? "" : "s"} unlocked`);
  }
  if (recap.milestones.trophy) {
    lines.push(withEmoji(`• ${recap.milestones.trophy.title}`, "trophy"));
  }

  lines.push(`welliva://recap/${recap.periodKey}`);
  return lines.join("\n");
}

/**
 * Copy for the calm Profile banner that surfaces a ready recap. Emoji-free —
 * the banner is rendered on a shared screen (Profile), so it stays outside the
 * recap surface's emoji exception.
 */
export function recapBannerCopy(periodKey: string): {
  title: string;
  subtitle: string;
} {
  const month = periodMonthName(periodKey);
  return {
    title: `Your ${month} recap is ready`,
    subtitle: "See how your month came together — tap to open.",
  };
}

/** A warm Gozlin sign-off line, in the coach's voice (recap surface). */
export function recapSignoff(recap: MonthlyRecap): string {
  const next = periodMonthName(nextPeriodKey(recap.periodKey));
  if (!recap.hasActivity) {
    return `${closer(recap.periodKey)} ${next} is a fresh page.`;
  }
  return `${celebrate(recap.periodKey)} On to ${next}.`;
}

/**
 * One-line memory for Gozlin's episodic store, e.g.
 * "July recap: 18 workouts, down 1.4 kg, best run 21". EMOJI-FREE — this is
 * shared/service copy that lives outside the recap surface.
 */
export function recapEpisodeSummary(recap: MonthlyRecap): string {
  const parts: string[] = [];
  if (recap.training.workouts > 0) parts.push(`${recap.training.workouts} workouts`);
  if (recap.nutrition.perfectDays > 0) parts.push(`${recap.nutrition.perfectDays} perfect days`);
  const b = recap.body;
  if (b.deltaKg != null && b.direction && b.direction !== "flat") {
    parts.push(`${b.direction} ${Math.abs(b.deltaKg)} kg`);
  }
  if (recap.consistency.bestStreak > 0) parts.push(`best run ${recap.consistency.bestStreak}`);
  if (parts.length === 0) parts.push(`${recap.consistency.activeDays} active days`);
  return `${recap.monthName} recap: ${parts.join(", ")}`;
}

// ──────────────────────────────────────────────
// AVAILABILITY / ARCHIVE
// ──────────────────────────────────────────────

/** Whether a period has any real, logged activity worth a recap. */
export function monthHasActivity(input: RecapInput, periodKey: string): boolean {
  const hasWorkout = input.workoutLog.some((w) => dateMonth(w.date) === periodKey);
  if (hasWorkout) return true;
  const hasMeals = input.dietHistory.some(
    (d) => dateMonth(d.date) === periodKey && (d.mealsConsumed || 0) > 0,
  );
  if (hasMeals) return true;
  const hasBody = input.bodyLogs.some((b) => dateMonth(b.date) === periodKey);
  return hasBody;
}

/**
 * Past months (strictly before `currentPeriodKey`) that have data — newest
 * first. Powers the permanent recap archive in Profile.
 */
export function listRecapPeriods(
  input: RecapInput,
  currentPeriodKey: string,
): RecapPeriod[] {
  const months = new Set<string>();
  for (const w of input.workoutLog) months.add(dateMonth(w.date));
  for (const s of input.sessionHistory) months.add(dateMonth(s.date));
  for (const d of input.dietHistory) {
    if ((d.mealsConsumed || 0) > 0) months.add(dateMonth(d.date));
  }
  for (const b of input.bodyLogs) months.add(dateMonth(b.date));

  return [...months]
    .filter((m) => /^\d{4}-\d{2}$/.test(m) && m < currentPeriodKey)
    .sort((a, b) => b.localeCompare(a))
    .map((periodKey) => ({ periodKey, label: periodLabel(periodKey) }));
}

// ──────────────────────────────────────────────
// SMALL UTILITIES
// ──────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

/** "a, b and c" — for the standout-day note. */
function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
