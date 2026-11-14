/**
 * services/checks/doctorNotes.ts — "worth mentioning to a doctor", for everyone.
 *
 * The cycle tracker has had these since 2026-10-15 (services/cycle/flags). These
 * are the same idea for the rest of the app, read from what people already log:
 *
 *   weight-unplanned  down 5% or more over up to six months, while losing
 *                     weight isn't one of their goals
 *   weight-fast       losing faster than about 1 kg (or 1% of their weight) a
 *                     week, across the last three weeks
 *   eating-low        under the app's own calorie floor on most fully logged
 *                     days of the last two weeks
 *   mood-low          check-ins on the low side on most of the last 14 days
 *   pain-recurring    the same spot hurting after 3 sessions inside 2 weeks
 *
 * THE RULES ARE THE CYCLE NOTES' RULES:
 *   · Every note says what was seen, in their numbers, and that it is worth
 *     raising. It never names a condition and never says what to do instead.
 *   · Gates before claims. Below a gate, nothing is said.
 *   · A missing value is not zero. A day with nothing recorded is unknown; a
 *     day missing a main meal can't show what someone ate, so the eating check
 *     only counts days with breakfast, lunch AND dinner logged.
 *   · A dismissed note stays away while its evidence is the same, and for at
 *     least QUIET_DAYS whatever happens; after that it may come back if it is
 *     still true. The signature is built from the evidence.
 *
 * Postpartum, weight falling is expected, so neither weight note applies.
 * In pregnancy both still apply: losing weight then is worth raising too.
 *
 * Nothing here is counted by analytics: a note's timestamp says something
 * about someone's health.
 *
 * Pure. components/checks/HealthNotes gathers the inputs and shows the notes.
 */

import type { PainMemory } from "../../fitness/types";
import type { MedicalCondition, PrimaryGoal, Sex } from "../../models/user";
import { addDays, daysBetween, formatDay } from "../cycle/dates";
import { painAreaLabel, recurringPain } from "../training/pain";

export type HealthNoteId = "weight-unplanned" | "weight-fast" | "eating-low" | "mood-low" | "pain-recurring";

export interface HealthNote {
  id: HealthNoteId;
  title: string;
  body: string;
  /** Changes only when the evidence does. */
  signature: string;
}

/** Losing this share of body weight without trying is the usual line for "get it checked". */
export const UNPLANNED_LOSS_SHARE = 0.05;
/** …over at most this long (the usual guidance says 6–12 months; six keeps it recent). */
export const UNPLANNED_WINDOW_DAYS = 182;
/** The first reading must be at least this far before the latest, so a fortnight's wobble isn't a trend. */
export const UNPLANNED_MIN_SPAN_DAYS = 56;
/** "Now" is the average of the readings in this many days, so one low reading can't raise it. */
export const NOW_DAYS = 14;

/** Faster than this many kg a week… */
export const FAST_LOSS_KG = 1;
/** …or this share of body weight a week, whichever is larger, for weeks on end, is worth raising. */
export const FAST_LOSS_SHARE = 0.01;
/** The stretch the rate is read over: three weeks. */
export const FAST_WINDOW_DAYS = 21;
/** Readings needed inside it, spread across at least FAST_MIN_SPAN_DAYS. */
export const FAST_MIN_READINGS = 4;
export const FAST_MIN_SPAN_DAYS = 14;
/** The first weeks of a new plan shed water fast, so the check waits until someone has weighed in for this long. */
export const FAST_SETTLE_DAYS = 28;

/** The fortnight the eating check reads: the 14 closed days before today. */
export const EATING_WINDOW_DAYS = 14;
/** Fully logged days needed in it before anything is said: half the fortnight. */
export const EATING_MIN_FULL_DAYS = 7;
/** Under the floor on at least three in four of them. */
export const EATING_UNDER_SHARE = 0.75;

/** The window the mood check reads, ending today (the screening questions ask about "the last two weeks"). */
export const MOOD_WINDOW_DAYS = 14;
/** A day averaging "Slightly Unpleasant" (−⅓) or lower is a low day; −0.3 absorbs float error. */
export const MOOD_LOW_VALENCE = -0.3;
/** Low on more than half the days. */
export const MOOD_LOW_DAYS = 8;

/** How long a dismissed note stays away at the least, by note. */
export const QUIET_DAYS: Record<HealthNoteId, number> = {
  "weight-unplanned": 60,
  "weight-fast": 30,
  "eating-low": 30,
  "mood-low": 14,
  "pain-recurring": 14,
};

/** The main meals a full day has: everyone's plan has these three (meals per day is 3 or 4). */
export const MAIN_SLOTS = ["breakfast", "lunch", "dinner"] as const;

export interface HealthNotesInput {
  today: string;
  bio: {
    sex: Sex;
    medicalConditions?: readonly MedicalCondition[];
    primaryGoal?: PrimaryGoal;
    goals?: readonly PrimaryGoal[];
  };
  targetWeightKg: number | null;
  weighIns: readonly { date: string; kg: number }[];
  /** Closed days with recorded intake, date → kcal. A missing date is unknown. */
  intake: Readonly<Record<string, number>>;
  /** Which meal slots had something recorded on each day (plan ticks and food logs). */
  slotsByDate: Readonly<Record<string, readonly (string | null)[]>>;
  /** The app's calorie floor for this person (services/NutritionService.calorieFloor). */
  calorieFloor: number;
  /** Every mood entry: its day and its feeling (null for a sleep-only entry). */
  moods: readonly { date: string; valence: number | null }[];
  pain?: readonly PainMemory[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** "1,200": by hand, as elsewhere, because Hermes' Intl depends on the build. */
function thousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** One reading a day (the last given wins), oldest first. */
function readings(weighIns: HealthNotesInput["weighIns"], today: string) {
  const days = new Map<string, number>();
  for (const w of weighIns) {
    if (Number.isFinite(w.kg) && w.kg > 0 && w.date <= today) days.set(w.date, w.kg);
  }
  return [...days.entries()].map(([date, kg]) => ({ date, kg })).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function isFullDay(slots: readonly (string | null)[] | undefined): boolean {
  if (!slots) return false;
  return MAIN_SLOTS.every((s) => slots.includes(s));
}

function tryingToLose(input: HealthNotesInput, startKg: number): boolean {
  const { bio, targetWeightKg } = input;
  if (bio.primaryGoal === "lose_weight") return true;
  if (bio.goals?.includes("lose_weight")) return true;
  return targetWeightKg != null && targetWeightKg < startKg;
}

function unplannedLoss(input: HealthNotesInput): HealthNote | null {
  const { today } = input;
  if (input.bio.medicalConditions?.includes("postpartum")) return null;
  const all = readings(input.weighIns, today);
  const inWindow = all.filter((r) => r.date >= addDays(today, -UNPLANNED_WINDOW_DAYS));
  const recent = inWindow.filter((r) => r.date >= addDays(today, -(NOW_DAYS - 1)));
  if (!recent.length) return null;
  const start = inWindow[0];
  const latest = inWindow[inWindow.length - 1];
  if (daysBetween(start.date, latest.date) < UNPLANNED_MIN_SPAN_DAYS) return null;
  if (tryingToLose(input, start.kg)) return null;
  const now = recent.reduce((s, r) => s + r.kg, 0) / recent.length;
  const share = (start.kg - now) / start.kg;
  if (share < UNPLANNED_LOSS_SHARE) return null;
  const pct = Math.floor(share * 100);
  return {
    id: "weight-unplanned",
    title: "Weight down without trying",
    body:
      `Your weight has gone from ${round1(start.kg)} kg on ${formatDay(start.date, { year: true })} to about ${round1(now)} kg now, ` +
      `${pct}% lower, and losing weight isn't one of your goals in welliva. ` +
      "If you didn't set out to lose it, losing 5% or more of your weight is worth mentioning to a doctor.",
    signature: `${start.date}|${pct}`,
  };
}

/** Least-squares slope in kg a day. */
function slopePerDay(points: { date: string; kg: number }[]): number {
  const t0 = points[0].date;
  const xs = points.map((p) => daysBetween(t0, p.date));
  const ys = points.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
  }
  return sxx > 0 ? sxy / sxx : 0;
}

function fastLoss(input: HealthNotesInput): HealthNote | null {
  const { today } = input;
  if (input.bio.medicalConditions?.includes("postpartum")) return null;
  const all = readings(input.weighIns, today);
  if (!all.length || daysBetween(all[0].date, today) < FAST_SETTLE_DAYS) return null;
  const pts = all.filter((r) => r.date >= addDays(today, -(FAST_WINDOW_DAYS - 1)));
  if (pts.length < FAST_MIN_READINGS) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (daysBetween(first.date, last.date) < FAST_MIN_SPAN_DAYS) return null;
  if (daysBetween(last.date, today) > 7) return null;
  const perWeek = slopePerDay(pts) * 7;
  const limit = Math.max(FAST_LOSS_KG, FAST_LOSS_SHARE * last.kg);
  if (perWeek > -limit) return null;
  const limitWords =
    limit > FAST_LOSS_KG ? `about ${round1(limit)} kg (1% of your weight) a week` : "about 1 kg a week";
  const weeks = Math.round(daysBetween(first.date, last.date) / 7);
  return {
    id: "weight-fast",
    title: "Losing weight fast",
    body:
      `Over the last ${weeks} weeks you've been losing about ${round1(-perWeek)} kg a week, from ${round1(first.kg)} kg on ` +
      `${formatDay(first.date)} to ${round1(last.kg)} kg on ${formatDay(last.date)}. ` +
      `Losing more than ${limitWords} for weeks at a time is worth mentioning to a doctor, who can check it's safe for you.`,
    signature: `${first.date}|${last.date}`,
  };
}

function eatingLow(input: HealthNotesInput): HealthNote | null {
  const { today, calorieFloor } = input;
  if (!(calorieFloor > 0)) return null;
  const full: { date: string; kcal: number }[] = [];
  for (let i = EATING_WINDOW_DAYS; i >= 1; i--) {
    const d = addDays(today, -i);
    const kcal = input.intake[d];
    if (typeof kcal === "number" && kcal > 0 && isFullDay(input.slotsByDate[d])) full.push({ date: d, kcal });
  }
  if (full.length < EATING_MIN_FULL_DAYS) return null;
  const under = full.filter((d) => d.kcal < calorieFloor);
  if (under.length / full.length < EATING_UNDER_SHARE) return null;
  return {
    id: "eating-low",
    title: "Eating less than you need",
    body:
      `On ${under.length} of the ${full.length} days in the last two weeks when you logged breakfast, lunch and dinner, ` +
      `it came to less than ${thousands(calorieFloor)} calories. That's less than welliva would ever plan for you, ` +
      "because staying under it for long can leave your body short of what it needs. " +
      "If that's everything you ate, it's worth talking to a doctor or a dietitian about getting enough.",
    signature: `${full[0].date}|${under.length}`,
  };
}

function moodLow(input: HealthNotesInput): HealthNote | null {
  const { today } = input;
  const from = addDays(today, -(MOOD_WINDOW_DAYS - 1));
  const byDay = new Map<string, number[]>();
  for (const m of input.moods) {
    if (m.valence === null || !Number.isFinite(m.valence) || m.date < from || m.date > today) continue;
    if (!byDay.has(m.date)) byDay.set(m.date, []);
    byDay.get(m.date)!.push(m.valence);
  }
  const low = [...byDay.entries()]
    .filter(([, vs]) => vs.reduce((a, b) => a + b, 0) / vs.length <= MOOD_LOW_VALENCE)
    .map(([d]) => d)
    .sort();
  if (low.length < MOOD_LOW_DAYS) return null;
  return {
    id: "mood-low",
    title: "Low on most days",
    body:
      `Your check-ins were on the low side on ${low.length} of the last ${MOOD_WINDOW_DAYS} days. ` +
      "When low feelings stay most days for two weeks or more, it's worth talking to a doctor, and you don't need any other reason to go. " +
      "If you ever feel you might harm yourself, contact emergency services or a crisis line straight away.",
    signature: low[0],
  };
}

function painRecurring(input: HealthNotesInput): HealthNote | null {
  const spots = recurringPain(input.pain, input.today);
  if (!spots.length) return null;
  const lines = spots.map((s) => {
    const label = painAreaLabel(s.id);
    return `Your ${label.toLowerCase()} hurt after ${s.dates.length} workouts since ${formatDay(s.dates[0])}.`;
  });
  return {
    id: "pain-recurring",
    title: "Pain that keeps coming back",
    body:
      `${lines.join(" ")} Pain that comes back in the same spot is worth getting checked by a doctor or a physiotherapist, ` +
      "sooner if it's swollen or hurts when you're resting. Until then, your plan keeps going easy on it.",
    signature: spots.map((s) => `${s.id}:${s.dates.join(",")}`).join("|"),
  };
}

/** Every note the logs support today, most pressing first. */
export function healthNotes(input: HealthNotesInput): HealthNote[] {
  return [moodLow(input), eatingLow(input), unplannedLoss(input), fastLoss(input), painRecurring(input)].filter(
    (n): n is HealthNote => n !== null,
  );
}

export type DismissedNotes = Readonly<Partial<Record<HealthNoteId, { signature: string; on: string }>>>;

/** The notes still to show, after "Got it". */
export function visibleNotes(notes: readonly HealthNote[], dismissed: DismissedNotes, today: string): HealthNote[] {
  return notes.filter((n) => {
    const d = dismissed[n.id];
    if (!d) return true;
    if (d.signature === n.signature) return false;
    return daysBetween(d.on, today) >= QUIET_DAYS[n.id];
  });
}
