/**
 * services/smart/anchor.ts
 *
 * ATTACH A NEW HABIT TO ONE YOU ALREADY HAVE — "do it right after breakfast".
 *
 * An ANCHOR is anything the person already does at a steady time: a meal they
 * log, the first glass of water, the check-in, a workout, another habit. The
 * bar is deliberately higher than the routine clock's own: {@link ANCHOR_MIN_DAYS}
 * of the last {@link ANCHOR_WINDOW_DAYS} days, within a {@link ANCHOR_MAX_SPREAD}
 * -minute spread. A habit hung on something that only sometimes happens falls
 * off with it.
 *
 * Three moments use it:
 *   · creating a habit: the reminder step offers the steadiest anchor;
 *   · a habit that's struggling (done on under half its days) gets one offer;
 *   · the chain: when the anchor is logged in the app, a small "Next: vitamins?"
 *     chip with a Done button. No new notification, ever.
 *
 * Pure. The readings come from the routine clock, the samples from its sources.
 */
import type { Habit, HabitAnchor } from "../../models/habit";
import { shiftDay, weekdayIndex } from "../commitment";
import { clockLabel, isConsistent, readRoutine, wrapMinute, type RoutineSample } from "../routine/clock";
import {
  checkinSamples,
  firstWaterSamples,
  habitSamples,
  mealSlotSamples,
  workoutSamples,
} from "../routine/sources";
import type { RoutineSources } from "../routine/load";
import type { SmartCandidate } from "./types";

/** Two weeks: what they do now, not what they did last month. */
export const ANCHOR_WINDOW_DAYS = 14;

/** Ten of fourteen: something that really does happen most days. */
export const ANCHOR_MIN_DAYS = 10;

/** Steady enough that "right after" names a real time. */
export const ANCHOR_MAX_SPREAD = 45;

/** The reminder lands this long after the anchor's usual time. */
export const ANCHOR_AFTER_MINUTES = 10;

/** Struggling: done on under half of at least this many days it was asked for. */
export const STRUGGLING_WINDOW_DAYS = 14;
export const STRUGGLING_MIN_DUE = 6;
export const STRUGGLING_RATE = 0.5;

/** The chain chip stays this long after the anchor is logged, then goes quietly. */
export const CHAIN_WINDOW_MINUTES = 180;

export const ANCHOR_OFFER_PRIORITY = 35;
export const ANCHOR_CHAIN_PRIORITY = 55;

export interface AnchorFound extends HabitAnchor {
  /** When it usually happens, minutes after midnight. */
  minute: number;
  spread: number;
  days: number;
}

/** Everything that could be an anchor, and the samples that say when. */
function anchorSamples(
  sources: RoutineSources,
  habits: readonly Pick<Habit, "id" | "name" | "source">[],
): { anchor: HabitAnchor; samples: RoutineSample[] }[] {
  const out: { anchor: HabitAnchor; samples: RoutineSample[] }[] = [];
  for (const slot of ["breakfast", "lunch", "dinner"] as const) {
    out.push({
      anchor: { kind: slot, label: slot },
      samples: mealSlotSamples(sources.intake, sources.foodLog, slot),
    });
  }
  out.push({
    anchor: { kind: "water", label: "your first glass of water" },
    samples: firstWaterSamples(sources.waterHistory, sources.pours),
  });
  out.push({ anchor: { kind: "checkin", label: "your check-in" }, samples: checkinSamples(sources.checkins) });
  out.push({ anchor: { kind: "workout", label: "your workout" }, samples: workoutSamples(sources.workouts) });
  for (const h of habits) {
    if (h.source !== "manual") continue;
    out.push({
      anchor: { kind: "habit", label: h.name, habitId: h.id },
      // A press answering a reminder doesn't say when the habit happens, but it
      // does happen — for an anchor, every tick is a real occurrence.
      samples: habitSamples(sources.tickTimes, h.id).map((s) => ({ ...s, echo: false })),
    });
  }
  return out;
}

/** Every steady anchor, steadiest first. `excludeHabitId`: a habit can't anchor itself. */
export function findAnchors(
  sources: RoutineSources,
  habits: readonly Pick<Habit, "id" | "name" | "source">[],
  today: string,
  excludeHabitId?: string,
): AnchorFound[] {
  const found: AnchorFound[] = [];
  for (const { anchor, samples } of anchorSamples(sources, habits)) {
    if (anchor.habitId && anchor.habitId === excludeHabitId) continue;
    const reading = readRoutine(samples, today, {
      windowDays: ANCHOR_WINDOW_DAYS,
      minCount: ANCHOR_MIN_DAYS,
    });
    if (!isConsistent(reading, ANCHOR_MAX_SPREAD)) continue;
    found.push({
      ...anchor,
      minute: reading.medianMinute,
      spread: reading.spreadMinutes,
      days: reading.count,
    });
  }
  return found.sort((a, b) => a.spread - b.spread || b.days - a.days);
}

/** Where the reminder goes: just after the anchor's usual time. */
export function anchorReminder(anchor: Pick<AnchorFound, "minute">): { hour: number; minute: number } {
  const m = wrapMinute(anchor.minute + ANCHOR_AFTER_MINUTES);
  return { hour: Math.floor(m / 60), minute: m % 60 };
}

/** "You log breakfast around 8:10 AM" — what the claim rests on, by kind. */
function usually(anchor: AnchorFound): string {
  const at = clockLabel(anchor.minute);
  switch (anchor.kind) {
    case "breakfast":
    case "lunch":
    case "dinner":
      return `You log ${anchor.kind} around ${at}`;
    case "water":
      return `Your first glass is around ${at}`;
    case "checkin":
      return `You check in around ${at}`;
    case "workout":
      return `You finish your workout around ${at}`;
    case "habit":
      return `You tick ${anchor.label} around ${at}`;
  }
}

const articleless = (label: string) => label.replace(/^your /, "");

export function anchorCopy(anchor: AnchorFound) {
  return {
    /** The reminder step of the new-habit form. */
    formOffer: `Do it right after ${anchor.label}? ${usually(anchor)} most days.`,
    /** A struggling habit's one offer, on its own page ("this one": any name fits). */
    strugglingOffer: `This one's been tricky. Want to tie it to ${anchor.label}? ${usually(anchor)} on most days.`,
    source: `From ${anchor.days} of your last ${ANCHOR_WINDOW_DAYS} days.`,
    accept: `After ${articleless(anchor.label)}`,
    decline: "Not now",
  };
}

/**
 * Has this habit been hard to keep? Done on under half of the days it was asked
 * for in the last two weeks — scheduled days, or its quota's share of them.
 * Today isn't counted (it isn't over), nor a rough day.
 */
export function isStruggling(
  habit: Pick<Habit, "days" | "weeklyGoal" | "createdAt" | "source" | "anchor">,
  done: ReadonlySet<string>,
  paused: ReadonlySet<string>,
  today: string,
): boolean {
  if (habit.source !== "manual" || habit.anchor) return false;
  let due = 0;
  let kept = 0;
  let open = 0;
  for (let i = 1; i <= STRUGGLING_WINDOW_DAYS; i++) {
    const d = shiftDay(today, -i);
    if (d < habit.createdAt) break;
    open++;
    if (done.has(d)) kept++;
    if (habit.weeklyGoal == null && habit.days.includes(weekdayIndex(d)) && !(paused.has(d) && !done.has(d))) {
      due++;
    }
  }
  // A quota asks for a share of whichever days have passed.
  if (habit.weeklyGoal != null) due = Math.floor((habit.weeklyGoal * open) / 7);
  return due >= STRUGGLING_MIN_DUE && kept / due < STRUGGLING_RATE;
}

export interface AnchorOffer extends SmartCandidate {
  feature: "anchor";
  kind: "offer";
  habitId: string;
  habitName: string;
  anchor: AnchorFound;
}

/** Is `anchor` logged yet today, and when? Minutes after midnight, or null. */
export function anchorLoggedAt(
  anchor: HabitAnchor,
  sources: RoutineSources,
  today: string,
): number | null {
  const samples: RoutineSample[] =
    anchor.kind === "breakfast" || anchor.kind === "lunch" || anchor.kind === "dinner"
      ? mealSlotSamples(sources.intake, sources.foodLog, anchor.kind)
      : anchor.kind === "water"
        ? firstWaterSamples(sources.waterHistory, sources.pours)
        : anchor.kind === "checkin"
          ? checkinSamples(sources.checkins)
          : anchor.kind === "workout"
            ? workoutSamples(sources.workouts)
            : anchor.habitId
              ? habitSamples(sources.tickTimes, anchor.habitId)
              : [];
  let earliest: number | null = null;
  for (const s of samples) {
    if (s.date !== today) continue;
    const t = new Date(s.at);
    if (Number.isNaN(t.getTime())) continue;
    const minute = t.getHours() * 60 + t.getMinutes();
    if (earliest == null || minute < earliest) earliest = minute;
  }
  return earliest;
}

/** The chain chip's habit: anchored, due, not done, anchor logged a little while ago. */
export function chainDue(input: {
  habit: Pick<Habit, "anchor">;
  done: ReadonlySet<string>;
  due: boolean;
  loggedAtMinute: number | null;
  nowMinute: number;
  today: string;
}): boolean {
  const { habit, done, due, loggedAtMinute, nowMinute, today } = input;
  if (!habit.anchor || !due || done.has(today) || loggedAtMinute == null) return false;
  const since = nowMinute - loggedAtMinute;
  return since >= 0 && since <= CHAIN_WINDOW_MINUTES;
}
