/**
 * THE WORD FOR TODAY — the home-screen widget's gold word (owner's pick,
 * 2026-11-14: "the word, and the line of your day").
 *
 * One word, true about today, chosen by FIXED RULES from what was logged.
 * Situations are checked in priority order and the first that holds wins.
 * Each situation has a small pool of words that are all equally true of it;
 * the pool rotates BY DATE, so the word changes from day to day ("I am seeing
 * more of steady") but never flickers within a day as the widget refreshes.
 *
 * What a word may never do (the proposal's promises):
 *   - say more than happened: "strong" means a workout is logged, nothing more;
 *   - shame: a day with nothing logged gets a time-of-day word, never "lazy";
 *   - give away the private things: nothing comes from mood, weight or the
 *     cycle, and "resting" never says why the day was rough;
 *   - ask anyone to come back: no "don't forget", no countdown.
 *
 * Pure: no React Native, no storage. The widget's headless renderer and the
 * tests both call it.
 */

export type DayPeriod = "morning" | "afternoon" | "evening" | "night";

const MORNING_FROM = 5 * 60;
const AFTERNOON_FROM = 12 * 60;
const EVENING_FROM = 17 * 60;
const NIGHT_FROM = 22 * 60;
/** "Kept before 7 am" earns the early words. */
export const EARLY_BEFORE_MIN = 7 * 60;
/** "nourished" is about the whole day's food, so it waits for the evening. */
export const NOURISHED_FROM_MIN = 18 * 60;
/** A run reaching one of these today is a milestone. */
export const STREAK_MILESTONES: readonly number[] = [7, 14, 30, 50, 100, 150, 200, 365, 500, 730, 1000];
/**
 * "Welcome back" needs a real break: the last kept day before today was at
 * least this many days ago (so two or more days were missed, not just one).
 */
export const COMEBACK_MIN_GAP_DAYS = 3;
/** Three or more kinds of thing logged makes "a full day". */
export const FULL_DAY_KINDS = 3;

/** Minutes since local midnight → the part of the day. */
export function periodOf(minute: number): DayPeriod {
  if (minute >= NIGHT_FROM || minute < MORNING_FROM) return "night";
  if (minute >= EVENING_FROM) return "evening";
  if (minute >= AFTERNOON_FROM) return "afternoon";
  return "morning";
}

/** Everything the rules read. Built from the stored snapshot (./todaySnapshot). */
export interface DayFacts {
  /** Local YYYY-MM-DD. */
  date: string;
  /** 0 = Sunday. */
  weekday: number;
  dayOfMonth: number;
  /** Now, in minutes since local midnight. */
  minute: number;
  /** Anything at all logged today. */
  anyLogged: boolean;
  kept: boolean;
  /** When the day was kept, minutes since midnight. */
  keptAtMin: number | null;
  keptYesterday: boolean;
  /** The live run, today included when kept. */
  streak: number;
  /** Days from the last kept day BEFORE today to today; null when unknown or none. */
  daysAway: number | null;
  rough: boolean;
  /** A streak freeze kept yesterday (services/commitment freezes). */
  freezeHeld: boolean;
  workoutDone: boolean;
  waterGoalMet: boolean;
  /** Calories within 10% of target and protein met. */
  nourished: boolean;
  /** Distinct kinds logged today (food, water, a workout, mood, a habit, a weigh-in). */
  kinds: number;
}

export type Situation =
  | "rough"
  | "milestone"
  | "comeback"
  | "freeze"
  | "workout"
  | "nourished"
  | "hydrated"
  | "fullDay"
  | "early"
  | "steady"
  | "keptDay"
  | "keptEvening"
  | "keptNight"
  | "newMonth"
  | "newWeek"
  | "weekendMorning"
  | "morning"
  | "afternoon"
  | "evening"
  | "night";

/** Every word the widget can show, by situation. Each word is true of its situation. */
export const WORD_POOLS: Readonly<Record<Situation, readonly string[]>> = {
  rough: ["resting", "gentle", "easy does it", "go slow"],
  milestone: ["milestone", "landmark", "well earned"],
  comeback: ["welcome back", "back", "return"],
  freeze: ["held", "still lit", "safe"],
  workout: ["strong", "moved", "trained", "active", "sweat"],
  nourished: ["nourished", "well fed", "balanced", "fuelled"],
  hydrated: ["hydrated", "quenched", "well watered"],
  fullDay: ["full day", "thorough", "well rounded", "busy"],
  early: ["early bird", "early", "sunrise"],
  steady: ["steady", "in rhythm", "consistent", "on a roll", "rolling"],
  keptDay: ["begun", "underway", "on track", "kept"],
  keptEvening: ["done", "settled", "content", "complete"],
  keptNight: ["rest easy", "goodnight", "day done"],
  newMonth: ["new month", "clean slate"],
  newWeek: ["new week", "clean slate"],
  weekendMorning: ["slow morning", "weekend", "slow start"],
  morning: ["fresh", "new day", "good morning", "blank page"],
  afternoon: ["open", "midday", "still open", "unwritten"],
  evening: ["quiet", "calm", "unhurried"],
  night: ["goodnight", "rest", "late"],
};

/** "8:10" — the widget's own clock, 24-hour, no leading zero. */
export function clockOf(minute: number): string {
  const m = Math.max(0, Math.round(minute)) % (24 * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/** Which situation holds, in priority order. */
export function situationOf(f: DayFacts): Situation {
  const period = periodOf(f.minute);
  if (f.rough) return "rough";
  if (f.kept && STREAK_MILESTONES.includes(f.streak)) return "milestone";
  if (f.kept && f.daysAway != null && f.daysAway >= COMEBACK_MIN_GAP_DAYS) return "comeback";
  if (f.freezeHeld && !f.anyLogged) return "freeze";
  if (f.workoutDone) return "workout";
  if (f.nourished && f.minute >= NOURISHED_FROM_MIN) return "nourished";
  if (f.waterGoalMet) return "hydrated";
  if (f.kinds >= FULL_DAY_KINDS) return "fullDay";
  if (f.kept && f.keptAtMin != null && f.keptAtMin < EARLY_BEFORE_MIN && period === "morning") return "early";
  if (f.kept && f.keptYesterday) return "steady";
  if (f.kept) {
    if (period === "evening") return "keptEvening";
    if (period === "night") return "keptNight";
    return "keptDay";
  }
  if (period === "night") return "night";
  if (period === "evening") return "evening";
  if (period === "afternoon") return "afternoon";
  if (f.dayOfMonth === 1) return "newMonth";
  if (f.weekday === 1) return "newWeek";
  if (f.weekday === 0 || f.weekday === 6) return "weekendMorning";
  return "morning";
}

/** The small line under the word: why it was chosen, plainly. */
export function whyOf(situation: Situation, f: DayFacts): string {
  switch (situation) {
    case "rough":
      return "rough day marked";
    case "milestone":
      return `${f.streak} days in a row`;
    case "comeback":
      return "first kept day in a while";
    case "freeze":
      return "a freeze kept your run";
    case "workout":
      return "workout done";
    case "nourished":
      return "on target · protein met";
    case "hydrated":
      return "water goal met";
    case "fullDay":
      return "a full day logged";
    case "early":
      return f.keptAtMin != null ? `kept at ${clockOf(f.keptAtMin)}` : "kept early";
    case "steady":
      return "kept today and yesterday";
    case "keptDay":
      return f.keptAtMin != null ? `kept since ${clockOf(f.keptAtMin)}` : "day kept";
    case "keptEvening":
    case "keptNight":
      return "day kept";
    case "evening":
    case "night":
      return "nothing kept today";
    default:
      return f.anyLogged ? "nothing kept yet" : "nothing logged yet";
  }
}

/** FNV-1a: the same date and situation always land on the same word. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface TodayWord {
  situation: Situation;
  word: string;
  why: string;
}

/** Today's word, its reason, and which rule chose it. */
export function wordFor(f: DayFacts): TodayWord {
  const situation = situationOf(f);
  const pool = WORD_POOLS[situation];
  const word = pool[hash(`${f.date}|${situation}`) % pool.length];
  return { situation, word, why: whyOf(situation, f) };
}
