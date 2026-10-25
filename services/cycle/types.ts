/**
 * services/cycle/types.ts — the cycle tracker's data model.
 *
 * THREE DOCUMENTS, each with its own merge rule (services/sync/mergeStrategies):
 *
 *   settings  — one object, last-write-wins. What she chose, never what she logged.
 *   periods   — PeriodEpisode[], merged by id on `updatedAt`. Removing a period
 *               leaves a TOMBSTONE (`deleted: true`, newer stamp) so the removal
 *               beats a full copy still sitting on another phone, instead of
 *               being merged straight back in by the union.
 *   days      — Record<date, CycleDayLog>, merged per day on `updatedAt`. Clearing
 *               a day writes an empty log with a newer stamp, for the same reason.
 *
 * PERIODS ARE EPISODES, NOT A SET OF RED DAYS. "Started" and "ended" are the two
 * taps the owner asked for, and an episode is exactly that pair. A period that is
 * still going has `end: null`; every reader resolves it through
 * episodes.resolvedEnd, which also decides when an unended period is old enough
 * to have been forgotten rather than still running.
 *
 * Values are stable storage strings: ADD new ones, never rename.
 */

import { isIsoDate } from "./dates";

export const FLOWS = ["spotting", "light", "medium", "heavy"] as const;
export type Flow = (typeof FLOWS)[number];

export const SYMPTOMS = [
  "cramps",
  "headache",
  "bloating",
  "tender_breasts",
  "back_pain",
  "acne",
  "cravings",
  "nausea",
] as const;
export type Symptom = (typeof SYMPTOMS)[number];

export const MOODS = ["great", "okay", "low", "irritable", "anxious"] as const;
export type CycleMood = (typeof MOODS)[number];

export const ENERGIES = ["low", "steady", "high"] as const;
export type Energy = (typeof ENERGIES)[number];

export type OvulationTest = "positive" | "negative";

export const FLOW_LABEL: Record<Flow, string> = {
  spotting: "Spotting",
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
};

export const SYMPTOM_LABEL: Record<Symptom, string> = {
  cramps: "Cramps",
  headache: "Headache",
  bloating: "Bloating",
  tender_breasts: "Tender breasts",
  back_pain: "Back pain",
  acne: "Breakouts",
  cravings: "Cravings",
  nausea: "Nausea",
};

export const MOOD_LABEL: Record<CycleMood, string> = {
  great: "Great",
  okay: "Okay",
  low: "Low",
  irritable: "Irritable",
  anxious: "Anxious",
};

export const ENERGY_LABEL: Record<Energy, string> = {
  low: "Low",
  steady: "Steady",
  high: "High",
};

/** One period, from the day it started to the last day of bleeding. */
export interface PeriodEpisode {
  id: string;
  /** First day. */
  start: string;
  /** Last day, inclusive. `null` = still going (she hasn't said it ended). */
  end: string | null;
  /**
   * The end was ASSUMED, not logged — an unended period closed by a later one,
   * or by age. Excluded from period-length statistics: a guessed length is not
   * evidence of her real one.
   */
  endEstimated?: boolean;
  /** Tombstone. Kept so a removal propagates across devices. */
  deleted?: boolean;
  /** ISO instant of the last change — the merge's tie-break. */
  updatedAt: string;
}

/** What she noted about one day. Every field is optional; an empty log is a cleared day. */
export interface CycleDayLog {
  date: string;
  flow?: Flow;
  symptoms?: Symptom[];
  mood?: CycleMood;
  energy?: Energy;
  /** Only offered when the fertile window is shown. Sharpens the ovulation estimate. */
  ovulationTest?: OvulationTest;
  updatedAt: string;
}

export type CycleDays = Record<string, CycleDayLog>;

/**
 * What she told us about a long gap between two periods, keyed by the start
 * date of the cycle it belongs to:
 *   long  — it really was one long cycle (counts in the average)
 *   pause — pregnancy, illness or a break from logging (never counts)
 */
export type GapNote = "long" | "pause";

export interface CycleSettings {
  enabled: boolean;
  enabledAt: string | null;
  /** Her answer to "how long is your cycle usually?" — null for "not sure". */
  usualCycleDays: number | null;
  /** Her answer to "how long does your period usually last?" — null for "not sure". */
  usualPeriodDays: number | null;
  /** Off by default (owner, 2026-10-15): useful to some, relied on as contraception by none. */
  showFertileWindow: boolean;
  remindersOn: boolean;
  /** Lock-screen wording never names the period. On by default. */
  discreet: boolean;
  /** Include the cycle log in the account backup. On by default (owner, 2026-10-15). */
  backupOn: boolean;
  gapNotes: Record<string, GapNote>;
  /** Doctor note id → the evidence signature it was dismissed at. */
  dismissedFlags: Record<string, string>;
  /** Days she chose the full workout over the cycle-eased one. Newest last, capped. */
  fullSessionDays: string[];
  /** First day the profile was seen postpartum — predictions restart from here. */
  postpartumSince: string | null;
  /** The Home invitation was answered "not now". */
  offerDismissed: boolean;
  /**
   * "Let Gozlin see your cycle" was answered "not now". Once and for all — the
   * Settings toggle is always there, and a consent question that keeps coming
   * back is not a question.
   */
  gozlinAskDismissed: boolean;
  /**
   * The days the ask was PUT IN FRONT OF HER, capped at {@link GOZLIN_ASK_LIMIT}.
   * Scrolling past a card is not declining it — it may never have been seen —
   * so an unanswered ask is allowed to come back on another hard day. This is
   * what stops it coming back forever. Newest last.
   */
  gozlinAskDays: string[];
  updatedAt: string;
}

export const USUAL_CYCLE_RANGE = { min: 18, max: 60 } as const;
export const USUAL_PERIOD_RANGE = { min: 1, max: 12 } as const;
export const FULL_SESSION_MEMORY = 12;
/**
 * How many separate days the "let Gozlin see your cycle" ask may appear on
 * before it gives up for good. Three: the one well-timed ask, and two more in
 * case the first two were below the fold on a day she was not reading.
 */
export const GOZLIN_ASK_LIMIT = 3;

export const DEFAULT_CYCLE_SETTINGS: CycleSettings = {
  enabled: false,
  enabledAt: null,
  usualCycleDays: null,
  usualPeriodDays: null,
  showFertileWindow: false,
  remindersOn: true,
  discreet: true,
  backupOn: true,
  gapNotes: {},
  dismissedFlags: {},
  fullSessionDays: [],
  postpartumSince: null,
  offerDismissed: false,
  gozlinAskDismissed: false,
  gozlinAskDays: [],
  updatedAt: "",
};

export interface CycleData {
  settings: CycleSettings;
  periods: PeriodEpisode[];
  days: CycleDays;
}

/* ─────────────────────────── normalizers ───────────────────────────
 * Every document can arrive from another device or an older build. Readers
 * must never trust its shape: a bad field becomes its default, never a throw.
 */

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function intIn(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
    ? Math.round(v)
    : null;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function normalizeSettings(raw: unknown): CycleSettings {
  if (!isObject(raw)) return { ...DEFAULT_CYCLE_SETTINGS };
  const gapNotes: Record<string, GapNote> = {};
  if (isObject(raw.gapNotes)) {
    for (const [k, v] of Object.entries(raw.gapNotes)) {
      if (isIsoDate(k) && (v === "long" || v === "pause")) gapNotes[k] = v;
    }
  }
  const dismissedFlags: Record<string, string> = {};
  if (isObject(raw.dismissedFlags)) {
    for (const [k, v] of Object.entries(raw.dismissedFlags)) {
      if (typeof v === "string") dismissedFlags[k] = v;
    }
  }
  const fullSessionDays = Array.isArray(raw.fullSessionDays)
    ? [...new Set(raw.fullSessionDays.filter(isIsoDate))].sort().slice(-FULL_SESSION_MEMORY)
    : [];
  const gozlinAskDays = Array.isArray(raw.gozlinAskDays)
    ? [...new Set(raw.gozlinAskDays.filter(isIsoDate))].sort().slice(-GOZLIN_ASK_LIMIT)
    : [];
  const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  const d = DEFAULT_CYCLE_SETTINGS;
  return {
    enabled: bool(raw.enabled, d.enabled),
    enabledAt: typeof raw.enabledAt === "string" ? raw.enabledAt : null,
    usualCycleDays: intIn(raw.usualCycleDays, USUAL_CYCLE_RANGE.min, USUAL_CYCLE_RANGE.max),
    usualPeriodDays: intIn(raw.usualPeriodDays, USUAL_PERIOD_RANGE.min, USUAL_PERIOD_RANGE.max),
    showFertileWindow: bool(raw.showFertileWindow, d.showFertileWindow),
    remindersOn: bool(raw.remindersOn, d.remindersOn),
    discreet: bool(raw.discreet, d.discreet),
    backupOn: bool(raw.backupOn, d.backupOn),
    gapNotes,
    dismissedFlags,
    fullSessionDays,
    postpartumSince: isIsoDate(raw.postpartumSince) ? raw.postpartumSince : null,
    offerDismissed: bool(raw.offerDismissed, d.offerDismissed),
    gozlinAskDismissed: bool(raw.gozlinAskDismissed, d.gozlinAskDismissed),
    gozlinAskDays,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

export function normalizePeriods(raw: unknown): PeriodEpisode[] {
  if (!Array.isArray(raw)) return [];
  const out: PeriodEpisode[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    if (typeof item.id !== "string" || !item.id || !isIsoDate(item.start)) continue;
    const end = isIsoDate(item.end) && item.end >= item.start ? item.end : null;
    out.push({
      id: item.id,
      start: item.start,
      end,
      ...(item.endEstimated === true && end ? { endEstimated: true } : {}),
      ...(item.deleted === true ? { deleted: true } : {}),
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
    });
  }
  return out;
}

export function normalizeDayLog(date: string, raw: unknown): CycleDayLog | null {
  if (!isIsoDate(date) || !isObject(raw)) return null;
  const symptoms = Array.isArray(raw.symptoms)
    ? [...new Set(raw.symptoms.filter((s): s is Symptom => oneOf(s, SYMPTOMS) !== undefined))]
    : [];
  const log: CycleDayLog = {
    date,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
  const flow = oneOf(raw.flow, FLOWS);
  const mood = oneOf(raw.mood, MOODS);
  const energy = oneOf(raw.energy, ENERGIES);
  const test = oneOf(raw.ovulationTest, ["positive", "negative"] as const);
  if (flow) log.flow = flow;
  if (symptoms.length) log.symptoms = symptoms;
  if (mood) log.mood = mood;
  if (energy) log.energy = energy;
  if (test) log.ovulationTest = test;
  return log;
}

export function normalizeDays(raw: unknown): CycleDays {
  if (!isObject(raw)) return {};
  const out: CycleDays = {};
  for (const [date, value] of Object.entries(raw)) {
    const log = normalizeDayLog(date, value);
    if (log) out[date] = log;
  }
  return out;
}

/** A day log that records nothing — a cleared day, kept only as a merge tombstone. */
export function isEmptyDayLog(log: CycleDayLog | undefined | null): boolean {
  if (!log) return true;
  return (
    !log.flow &&
    !(log.symptoms && log.symptoms.length) &&
    !log.mood &&
    !log.energy &&
    !log.ovulationTest
  );
}
