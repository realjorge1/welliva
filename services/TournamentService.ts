/**
 * TOURNAMENT SERVICE — the Consistency League (monthly, delta-measured).
 *
 * A calm, opt-in, upside-only monthly tournament: the user is paced against ONE
 * calibrated AI rival (see RivalEngine) for the calendar month, scored on a
 * single composite "discipline" signal. Meeting or beating the pacer at month's
 * end awards a permanent Trophy. There is NO loss state — a quiet month just
 * shows a warm recap; trophies only ever add.
 *
 * It mirrors ChallengeService deliberately: a YYYY-MM period key, a baseline
 * snapshot of lifetime `AchievementStats` captured when the race begins, and a
 * score that is purely DELTAS from that baseline. That makes it non-gameable —
 * there is no raw "check-in" button; the only way the number moves is real,
 * already-recorded activity. Per-day caps stop a single binge from winning a
 * month, and the baseline resets on join so there is never retroactive credit.
 *
 * Pure: no React, no clock of its own (every function takes `now`). All the
 * stateful wiring (load/save, reconcile, celebrate) lives in AppContext.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import type { AchievementStats, AchievementTier } from "./AchievementService";
import { EMPTY_STATS, TIER_META } from "./AchievementService";
import {
  currentPeriodKey,
  daysLeftInPeriod,
  periodLabel,
} from "./ChallengeService";
import { pickRival, rivalScoreAt, type RivalArchetype } from "./RivalEngine";
import type { GozlinTone } from "./gozlin";

export { currentPeriodKey } from "./ChallengeService";
export type { RivalArchetype } from "./RivalEngine";

const TOURNAMENT_KEY = "@welliva_tournament";

// ──────────────────────────────────────────────
// LEAGUE METRIC — the composite "discipline" score
// ──────────────────────────────────────────────

/**
 * Only the honest, day-bounded counters feed the league. Each contributes a
 * weighted DELTA from the period baseline; `dayCap` bounds the per-day
 * contribution so one heavy day can never run away with a month (workouts can
 * be logged many-per-day, so they're capped hardest; the rest are already
 * one-per-day by nature but capped explicitly for defense-in-depth).
 */
export type LeagueMetricKey =
  | "workoutsCompleted"
  | "perfectDays"
  | "proteinGoalDays"
  | "waterGoalDays"
  | "weighIns"
  | "totalActiveDays";

interface LeagueMetricDef {
  key: LeagueMetricKey;
  label: string;
  weight: number;
  /** Max counted per race-day (caps the delta at dayCap × days elapsed). */
  dayCap: number;
}

/** Single source of truth for weights, labels, and per-day caps. */
export const LEAGUE_METRICS: readonly LeagueMetricDef[] = [
  { key: "workoutsCompleted", label: "Workouts", weight: 10, dayCap: 2 },
  { key: "perfectDays", label: "Perfect plates", weight: 8, dayCap: 1 },
  { key: "proteinGoalDays", label: "Protein goals", weight: 4, dayCap: 1 },
  { key: "waterGoalDays", label: "Hydration days", weight: 4, dayCap: 1 },
  { key: "weighIns", label: "Check-ins", weight: 3, dayCap: 1 },
  { key: "totalActiveDays", label: "Active days", weight: 3, dayCap: 1 },
];

/** Gentle default monthly pace when there's no prior-month history to calibrate to. */
const DEFAULT_TARGET = 200;
/** Never let the rival aim at nothing, even after a very quiet prior month. */
const MIN_TARGET = 60;

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

/** A permanent, earned medallion — trophies only ever add, never reset. */
export interface Trophy {
  /** Stable id = the period it was won in (one trophy per month, max). */
  id: string;
  periodKey: string; // YYYY-MM
  /** e.g. "June Champion". */
  title: string;
  tier: AchievementTier;
  icon: keyof typeof Ionicons.glyphMap;
  /** Tier color (from TIER_META) — drives the medallion gradient. */
  accent: string;
  /** Final league score the month was won with. */
  score: number;
  rivalName: string;
  wonAt: string; // ISO
}

/** Persisted league state for the active month (+ the permanent trophy case). */
export interface TournamentRecord {
  periodKey: string;
  /** Opt-in, off by default. Carries over month-to-month once joined. */
  enrolled: boolean;
  /** Lifetime stats snapshot captured when the race began (or on join). */
  baseline: AchievementStats;
  rival: { archetype: RivalArchetype; name: string };
  /** True once the month has been settled (idempotency guard). */
  resolved: boolean;
  /** Permanent — preserved across every month rollover. */
  trophies: Trophy[];
  /** Day-of-month (1-based) the current baseline was set — the race start. */
  startedAt: number;
  /** The user's league score over the PRIOR period — calibrates this rival. */
  priorScore: number;
}

export const EMPTY_TOURNAMENT_RECORD: TournamentRecord = {
  periodKey: "",
  enrolled: false,
  baseline: { ...EMPTY_STATS },
  rival: { archetype: "tortoise", name: "Sage" },
  resolved: false,
  trophies: [],
  startedAt: 1,
  priorScore: 0,
};

/** A resolved head-to-head snapshot — ready for the UI. */
export interface Standings {
  userScore: number;
  rivalScore: number;
  leader: "user" | "rival";
  /** Projected end-of-month finish at the current pace. */
  projectedUserFinish: number;
  daysLeft: number;
}

/** One line of the discipline-score breakdown. */
export interface ScoreBreakdownRow {
  key: LeagueMetricKey;
  label: string;
  count: number;
  weight: number;
  points: number;
}

// ──────────────────────────────────────────────
// PERIOD / RACE-WINDOW MATH
// ──────────────────────────────────────────────

function parsePeriod(periodKey: string): { year: number; month: number } {
  const [y, m] = periodKey.split("-").map((n) => parseInt(n, 10));
  return { year: y, month: (m || 1) - 1 };
}

function daysInMonth(periodKey: string): number {
  const { year, month } = parsePeriod(periodKey);
  return new Date(year, month + 1, 0).getDate();
}

/** Days elapsed in a period (1-based today; full month once it has ended; 0 before). */
function daysElapsedInPeriod(periodKey: string, now: Date): number {
  const nowKey = currentPeriodKey(now);
  if (nowKey === periodKey) return now.getDate();
  // Lexical compare works chronologically for "YYYY-MM".
  return nowKey > periodKey ? daysInMonth(periodKey) : 0;
}

/** True once the calendar month is strictly over. */
export function monthHasEnded(periodKey: string, now: Date = new Date()): boolean {
  if (!periodKey) return false;
  return currentPeriodKey(now) > periodKey;
}

interface RaceWindow {
  totalDays: number;
  raceTotalDays: number;
  raceElapsed: number;
  dayProgress: number; // 0–1 through the race window
  calibratedTarget: number;
}

/** Resolve the race window: from the baseline day to month-end. */
function raceWindow(record: TournamentRecord, now: Date): RaceWindow {
  const totalDays = daysInMonth(record.periodKey || currentPeriodKey(now));
  const startedAt = Math.min(Math.max(1, record.startedAt || 1), totalDays);
  const raceTotalDays = Math.max(1, totalDays - startedAt + 1);
  const elapsed = daysElapsedInPeriod(record.periodKey || currentPeriodKey(now), now);
  const raceElapsed = Math.max(0, Math.min(raceTotalDays, elapsed - startedAt + 1));
  const dayProgress = Math.max(0, Math.min(1, raceElapsed / raceTotalDays));
  const basis = record.priorScore > 0 ? record.priorScore : DEFAULT_TARGET;
  const calibratedTarget =
    Math.max(MIN_TARGET, basis) * (raceTotalDays / totalDays);
  return { totalDays, raceTotalDays, raceElapsed, dayProgress, calibratedTarget };
}

// ──────────────────────────────────────────────
// SCORING (delta-from-baseline, capped, non-gameable)
// ──────────────────────────────────────────────

/** The composite discipline score over `elapsedDays` of race time. */
function leagueScore(
  stats: AchievementStats,
  baseline: AchievementStats,
  elapsedDays: number,
): number {
  let total = 0;
  for (const def of LEAGUE_METRICS) {
    const raw = Math.max(0, Math.round(stats[def.key] - baseline[def.key]));
    const cap = def.dayCap * Math.max(0, elapsedDays);
    total += Math.min(raw, cap) * def.weight;
  }
  return Math.round(total);
}

/** The user's current league score for the active race window. */
export function computeUserScore(
  stats: AchievementStats,
  record: TournamentRecord,
  now: Date = new Date(),
): number {
  const w = raceWindow(record, now);
  return leagueScore(stats, record.baseline, w.raceElapsed);
}

/** Per-metric breakdown of the user's current score (for the league screen). */
export function computeBreakdown(
  stats: AchievementStats,
  record: TournamentRecord,
  now: Date = new Date(),
): ScoreBreakdownRow[] {
  const w = raceWindow(record, now);
  return LEAGUE_METRICS.map((def) => {
    const raw = Math.max(0, Math.round(stats[def.key] - record.baseline[def.key]));
    const count = Math.min(raw, def.dayCap * Math.max(0, w.raceElapsed));
    return {
      key: def.key,
      label: def.label,
      count,
      weight: def.weight,
      points: count * def.weight,
    };
  });
}

/** Resolve the live head-to-head standings. */
export function computeStandings(
  stats: AchievementStats,
  record: TournamentRecord,
  now: Date = new Date(),
): Standings {
  const w = raceWindow(record, now);
  const userScore = leagueScore(stats, record.baseline, w.raceElapsed);
  const rivalScore = rivalScoreAt(
    record.rival.archetype,
    w.dayProgress,
    w.calibratedTarget,
    userScore,
  );
  const rawProjection = w.dayProgress > 0 ? userScore / w.dayProgress : userScore;
  const projectedUserFinish = Math.round(
    Math.min(rawProjection, Math.max(userScore, w.calibratedTarget * 2.5)),
  );
  return {
    userScore,
    rivalScore,
    leader: userScore >= rivalScore ? "user" : "rival",
    projectedUserFinish,
    daysLeft: daysLeftInPeriod(record.periodKey || currentPeriodKey(now), now),
  };
}

// ──────────────────────────────────────────────
// TROPHY MINTING (procedural — no image assets)
// ──────────────────────────────────────────────

const TROPHY_ICON: Record<AchievementTier, keyof typeof Ionicons.glyphMap> = {
  bronze: "medal",
  silver: "ribbon",
  gold: "trophy",
  platinum: "diamond",
  mythic: "planet",
};

const TROPHY_TITLE: Record<AchievementTier, string> = {
  bronze: "Finisher",
  silver: "Pacesetter",
  gold: "Champion",
  platinum: "Trailblazer",
  mythic: "Legend",
};

/** Tier by final score AND margin of victory — bigger months earn rarer metal. */
function trophyTier(userScore: number, rivalScore: number): AchievementTier {
  const margin = rivalScore > 0 ? (userScore - rivalScore) / rivalScore : 1;
  if (userScore >= 600 || margin >= 0.5) return "mythic";
  if (userScore >= 400 || margin >= 0.3) return "platinum";
  if (userScore >= 250 || margin >= 0.15) return "gold";
  if (userScore >= 120) return "silver";
  return "bronze";
}

function trophyTitle(periodKey: string, tier: AchievementTier): string {
  const month = periodLabel(periodKey).split(" ")[0];
  return `${month} ${TROPHY_TITLE[tier]}`;
}

// ──────────────────────────────────────────────
// PERSISTENCE
// ──────────────────────────────────────────────

export async function loadTournamentRecord(): Promise<TournamentRecord> {
  try {
    const raw = await AsyncStorage.getItem(TOURNAMENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TournamentRecord>;
      return {
        ...EMPTY_TOURNAMENT_RECORD,
        ...parsed,
        baseline: { ...EMPTY_STATS, ...(parsed.baseline ?? {}) },
        rival: parsed.rival ?? { ...EMPTY_TOURNAMENT_RECORD.rival },
        trophies: parsed.trophies ?? [],
      };
    }
  } catch (e) {
    console.error("Error loading tournament:", e);
  }
  return { ...EMPTY_TOURNAMENT_RECORD, baseline: { ...EMPTY_STATS } };
}

export async function saveTournamentRecord(
  record: TournamentRecord,
): Promise<void> {
  try {
    await AsyncStorage.setItem(TOURNAMENT_KEY, JSON.stringify(record));
  } catch (e) {
    console.error("Error saving tournament:", e);
  }
}

// ──────────────────────────────────────────────
// LIFECYCLE
// ──────────────────────────────────────────────

/**
 * Roll the record into the current period when needed. On a fresh month (or the
 * first run) it re-baselines to current lifetime stats, picks a fresh rival,
 * captures the just-finished month's score for calibration, and clears the
 * resolved flag — while PRESERVING the trophy case and carrying enrollment over
 * (a calm "you're still in" rather than re-asking every month). Returns the same
 * reference when already current (no churn).
 */
export function ensureLeaguePeriod(
  record: TournamentRecord,
  stats: AchievementStats,
  now: Date = new Date(),
): TournamentRecord {
  const periodKey = currentPeriodKey(now);
  if (record.periodKey === periodKey) return record;

  const priorScore = record.periodKey
    ? leagueScore(stats, record.baseline, daysInMonth(record.periodKey))
    : record.priorScore;
  const rival = pickRival(periodKey);

  return {
    periodKey,
    enrolled: record.enrolled,
    baseline: { ...stats },
    rival: { archetype: rival.archetype, name: rival.name },
    resolved: false,
    trophies: record.trophies,
    startedAt: now.getDate(),
    priorScore,
  };
}

/**
 * Opt in. Re-baselines to the current stats so ONLY activity after joining
 * counts (no retroactive credit) and starts the race from today.
 */
export function enroll(
  record: TournamentRecord,
  stats: AchievementStats,
  now: Date = new Date(),
): TournamentRecord {
  return {
    ...record,
    enrolled: true,
    baseline: { ...stats },
    resolved: false,
    startedAt: now.getDate(),
  };
}

/**
 * Settle the month once it has ended. Awards a Trophy when the user met or beat
 * the pacer; otherwise simply marks the record resolved (NO penalty, no loss
 * state). Idempotent via the `resolved` flag + trophy-id de-dupe.
 */
export function resolveIfMonthEnded(
  stats: AchievementStats,
  record: TournamentRecord,
  now: Date = new Date(),
): { record: TournamentRecord; awardedTrophy: Trophy | null } {
  if (record.resolved || !record.periodKey) {
    return { record, awardedTrophy: null };
  }
  if (!monthHasEnded(record.periodKey, now)) {
    return { record, awardedTrophy: null };
  }
  // Month is over.
  if (!record.enrolled) {
    return { record: { ...record, resolved: true }, awardedTrophy: null };
  }

  const w = raceWindow(record, now);
  const userScore = leagueScore(stats, record.baseline, w.raceTotalDays);
  const rivalScore = rivalScoreAt(
    record.rival.archetype,
    1,
    w.calibratedTarget,
    userScore,
  );

  if (userScore < rivalScore) {
    return { record: { ...record, resolved: true }, awardedTrophy: null };
  }

  const tier = trophyTier(userScore, rivalScore);
  const trophy: Trophy = {
    id: record.periodKey,
    periodKey: record.periodKey,
    title: trophyTitle(record.periodKey, tier),
    tier,
    icon: TROPHY_ICON[tier],
    accent: TIER_META[tier].color,
    score: userScore,
    rivalName: record.rival.name,
    wonAt: now.toISOString(),
  };
  const trophies = record.trophies.some((t) => t.id === trophy.id)
    ? record.trophies
    : [...record.trophies, trophy];
  return {
    record: { ...record, resolved: true, trophies },
    awardedTrophy: trophy,
  };
}

/** The permanent trophy case, newest month first. */
export function getTrophies(record: TournamentRecord): Trophy[] {
  return [...record.trophies].sort((a, b) =>
    b.periodKey.localeCompare(a.periodKey),
  );
}

// ──────────────────────────────────────────────
// COPY (service-layer, warm, emoji-free)
// ──────────────────────────────────────────────

export interface StandingSummary {
  headline: string;
  detail: string;
  tone: GozlinTone;
}

/** Warm, pacing-not-combat standing copy. Never shaming, never a loss state. */
export function standingSummary(
  s: Standings,
  rivalName: string,
): StandingSummary {
  const margin = s.userScore - s.rivalScore;
  const close = Math.max(20, 0.08 * Math.max(s.userScore, s.rivalScore, 1));

  if (s.daysLeft <= 0) {
    return s.leader === "user"
      ? {
          headline: `You kept pace with ${rivalName}.`,
          detail: "The month is done — that pace earned a trophy.",
          tone: "proud",
        }
      : {
          headline: `A solid month alongside ${rivalName}.`,
          detail:
            "You moved further than the scoreboard shows. A fresh rival is already warming up for next month.",
          tone: "warm",
        };
  }

  if (Math.abs(margin) <= close) {
    return {
      headline: "Neck and neck.",
      detail: `You and ${rivalName} are stride for stride — a quiet, steady day or two tips it your way.`,
      tone: "steady",
    };
  }

  if (s.leader === "user") {
    return {
      headline: "You're setting the pace.",
      detail: `Out in front of ${rivalName} with room to breathe. Keep it gentle and steady.`,
      tone: "proud",
    };
  }

  return {
    headline: `${rivalName} is a step ahead.`,
    detail: "No rush — one more real win today and you're right back in it.",
    tone: "warm",
  };
}

/** The label for the active league period, e.g. "June 2026". */
export function leaguePeriodLabel(
  record: TournamentRecord,
  now: Date = new Date(),
): string {
  return periodLabel(record.periodKey || currentPeriodKey(now));
}
