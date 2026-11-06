/**
 * services/smart — the shapes every smart moment shares.
 *
 * A "smart moment" is one sentence the app offers because it noticed
 * something: a reminder that could move, a usual breakfast, a hard weekday.
 * Each feature decides whether it HAS something to say; whether it gets to SAY
 * it is decided once, for all of them, by the arbiter (./arbiter).
 */

/** Which feature a moment belongs to — also the analytics name. */
export type SmartFeature =
  | "reminder-move"
  | "usual"
  | "rough-day"
  | "welcome-back"
  | "fresh-start"
  | "good-days"
  | "hard-day"
  | "why"
  | "anchor"
  | "hungry-week";

/**
 * Moments that are never counted, for anyone. A cycle moment's timing IS cycle
 * data: "the hungrier-week card appeared today" tells a server roughly when
 * someone's period is due, and the privacy policy promises it never sees that
 * (owner's decision, 2026-11-03). They still take their place in the quiet layer.
 */
export const UNCOUNTED_FEATURES: readonly SmartFeature[] = ["hungry-week"];

/** Where a moment is shown. One new moment per surface per day. */
export type SmartSurface =
  | "home"
  | "diet"
  | "fitness"
  | "habit"
  | "habit-form"
  | "reminders"
  | "gozlin"
  | "memory";

/** A moment a feature would like to show. */
export interface SmartCandidate {
  /** Stable identity of THIS suggestion — what a "Not now" is remembered by. */
  id: string;
  feature: SmartFeature;
  /** Higher wins a surface. */
  priority: number;
  /**
   * The direct answer to something the user just did (the chain chip after
   * logging an anchor). Exempt from the daily caps — it is not unprompted — but
   * still silent in the first days and on a rough day.
   */
  exempt?: boolean;
}

/** A moment that reached the screen, by local day. Device-local. */
export interface ShownRecord {
  date: string;
  id: string;
  feature: SmartFeature;
  surface: SmartSurface;
  exempt?: boolean;
}

/** What the user said to a moment. Synced, so a "Not now" holds on every phone. */
export interface SmartAnswer {
  id: string;
  feature: SmartFeature;
  answer: "accepted" | "declined" | "dismissed";
  /** UTC ISO time of the answer — the merge compares it as a string. */
  at: string;
  /** Last local day of the cool-down, inclusive. Absent = no cool-down. */
  until?: string;
  /** Whatever the feature needs to judge a re-ask (e.g. the minute it suggested). */
  value?: number | string;
}

/** What the arbiter needs to know about today. */
export interface GateState {
  today: string;
  /** First day of the account, when known. */
  accountSince: string | null;
  /** Today is a rough day: nothing speaks. */
  roughDay: boolean;
}
