/**
 * MOMENT ENGINE — the two halves of game feel that thresholds can't give you.
 *
 * WHY THIS EXISTS. The achievement system rewards you for crossing a number:
 * 100 meals logged, 30-day streak, 500 reps. Every one of those is
 * RETROSPECTIVE and PREDICTABLE — you can see it coming from a mile away, and
 * the celebration is a receipt for something that already happened. That is the
 * least interesting part of any game. Nobody plays for the trophy screen.
 *
 * What actually pulls a person back is the other two things:
 *
 *   SURPRISE   — "you've never done that before", said the moment it's true.
 *                Unpredictable by construction: you can't grind toward it,
 *                because it's defined against YOUR history, not a constant.
 *
 *   ANTICIPATION — "two days from your record". The moment before you know is
 *                where the tension lives, and the app currently has none of it.
 *
 * So this engine emits two different things, and the difference matters:
 *
 *   Moment  → something true and surprising that JUST happened. Celebrated.
 *   Nudge   → something not yet true but within reach. Never celebrated; shown
 *             quietly, because a celebration for a thing you haven't done yet
 *             is the exact hollow feeling this engine exists to avoid.
 *
 * THE NUMBERS RULE. Every figure below is counted from real logs on this
 * device — no estimates, no projections, no "on track for". That is the same
 * doctrine services/gozlin/agent/grounding.ts enforces on the coach, and it is
 * what makes a line like "your old record was 12" land instead of ringing
 * hollow. A moment built on an invented number is worse than no moment.
 *
 * FIRING ONCE. Each detector is guarded by a persisted record, not by a
 * timestamp window, because "did this already fire" must survive a reinstall
 * and a cold start. Ids are content-addressed (`moment:best-week:2026-08-17`)
 * so the same week can never produce two notices even if the record is lost.
 *
 * Pure and dependency-light on purpose: no React, no navigation, and the only
 * runtime import is the icon glyph map. Everything is a function of its inputs
 * plus the record, which is what makes it testable without a device.
 */

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { DietHistoryEntry } from "../models/diet";
import type { SessionSummaryData } from "../models/session";
import type { WorkoutLogEntry } from "../models/workout";
import type { StreakData } from "./StreakService";

const MOMENTS_KEY = "@welliva_moments";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export type MomentKind =
  | "streak_record"
  | "comeback"
  | "best_training_week"
  | "session_record"
  | "pattern_noticed";

/** Something true, surprising, and just-happened. Gets a celebration. */
export interface Moment {
  /** Content-addressed — the de-dupe key, stable across reinstalls. */
  id: string;
  kind: MomentKind;
  /** Short headline. Sentence case, no exclamation marks. */
  title: string;
  /**
   * The coach's line. One sentence, and every number in it was counted from
   * the logs passed in — never derived, never rounded up for effect.
   */
  line: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Semantic accent name resolved to a palette colour by the caller. */
  tone: "gold" | "flame" | "water" | "success";
}

export type NudgeKind =
  | "streak_near_record"
  | "week_near_record"
  | "active_days_near";

/** Something not yet true but within reach. Shown quietly. NEVER celebrated. */
export interface Nudge {
  id: string;
  kind: NudgeKind;
  /** The pull, in the user's second person. "2 days from your longest streak." */
  headline: string;
  /** The stake — what the record actually is. Always a counted number. */
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "gold" | "flame" | "water" | "success";
  /** For the progress hairline. `value` and `target` are both real counts. */
  progress: { value: number; target: number };
}

/**
 * What the engine has already said, so it never says it twice.
 *
 * `knownLongestStreak` is deliberately OUR copy rather than a read of
 * StreakData.longestStreak: that field updates the instant the record is
 * broken, so comparing against it would make "did you just beat it" always
 * false. We need the value as it stood BEFORE this check.
 */
export interface MomentRecord {
  /** momentId → ISO first noticed. */
  noticed: Record<string, string>;
  /** Longest streak as of the last check — the record to beat. */
  knownLongestStreak: number;
  /**
   * True while the user is inside record territory. Stops a record-breaking
   * streak from firing again on day 14, 15, 16… — you beat the record once,
   * then you hold it until it breaks.
   */
  streakRecordHeld: boolean;
  /** Most sessions in any single completed week so far. */
  bestWeekSessions: number;
  /** Highest total reps in any single session so far. */
  bestSessionReps: number;
}

export const EMPTY_MOMENT_RECORD: MomentRecord = {
  noticed: {},
  knownLongestStreak: 0,
  streakRecordHeld: false,
  bestWeekSessions: 0,
  bestSessionReps: 0,
};

export interface MomentInput {
  today: string; // YYYY-MM-DD
  streak: StreakData;
  workoutLog: WorkoutLogEntry[];
  sessionHistory: SessionSummaryData[];
  dietHistory: DietHistoryEntry[];
}

// ──────────────────────────────────────────────
// DATE HELPERS (local, so this module stays pure)
// ──────────────────────────────────────────────

function parseDate(d: string): Date {
  const [y, m, day] = d.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, day || 1);
}

function toKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  const ms = parseDate(b).getTime() - parseDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Monday-anchored week start, matching HabitService's week convention. */
function weekStartOf(dateStr: string): string {
  const d = parseDate(dateStr);
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - dow);
  return toKey(d);
}

const WEEKDAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Every date the user did anything at all. The engine's notion of "active". */
function activeDates(input: MomentInput): string[] {
  const set = new Set<string>();
  for (const w of input.workoutLog) if (w.date) set.add(w.date);
  for (const s of input.sessionHistory) if (s.date) set.add(s.date);
  for (const d of input.dietHistory) {
    if (d.date && (d.mealsConsumed ?? 0) > 0) set.add(d.date);
  }
  return [...set].sort();
}

// ──────────────────────────────────────────────
// DETECTORS
// ──────────────────────────────────────────────

/**
 * Beat your own longest streak.
 *
 * Requires a record worth beating (>= 3 days) so a brand-new user doesn't get
 * told they broke a record on day two — which is the fastest way to teach
 * someone that the app's praise means nothing.
 */
function detectStreakRecord(input: MomentInput, rec: MomentRecord): Moment | null {
  const current = input.streak.currentStreak;
  if (current <= 1) return null;
  if (rec.streakRecordHeld) return null;
  if (rec.knownLongestStreak < 3) return null;
  if (current <= rec.knownLongestStreak) return null;

  return {
    id: `moment:streak-record:${current}`,
    kind: "streak_record",
    title: "You've never gone this long",
    line: `${current} days straight. Your old record was ${rec.knownLongestStreak}.`,
    icon: "flame",
    tone: "flame",
  };
}

/**
 * Came back after a real break, and stayed.
 *
 * The stay is the point. Returning for one day is a visit; returning and
 * logging again the next day is the thing worth naming, and it is the single
 * most fragile moment in anyone's habit — so it is the one most worth catching.
 */
function detectComeback(input: MomentInput, dates: string[]): Moment | null {
  if (dates.length < 4) return null;

  // Walk back from today to find the current unbroken run and the gap before it.
  let runStart = dates[dates.length - 1];
  let runLength = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    if (daysBetween(dates[i - 1], dates[i]) === 1) {
      runStart = dates[i - 1];
      runLength++;
    } else break;
  }
  if (runLength < 2) return null;

  const idx = dates.indexOf(runStart);
  if (idx <= 0) return null;
  const gap = daysBetween(dates[idx - 1], runStart);
  // A full week away, minimum. Anything shorter is an ordinary training rhythm
  // — someone who trains Tuesday and Saturday has a four-day gap every week,
  // and congratulating them for "coming back" every Tuesday is noise that
  // teaches the user to ignore the surface entirely.
  if (gap < 8) return null;

  return {
    id: `moment:comeback:${runStart}`,
    kind: "comeback",
    title: "You came back",
    line: `${gap - 1} days away, and you've logged ${runLength} days running since. That's the hard part done.`,
    icon: "return-up-forward",
    tone: "success",
  };
}

/** Most training sessions in a single week, ever. */
function detectBestWeek(input: MomentInput, rec: MomentRecord): Moment | null {
  const byWeek = new Map<string, number>();
  for (const w of input.workoutLog) {
    if (!w.date) continue;
    const k = weekStartOf(w.date);
    byWeek.set(k, (byWeek.get(k) ?? 0) + 1);
  }
  const thisWeek = weekStartOf(input.today);
  const count = byWeek.get(thisWeek) ?? 0;
  if (count < 3) return null;

  // Only count COMPLETED weeks as the record to beat — comparing against a
  // week still in progress would let the same week beat itself.
  let prior = 0;
  let priorWeeks = 0;
  for (const [k, v] of byWeek) {
    if (k === thisWeek) continue;
    priorWeeks++;
    if (v > prior) prior = v;
  }
  if (priorWeeks < 2) return null;
  if (count <= prior) return null;
  if (count <= rec.bestWeekSessions) return null;

  return {
    id: `moment:best-week:${thisWeek}`,
    kind: "best_training_week",
    title: "Biggest training week yet",
    line: `${count} sessions this week — one more than your previous best of ${prior}.`,
    icon: "barbell",
    tone: "gold",
  };
}

/** A single session with more reps than any before it. */
function detectSessionRecord(input: MomentInput, rec: MomentRecord): Moment | null {
  const withReps = input.sessionHistory.filter((s) => (s.totalReps ?? 0) > 0);
  if (withReps.length < 4) return null;

  const latest = [...withReps].sort((a, b) =>
    (a.completedAt || "").localeCompare(b.completedAt || ""),
  )[withReps.length - 1];
  if (!latest) return null;

  const prior = withReps
    .filter((s) => s.sessionRunId !== latest.sessionRunId)
    .reduce((max, s) => Math.max(max, s.totalReps ?? 0), 0);

  if (latest.totalReps <= prior) return null;
  if (latest.totalReps <= rec.bestSessionReps) return null;

  return {
    id: `moment:session-reps:${latest.sessionRunId}`,
    kind: "session_record",
    title: "Your biggest session",
    line: `${latest.totalReps} reps in ${latest.sessionLabel} — past your previous best of ${prior}.`,
    icon: "trending-up",
    tone: "gold",
  };
}

/**
 * The coach noticing something you didn't tell it.
 *
 * This is the one moment no threshold could ever produce, and the closest this
 * engine gets to what Gozlin does with tools: a true statement about YOU,
 * derived from counting, that you would not have found yourself. Needs three
 * weeks of data before it will say anything, because a pattern claimed from
 * nine data points is a coincidence with a confident voice.
 */
function detectPattern(input: MomentInput, dates: string[]): Moment | null {
  if (dates.length < 21) return null;

  const counts = new Array(7).fill(0) as number[];
  for (const d of dates) {
    const dow = (parseDate(d).getDay() + 6) % 7; // Mon = 0
    counts[dow]++;
  }

  let bestDay = 0;
  for (let i = 1; i < 7; i++) if (counts[i] > counts[bestDay]) bestDay = i;

  const total = counts.reduce((a, b) => a + b, 0);
  const average = total / 7;
  // Needs to be genuinely lopsided, not noise — 60% above the mean.
  if (counts[bestDay] < average * 1.6) return null;

  return {
    id: `moment:pattern:weekday:${bestDay}`,
    kind: "pattern_noticed",
    title: `${WEEKDAY[bestDay]} is your day`,
    line: `You've shown up ${counts[bestDay]} ${WEEKDAY[bestDay]}s — more than any other day. Worth putting the hard session there.`,
    icon: "eye",
    tone: "water",
  };
}

// ──────────────────────────────────────────────
// PUBLIC — moments
// ──────────────────────────────────────────────

/**
 * Detect everything newly true, and return the record to persist.
 *
 * Returns at most ONE moment even when several fire. Two celebrations back to
 * back halve each other, and the maturity dial in CelebrationService can't
 * rescue a queue the engine over-filled. Ordered by how surprising each kind
 * is, not by how impressive.
 */
export function detectMoments(
  input: MomentInput,
  record: MomentRecord,
): { record: MomentRecord; newly: Moment[] } {
  const dates = activeDates(input);

  const candidates = [
    detectStreakRecord(input, record),
    detectPattern(input, dates),
    detectComeback(input, dates),
    detectBestWeek(input, record),
    detectSessionRecord(input, record),
  ].filter((m): m is Moment => m != null);

  const fresh = candidates.filter((m) => !record.noticed[m.id]);
  const chosen = fresh.slice(0, 1);

  // The record advances on EVERY check, not only when something fired —
  // otherwise a user whose first check already sits above the thresholds would
  // be told they broke a record they'd held all along.
  const next: MomentRecord = {
    noticed: { ...record.noticed },
    knownLongestStreak: Math.max(
      record.knownLongestStreak,
      input.streak.longestStreak,
      input.streak.currentStreak,
    ),
    streakRecordHeld:
      input.streak.currentStreak <= 1
        ? false
        : record.streakRecordHeld || chosen.some((m) => m.kind === "streak_record"),
    bestWeekSessions: Math.max(record.bestWeekSessions, currentWeekSessions(input)),
    bestSessionReps: Math.max(
      record.bestSessionReps,
      input.sessionHistory.reduce((m, s) => Math.max(m, s.totalReps ?? 0), 0),
    ),
  };

  const now = new Date().toISOString();
  for (const m of chosen) next.noticed[m.id] = now;

  return { record: next, newly: chosen };
}

function currentWeekSessions(input: MomentInput): number {
  const thisWeek = weekStartOf(input.today);
  return input.workoutLog.filter((w) => w.date && weekStartOf(w.date) === thisWeek).length;
}

// ──────────────────────────────────────────────
// PUBLIC — nudges (the anticipation half)
// ──────────────────────────────────────────────

/**
 * What's within reach right now. Pure derivation — nothing persists, because a
 * nudge is true or it isn't, and one that lingers after it stops being true is
 * worse than none.
 *
 * Returns at most one. The whole point is a single clear thing to reach for;
 * three competing nudges is a dashboard, which is what we're moving away from.
 */
export function detectNudge(input: MomentInput, record: MomentRecord): Nudge | null {
  const best = Math.max(record.knownLongestStreak, input.streak.longestStreak);
  const current = input.streak.currentStreak;

  // 1. The record in sight. Strongest pull there is — it's personal and close.
  if (best >= 5 && current > 0 && current <= best) {
    const away = best - current + 1;
    if (away <= 3) {
      return {
        id: `nudge:streak:${best}`,
        kind: "streak_near_record",
        headline: away === 1 ? "One day from your record" : `${away} days from your record`,
        detail: `You're on ${current}. Your longest ever is ${best}.`,
        icon: "flame",
        tone: "flame",
        progress: { value: current, target: best + 1 },
      };
    }
  }

  // 2. One session from the biggest week you've had.
  const week = currentWeekSessions(input);
  if (record.bestWeekSessions >= 3 && week > 0 && week === record.bestWeekSessions) {
    return {
      id: `nudge:week:${weekStartOf(input.today)}`,
      kind: "week_near_record",
      headline: "One session from your biggest week",
      detail: `${week} done. Your best week ever is ${record.bestWeekSessions}.`,
      icon: "barbell",
      tone: "gold",
      progress: { value: week, target: record.bestWeekSessions + 1 },
    };
  }

  // 3. A round lifetime number about to land. Quietest of the three, and only
  //    offered when nothing sharper is available.
  const totalDays = input.streak.totalActiveDays;
  for (const milestone of [50, 100, 200, 365, 500]) {
    const away = milestone - totalDays;
    if (away > 0 && away <= 3) {
      return {
        id: `nudge:active-days:${milestone}`,
        kind: "active_days_near",
        headline: away === 1 ? `One day from ${milestone}` : `${away} days from ${milestone}`,
        detail: `${totalDays} active days logged so far.`,
        icon: "calendar",
        tone: "water",
        progress: { value: totalDays, target: milestone },
      };
    }
  }

  return null;
}

// ──────────────────────────────────────────────
// PERSISTENCE
// ──────────────────────────────────────────────

export async function loadMomentRecord(): Promise<MomentRecord> {
  try {
    const raw = await AsyncStorage.getItem(MOMENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MomentRecord>;
      return { ...EMPTY_MOMENT_RECORD, ...parsed, noticed: parsed.noticed ?? {} };
    }
  } catch (e) {
    console.error("Error loading moments:", e);
  }
  return { ...EMPTY_MOMENT_RECORD };
}

export async function saveMomentRecord(record: MomentRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(MOMENTS_KEY, JSON.stringify(record));
  } catch (e) {
    console.error("Error saving moments:", e);
  }
}
