/**
 * GOZLIN — the habit TRACKER, as something the coach actually knows about.
 *
 * ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────
 * GozlinHabitEngine reads *behaviour*: adherence, training load, weekend dips,
 * sleep links. All of it inferred from meals and sessions. None of it knows
 * that the user typed "Take vitamins, 5× a week" into the habit tracker and has
 * hit it eleven weeks running — the one part of their routine they declared out
 * loud, and the only part Gozlin was blind to.
 *
 * This module is that half. It turns the tracker's live habits and its RETIRED
 * ones into compact, citable facts, and it decides — conservatively — when one
 * of them is worth raising unprompted.
 *
 * ── THE TWO RULES THAT MAKE IT NOT CREEPY ───────────────────────────────────
 *
 *   1. NEVER AT THE MOMENT IT HAPPENS. A habit deleted on Tuesday is not
 *      mentioned on Tuesday, or that week. Someone who has just quit something
 *      does not need the app to notice out loud; a coach who brings it up the
 *      instant you stop is surveillance, and a coach who brings it up a month
 *      later, once, is a coach. Hence {@link QUIET_DAYS} and a window that
 *      eventually closes for good.
 *
 *   2. NEVER OUT OF NOWHERE. A cross-reference has to be ANCHORED — either to
 *      something the user just said (see {@link crossReference}) or to a surface
 *      that is already about habits. "By the way, you missed your vitamins on
 *      Thursday" is an intrusion. The same sentence inside a conversation the
 *      user started about vitamins is a coach paying attention.
 *
 * Everything here is pure, deterministic and injectable-`today`. The sampling
 * that makes a beat "occasional" is a HASH, not a random number and not a
 * counter in storage: the same day always gives the same answer, so nothing has
 * to be written to remember what was already said, and nothing changes under
 * the user mid-scroll.
 */

import type { Habit, HabitStats, RetiredHabit } from "../../models/habit";
import { parseLocalDate, toLocalDateString } from "../OfflineStorage";

// ── Tunables ────────────────────────────────────────────────────────

/** Days of silence after a habit is retired before it may be mentioned at all. */
export const QUIET_DAYS = 12;
/** After this, a retired habit is history rather than news. It stops coming up. */
export const RETIRED_WINDOW_DAYS = 90;
/** Roughly one day in this many is eligible for an unprompted retired-habit beat. */
const BEAT_SAMPLE = 5;
/** Roughly one day in this many is eligible for an unprompted cross-reference. */
const CROSS_SAMPLE = 2;
/** How far back a "you missed it on…" claim may reach. */
const MISS_LOOKBACK_DAYS = 10;
/** A habit needs at least this many completions before its record is worth citing. */
const MIN_RECORD_DONE = 5;

const DAY_NAME = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTH_NAME = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ── Facts ───────────────────────────────────────────────────────────

/** One live tracked habit, reduced to what a coach would actually cite. */
export interface TrackedHabitFact {
  id: string;
  name: string;
  /** "Every day" / "4× a week" / "Mon, Wed, Fri". */
  frequency: string;
  streak: number;
  streakUnit: "day" | "week";
  /** Consistency over the last 30 days, 0–100. */
  last30Pct: number;
  weekDone: number;
  weekTarget: number;
  doneToday: boolean;
  /** Recent days it was due and not done, newest first, at most three. */
  recentMisses: string[];
  /** Last date it was completed, or null. */
  lastDone: string | null;
}

/** One retired habit, plus how long ago and how it ended. */
export interface RetiredHabitFact {
  id: string;
  name: string;
  /** YYYY-MM-DD the user removed it. */
  retiredOn: string;
  daysSince: number;
  totalDone: number;
  perWeek: number;
  bestStreak: number;
  streakUnit: "day" | "week";
  lastDone: string | null;
  /** "4× a week for 9 weeks" — the frozen record, in words. */
  summary: string;
  /**
   * Was this a habit that was WORKING when it stopped? A habit abandoned mid-
   * streak is a different conversation from one that never took, and only the
   * first one is worth asking about.
   */
  wasConsistent: boolean;
}

export interface HabitTrackerBrief {
  tracked: TrackedHabitFact[];
  retired: RetiredHabitFact[];
}

/**
 * The shape a live habit arrives in. Structurally the tracker's `HabitView`,
 * restated here so this module never imports HabitsContext (React) or
 * HabitService (expo-notifications) — it stays a pure, testable engine.
 */
export interface HabitViewLike {
  habit: Habit;
  stats: HabitStats;
  done: Set<string>;
}

export interface TrackerBriefInput {
  views: readonly HabitViewLike[];
  retired: readonly RetiredHabit[];
  /** YYYY-MM-DD, local. */
  today: string;
}

// ── Date helpers (local, no service imports) ────────────────────────

function shift(date: string, days: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000,
  );
}

/** Welliva weekday index for a date, 0=Mon…6=Sun. */
function weekdayIndex(date: string): number {
  return (parseLocalDate(date).getDay() + 6) % 7;
}

/**
 * How a date should be SAID, relative to today.
 *
 * Recent days get their name ("last Thursday") because that is how people hold
 * the last week in their heads; anything older gets a real date, because "27
 * days ago" is a number nobody can place. Exported — the same date has to read
 * the same way on a card as it does in a sentence.
 */
export function sayDate(date: string, today: string): string {
  const delta = daysBetween(date, today);
  if (delta === 0) return "today";
  if (delta === 1) return "yesterday";
  if (delta < 7) return `on ${DAY_NAME[parseLocalDate(date).getDay()]}`;
  if (delta < 14) return `last ${DAY_NAME[parseLocalDate(date).getDay()]}`;
  const d = parseLocalDate(date);
  return `on ${d.getDate()} ${MONTH_NAME[d.getMonth()]}`;
}

/**
 * "three weeks ago" / "about a month ago" — a duration, said the way people say
 * it.
 *
 * Weeks stop at four. "Six weeks ago" is a unit nobody converts in their head,
 * and this figure exists to let someone place a memory, not to be precise about
 * it — past a month, months are the unit people actually think in.
 */
export function sayAgo(days: number): string {
  if (days <= 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 28) {
    const weeks = Math.round(days / 7);
    return weeks === 1 ? "a week ago" : `${weeks} weeks ago`;
  }
  const months = Math.max(1, Math.round(days / 30));
  return months === 1 ? "about a month ago" : `about ${months} months ago`;
}

/**
 * Stable 32-bit hash — the sampler behind every "occasionally".
 *
 * Deterministic on purpose. A random draw would re-roll on every render, so the
 * same screen would offer a beat, hide it, and offer it again as the user
 * scrolled; a counter in storage would need a write on every render to be
 * correct. Hashing the day plus the subject gives a stable answer per day, per
 * habit, for free.
 */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const sampled = (seed: string, oneIn: number): boolean => hash(seed) % oneIn === 0;

// ── Building the brief ──────────────────────────────────────────────

/** Days in the recent window where the habit was due and wasn't done. */
function recentMisses(view: HabitViewLike, today: string): string[] {
  const { habit, done } = view;
  // A quota habit has no missed DAYS — it has a week that landed or didn't, and
  // which days you used is your own business. Naming a Tuesday it "missed"
  // would be inventing an obligation the user never set.
  if (habit.weeklyGoal != null) return [];

  const out: string[] = [];
  for (let i = 1; i <= MISS_LOOKBACK_DAYS && out.length < 3; i++) {
    const date = shift(today, -i);
    if (date < habit.createdAt) break;
    if (!habit.days.includes(weekdayIndex(date))) continue;
    if (!done.has(date)) out.push(date);
  }
  return out;
}

function trackedFact(view: HabitViewLike, today: string): TrackedHabitFact {
  const { habit, stats, done } = view;
  const dates = [...done].sort();
  return {
    id: habit.id,
    name: habit.name,
    frequency:
      habit.weeklyGoal != null
        ? habit.weeklyGoal >= 7
          ? "every day"
          : `${habit.weeklyGoal}× a week`
        : habit.days.length >= 7
          ? "every day"
          : `${habit.days.length} set days a week`,
    streak: stats.currentStreak,
    streakUnit: stats.streakUnit,
    last30Pct: stats.last30Pct,
    weekDone: stats.weekDone,
    weekTarget: stats.weekTarget,
    doneToday: stats.doneToday,
    recentMisses: recentMisses(view, today),
    lastDone: dates[dates.length - 1] ?? null,
  };
}

function retiredFact(entry: RetiredHabit, today: string): RetiredHabitFact {
  const { habit, record, retiredAt } = entry;
  const weeks = Math.max(1, Math.round(record.spanDays / 7));
  const rate =
    record.perWeek >= 6.5
      ? "almost every day"
      : `${record.perWeek % 1 === 0 ? record.perWeek : record.perWeek.toFixed(1)}× a week`;

  return {
    id: habit.id,
    name: habit.name,
    retiredOn: retiredAt,
    daysSince: Math.max(0, daysBetween(retiredAt, today)),
    totalDone: record.totalDone,
    perWeek: record.perWeek,
    bestStreak: record.bestStreak,
    streakUnit: record.streakUnit,
    lastDone: record.lastDone,
    summary:
      record.totalDone === 0
        ? "never got going"
        : `${rate} for ${weeks} week${weeks === 1 ? "" : "s"}`,
    // "Consistent" means it had a real run behind it — enough completions to be
    // a habit, and a rate that says it was happening rather than limping.
    wasConsistent: record.totalDone >= MIN_RECORD_DONE && record.perWeek >= 1.5,
  };
}

/** The tracker, as facts. Pure; safe to call on every render. */
export function buildHabitTrackerBrief(
  input: TrackerBriefInput,
): HabitTrackerBrief {
  const { views, retired, today } = input;
  return {
    tracked: views.map((v) => trackedFact(v, today)),
    retired: retired
      .map((r) => retiredFact(r, today))
      .sort((a, b) => a.daysSince - b.daysSince),
  };
}

// ── The unprompted beat ─────────────────────────────────────────────

export interface RetiredBeat {
  fact: RetiredHabitFact;
  /** Card title. */
  title: string;
  /** The observation + the question, in Gozlin's voice. */
  message: string;
  /** What to open the chat on if the user taps through. */
  prompt: string;
}

/**
 * The one retired habit — if any — worth raising today, unprompted.
 *
 * Everything about this function is a brake:
 *
 *   · nothing inside {@link QUIET_DAYS} of the deletion
 *   · nothing after {@link RETIRED_WINDOW_DAYS} — past that it is just the past
 *   · nothing that was never really a habit (`wasConsistent`)
 *   · and then only on ~1 day in {@link BEAT_SAMPLE}, chosen by hash
 *
 * The four together are what turn "the app noticed you quit" into "your coach
 * mentioned it once, weeks later, like a person would".
 *
 * The copy is a deliberate shape: state the record, name the date, and ask a
 * question that offers an EXPLANATION rather than demanding one. "Why did you
 * stop?" puts the user on trial. "You were at four a week — was it not moving
 * the needle?" hands them a reason they are free to take or correct.
 */
export function pickRetiredBeat(
  brief: HabitTrackerBrief,
  today: string,
): RetiredBeat | null {
  const eligible = brief.retired.filter(
    (r) =>
      r.wasConsistent &&
      r.daysSince >= QUIET_DAYS &&
      r.daysSince <= RETIRED_WINDOW_DAYS,
  );
  if (eligible.length === 0) return null;

  // Oldest-but-still-in-window first, so a habit doesn't get skipped forever by
  // a newer one that keeps winning the draw.
  const fact = [...eligible].sort((a, b) => b.daysSince - a.daysSince)[0];
  if (!sampled(`${today}|retired|${fact.id}`, BEAT_SAMPLE)) return null;

  const when = sayAgo(fact.daysSince);
  const streakLine =
    fact.bestStreak >= 3
      ? ` Your best run was ${fact.bestStreak} ${fact.streakUnit}${fact.bestStreak === 1 ? "" : "s"} straight.`
      : "";

  return {
    fact,
    title: "Something you used to do",
    message:
      `My records have you doing ${fact.name.toLowerCase()} ${fact.summary}, ` +
      `right up until you dropped it ${when}.${streakLine} ` +
      `That was a real habit — was it not paying off, or did the time for it just go?`,
    prompt: `I stopped ${fact.name.toLowerCase()} a while back. Help me work out whether it's worth restarting.`,
  };
}

// ── Cross-reference: connecting a conversation to real activity ──────

/**
 * Words that mean the same thing to a habit tracker.
 *
 * The point is to match a habit called "Take vitamins" when the user types
 * "should I be taking a multivitamin?" — the habit's own words are rarely the
 * ones people say out loud. Each row is a set of interchangeable terms; a habit
 * and a message are about the same thing if they land in the same row.
 *
 * Kept deliberately narrow. A loose synonym list produces confident,
 * off-target observations, and a coach who "notices" the wrong thing is worse
 * than one who notices nothing.
 */
const CONCEPTS: readonly (readonly string[])[] = [
  ["vitamin", "vitamins", "supplement", "supplements", "multivitamin", "pill", "pills"],
  ["water", "hydrate", "hydration", "hydrated", "thirsty", "drink", "drinking"],
  ["sleep", "sleeping", "asleep", "bed", "bedtime", "insomnia", "tired", "nap", "rested"],
  ["step", "steps", "walk", "walking", "walked", "10k"],
  ["read", "reading", "book", "books"],
  ["meditate", "meditation", "meditating", "mindful", "mindfulness", "breathwork"],
  ["stretch", "stretching", "mobility", "flexibility", "yoga", "tight", "stiff"],
  ["run", "running", "ran", "jog", "jogging", "cardio", "5k"],
  ["gym", "lift", "lifting", "weights", "strength", "workout", "training", "train"],
  ["protein", "macros"],
  ["snack", "snacks", "snacking", "craving", "cravings", "junk", "sugar"],
  ["journal", "journaling", "journalling", "writing", "diary"],
  ["sunlight", "sun", "daylight", "outside", "outdoors"],
  ["code", "coding", "program", "programming", "study", "studying", "practice"],
  ["skincare", "skin", "moisturise", "moisturize"],
  ["floss", "flossing", "teeth", "dental"],
  ["alcohol", "drinking", "beer", "wine", "sober"],
  ["smoke", "smoking", "vape", "vaping", "cigarette", "nicotine"],
  ["phone", "screen", "scroll", "scrolling", "doomscroll", "social"],
];

const STOPWORDS = new Set([
  "the", "and", "for", "with", "your", "you", "day", "daily", "min", "mins",
  "minutes", "hour", "hours", "every", "some", "more", "less", "take", "get",
  "have", "make", "this", "that", "into", "week", "weekly", "one", "two",
]);

/** Lowercase word tokens, 3+ characters, stopwords dropped. */
function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length >= 3 && !STOPWORDS.has(raw)) out.add(raw);
  }
  return out;
}

/** Does this habit name and this message talk about the same thing? */
function sameSubject(habitName: string, messageTokens: Set<string>): boolean {
  const nameTokens = tokens(habitName);
  for (const t of nameTokens) if (messageTokens.has(t)) return true;
  for (const concept of CONCEPTS) {
    const inName = concept.some((w) => nameTokens.has(w));
    if (!inName) continue;
    if (concept.some((w) => messageTokens.has(w))) return true;
  }
  return false;
}

/**
 * One thing the user's own history says about what they just brought up.
 *
 * `evidence` is a fact and nothing else — the phrasing, the tact and the
 * suggestion are the model's job, and the system block tells it exactly what
 * shape the reply has to take (see agent/context.ts). Splitting it that way is
 * what keeps the numbers real and the sentence human: the engine cannot
 * fabricate a figure, and the model never has to invent one.
 */
export interface CrossReference {
  /** Which habit it is about — so a caller can dedupe or attribute. */
  habitId: string;
  subject: string;
  /** A single sentence of fact, safe to cite verbatim. */
  evidence: string;
  /** "miss" wants a fix offered; "streak" wants it acknowledged, not lectured. */
  kind: "miss" | "streak" | "retired";
}

/**
 * Find the ONE thing in this person's tracker that connects to what they just
 * said — or nothing at all, which is the usual and correct answer.
 *
 * Three gates, in order of how much each one matters:
 *
 *   1. SUBJECT. The message and the habit have to be about the same thing.
 *      Without this it is a non-sequitur wearing a fact.
 *   2. SUBSTANCE. There has to be something worth saying — a real miss, a real
 *      streak, a real abandoned habit. "You did your vitamins as usual" is not
 *      an observation, it is noise with a number in it.
 *   3. RESTRAINT. Even then, only on a sampled day. The user asked for this to
 *      happen occasionally; every time they mention water would be creepy, and
 *      being creepy is a product decision, not a rounding error.
 *
 * A miss beats a streak beats a retired habit: the most useful thing a coach
 * can do with "should I take vitamins?" is point at the two Thursdays you
 * didn't, and offer a way to fix them.
 */
export function crossReference(
  text: string,
  brief: HabitTrackerBrief,
  today: string,
): CrossReference | null {
  const said = tokens(text);
  if (said.size === 0) return null;

  const seed = (id: string) => `${today}|cross|${id}`;

  // 1. A live habit they're missing, on the subject they raised.
  for (const t of brief.tracked) {
    if (!sameSubject(t.name, said)) continue;
    if (t.recentMisses.length === 0) continue;
    if (!sampled(seed(t.id), CROSS_SAMPLE)) continue;
    const days = t.recentMisses.map((d) => sayDate(d, today));
    const list =
      days.length === 1
        ? days[0]
        : `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}`;
    return {
      habitId: t.id,
      subject: t.name,
      kind: "miss",
      evidence: `They track "${t.name}" (${t.frequency}) and did not complete it ${list}. Last 30 days: ${t.last30Pct}%.`,
    };
  }

  // 2. A live habit they're winning at. Worth naming — briefly — because the
  //    advice changes when someone is already doing the thing.
  for (const t of brief.tracked) {
    if (!sameSubject(t.name, said)) continue;
    if (t.streak < 5) continue;
    if (!sampled(seed(`${t.id}|streak`), CROSS_SAMPLE)) continue;
    return {
      habitId: t.id,
      subject: t.name,
      kind: "streak",
      evidence: `They track "${t.name}" (${t.frequency}) and are on a ${t.streak}-${t.streakUnit} streak. Last 30 days: ${t.last30Pct}%.`,
    };
  }

  // 3. A habit they used to keep, on this subject. Same quiet period as an
  //    unprompted beat — but no sampling: they raised the topic themselves, and
  //    staying silent about their own history when they ask about it is not
  //    tact, it is amnesia.
  for (const r of brief.retired) {
    if (!sameSubject(r.name, said)) continue;
    if (r.daysSince < QUIET_DAYS || !r.wasConsistent) continue;
    return {
      habitId: r.id,
      subject: r.name,
      kind: "retired",
      evidence: `They used to track "${r.name}" — ${r.summary}, ${r.totalDone} days in total — and stopped ${sayAgo(r.daysSince)} (${r.retiredOn}).`,
    };
  }

  return null;
}
