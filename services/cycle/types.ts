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

/**
 * The symptoms "what helped?" asks about (./relief), most significant first —
 * when she logged more than one, the first here is the one asked about.
 */
export const RELIEF_SYMPTOMS = ["cramps", "headache", "back_pain", "nausea"] as const;
export type ReliefSymptom = (typeof RELIEF_SYMPTOMS)[number];

/** What helped — her one-tap answer. */
export const RELIEFS = ["heat", "moving", "painkiller", "rest", "sleep", "hot_drink", "other", "nothing"] as const;
export type Relief = (typeof RELIEFS)[number];

/** Her answer about one symptom, kept on the day she logged it. "skipped" = asked, and passed. */
export interface ReliefNote {
  symptom: ReliefSymptom;
  helped: Relief | "skipped";
}

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
  /** "What helped most?", answered the next day — at most one entry per symptom logged here. */
  relief?: ReliefNote[];
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

/**
 * Her answer to "Do you use hormonal contraception?" (the pill, patch, ring,
 * implant, injection or a hormonal coil). Optional, asked without judgement:
 *   hormonal — bleeding follows the method, not a cycle, so it is logged and
 *              never predicted (./predict's "hormonal" mode)
 *   none     — predictions as usual
 *   unsaid   — "prefer not to say": predictions as usual
 */
export const CONTRACEPTION_ANSWERS = ["hormonal", "none", "unsaid"] as const;
export type ContraceptionAnswer = (typeof CONTRACEPTION_ANSWERS)[number];

export interface Contraception {
  answer: ContraceptionAnswer;
  /** The day she gave this answer. */
  since: string;
  /**
   * Set when she stops a hormonal method: the first day her history counts
   * from again. Bleeds before it followed the method rather than her cycle, so
   * they never reach the averages, the patterns or the cycle-length notes —
   * the same fresh start `postpartumSince` gives after a birth.
   */
  restartFrom: string | null;
}

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
  /** "Do you use hormonal contraception?" — null until she answers (it is optional). */
  contraception: Contraception | null;
  /**
   * The day "many people hold extra water before a period" was first put in
   * front of her. It is said once, so it stays for that day and never returns.
   */
  waterNoteOn: string | null;
  /** She said yes to planning for her hungrier week. Off until she does; every cycle after that. */
  planHungryWeek: boolean;
  /** The day she said yes: the plan can't reach back past it. */
  hungryPlanFrom: string | null;
  /** "No thanks", for good. The switch in cycle settings is always there. */
  hungryDeclined: boolean;
  /**
   * Date → kcal the plan moved that day's target by. The past is frozen here
   * because history doesn't keep the target a day had, and the prediction that
   * chose these days has moved on since; "% of target" still has to be right.
   */
  hungryLedger: Record<string, number>;
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
  contraception: null,
  waterNoteOn: null,
  planHungryWeek: false,
  hungryPlanFrom: null,
  hungryDeclined: false,
  hungryLedger: {},
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

/** An answer without a valid day is no answer: it couldn't say where her history restarts. */
function normalizeContraception(raw: unknown): Contraception | null {
  if (!isObject(raw)) return null;
  const answer = oneOf(raw.answer, CONTRACEPTION_ANSWERS);
  if (!answer || !isIsoDate(raw.since)) return null;
  return {
    answer,
    since: raw.since,
    restartFrom: isIsoDate(raw.restartFrom) ? raw.restartFrom : null,
  };
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
  const hungryLedger: Record<string, number> = {};
  if (isObject(raw.hungryLedger)) {
    for (const [k, v] of Object.entries(raw.hungryLedger)) {
      if (isIsoDate(k) && typeof v === "number" && Number.isFinite(v)) hungryLedger[k] = Math.round(v);
    }
  }
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
    contraception: normalizeContraception(raw.contraception),
    waterNoteOn: isIsoDate(raw.waterNoteOn) ? raw.waterNoteOn : null,
    planHungryWeek: bool(raw.planHungryWeek, d.planHungryWeek),
    hungryPlanFrom: isIsoDate(raw.hungryPlanFrom) ? raw.hungryPlanFrom : null,
    hungryDeclined: bool(raw.hungryDeclined, d.hungryDeclined),
    hungryLedger,
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
  // An answer about a symptom this day doesn't carry is an answer about nothing.
  const relief = normalizeRelief(raw.relief).filter((r) => symptoms.includes(r.symptom));
  if (relief.length) log.relief = relief;
  return log;
}

/** One entry per symptom, the last one written winning; anything malformed dropped. */
function normalizeRelief(raw: unknown): ReliefNote[] {
  if (!Array.isArray(raw)) return [];
  const bySymptom = new Map<ReliefSymptom, ReliefNote>();
  for (const item of raw) {
    if (!isObject(item)) continue;
    const symptom = oneOf(item.symptom, RELIEF_SYMPTOMS);
    const helped = item.helped === "skipped" ? "skipped" : oneOf(item.helped, RELIEFS);
    if (symptom && helped) bySymptom.set(symptom, { symptom, helped });
  }
  return [...bySymptom.values()];
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
