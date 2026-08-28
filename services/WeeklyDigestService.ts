/**
 * WEEKLY DIGEST — "your week, read by Gozlin".
 *
 * WHY A SUBSCRIPTION NEEDS SOMETHING TO ARRIVE
 *
 * A subscription that only ever removes limits is invisible between the day it
 * is bought and the day it is cancelled. Nothing marks the money leaving, so the
 * renewal is the first time in a month the user thinks about the price — and
 * they think about it while looking at a bank statement rather than at anything
 * the app did for them. A short weekly read is the cheapest possible fix: it is
 * derived entirely from logs we already hold, costs no inference, and means the
 * answer to "what am I paying for?" arrives on its own four times a month.
 *
 * WEEKLY, NOT MONTHLY, AND SEPARATE FROM THE RECAP
 *
 * MonthlyRecapService is a narrative event — a "Welliva Wrapped" the user opens
 * and reads through once. This is the opposite shape on purpose: three lines,
 * pushed, no ceremony, gone in ten seconds. Making the recap weekly would wear
 * out its one good trick, and making this monthly would leave three weeks of
 * silence in a subscription billed monthly.
 *
 * IT IS DETERMINISTIC AND IT NEVER FLATTERS
 *
 * Every line is a comparison between two arithmetic facts about weeks the user
 * logged. No model writes it and nothing is invented. That matters more here
 * than anywhere else in the app: a digest that says "great week!" after a bad
 * one is worse than no digest, because it proves nothing is actually being read.
 * So a flat week says it was flat, and a bad week says what slipped — which is
 * also the only version anybody keeps opening.
 *
 * WHO GETS IT
 *
 * Paid tiers. It is not gated by a `FeatureId` because it is not a lock the user
 * can bump into — there is no locked surface to show them, only something they
 * do or do not receive. The caller checks `hasPaidAccess()` before building one.
 */
import { weekKeyOf } from "@/health-os/platform/clock";

/** One week's worth of the numbers this digest reads. */
export interface DigestWeek {
  /** Monday of the week, `YYYY-MM-DD`. */
  weekStart: string;
  /** Days in the week with any food logged. */
  daysLogged: number;
  /** Completed training sessions. */
  workouts: number;
  /** Mean daily calories across the days that recorded them; null when none did. */
  avgCalories: number | null;
  /** Mean daily protein (g) across days that recorded it; null when none did. */
  avgProteinG: number | null;
  /** Latest weight recorded in the week, kg; null when none was. */
  weightKg: number | null;
}

export interface WeeklyDigest {
  /** The Monday this digest covers — the cadence + de-dupe key. */
  weekStart: string;
  title: string;
  /** Two or three short lines. The first is the headline finding. */
  lines: string[];
  /** The lines joined for a notification body. */
  body: string;
}

/** Sources the digest is assembled from. All are date-stamped app records. */
export interface WeeklyDigestInput {
  /** Any local date inside the week to summarise. */
  forDate: string;
  /** Per-day food records — `date` plus whatever totals were captured. */
  dietHistory: readonly {
    date: string;
    consumedCalories?: number;
    consumedProteinG?: number;
  }[];
  /** Completed sessions, one row per workout. */
  workoutLog: readonly { date: string }[];
  /** Weigh-ins. */
  bodyLogs: readonly { date: string; weightKg: number }[];
}

/** Shift a `YYYY-MM-DD` by whole days without touching the local clock. */
function shiftDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate(),
  ).padStart(2, "0")}`;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Summarise the Mon–Sun week containing `weekStart`. */
export function summariseWeek(
  weekStart: string,
  input: Omit<WeeklyDigestInput, "forDate">,
): DigestWeek {
  const days = new Set(Array.from({ length: 7 }, (_, i) => shiftDays(weekStart, i)));
  const diet = input.dietHistory.filter((d) => days.has(d.date));
  const weighIns = input.bodyLogs.filter((b) => days.has(b.date)).sort((a, b) => a.date.localeCompare(b.date));

  return {
    weekStart,
    daysLogged: new Set(diet.map((d) => d.date)).size,
    workouts: input.workoutLog.filter((w) => days.has(w.date)).length,
    avgCalories: mean(
      diet.map((d) => d.consumedCalories).filter((n): n is number => typeof n === "number" && n > 0),
    ),
    avgProteinG: mean(
      diet.map((d) => d.consumedProteinG).filter((n): n is number => typeof n === "number" && n > 0),
    ),
    weightKg: weighIns.length > 0 ? weighIns[weighIns.length - 1].weightKg : null,
  };
}

/** A signed percentage change, or null when the base is missing or zero. */
function pctChange(now: number | null, before: number | null): number | null {
  if (now === null || before === null || before === 0) return null;
  return Math.round(((now - before) / before) * 100);
}

/**
 * Build the digest for the week that has just ENDED as of `forDate`.
 *
 * Returns null when the week holds too little to say anything true. Two logged
 * days is not a week, and a digest built from it would either be padded with
 * generic encouragement or state a trend from noise — both of which teach the
 * subscriber that the thing arriving in their notifications is not really about
 * them. Silence is a better product than filler.
 */
export function buildWeeklyDigest(input: WeeklyDigestInput): WeeklyDigest | null {
  // The week just gone: step back into the previous week, then take its Monday.
  const thisWeekStart = weekKeyOf(input.forDate);
  const weekStart = shiftDays(thisWeekStart, -7);
  const priorStart = shiftDays(weekStart, -7);

  const week = summariseWeek(weekStart, input);
  const prior = summariseWeek(priorStart, input);

  // Below this, there is no week to read.
  if (week.daysLogged < 3 && week.workouts < 2) return null;

  const lines: string[] = [];

  // ── Headline: consistency, the number that actually predicts outcomes ──
  if (week.daysLogged >= 6) {
    lines.push(`You logged ${week.daysLogged} of 7 days — your most complete kind of week.`);
  } else if (week.daysLogged > prior.daysLogged) {
    lines.push(
      `You logged ${week.daysLogged} days, up from ${prior.daysLogged} the week before.`,
    );
  } else if (week.daysLogged < prior.daysLogged) {
    lines.push(
      `You logged ${week.daysLogged} days, down from ${prior.daysLogged}. Worth a look at what changed.`,
    );
  } else {
    lines.push(`You logged ${week.daysLogged} days, the same as the week before.`);
  }

  // ── Training ──
  if (week.workouts > 0 || prior.workouts > 0) {
    const delta = week.workouts - prior.workouts;
    if (delta > 0) {
      lines.push(
        `${week.workouts} session${week.workouts === 1 ? "" : "s"} trained — ${delta} more than last week.`,
      );
    } else if (delta < 0) {
      lines.push(
        `${week.workouts} session${week.workouts === 1 ? "" : "s"} trained, ${Math.abs(delta)} fewer than last week.`,
      );
    } else if (week.workouts > 0) {
      lines.push(`${week.workouts} session${week.workouts === 1 ? "" : "s"} trained, holding steady.`);
    }
  }

  // ── One nutrition or body reading, whichever is real ──
  const weightDelta =
    week.weightKg !== null && prior.weightKg !== null
      ? Math.round((week.weightKg - prior.weightKg) * 10) / 10
      : null;

  if (weightDelta !== null && Math.abs(weightDelta) >= 0.2) {
    lines.push(
      `Weight ${weightDelta < 0 ? "down" : "up"} ${Math.abs(weightDelta)} kg on last week's reading.`,
    );
  } else if (weightDelta !== null) {
    lines.push("Weight held flat against last week.");
  } else {
    const calDelta = pctChange(week.avgCalories, prior.avgCalories);
    if (week.avgProteinG !== null) {
      lines.push(`Protein averaged ${Math.round(week.avgProteinG)} g a day.`);
    } else if (calDelta !== null && Math.abs(calDelta) >= 5) {
      lines.push(
        `Daily calories ran ${Math.abs(calDelta)}% ${calDelta > 0 ? "higher" : "lower"} than last week.`,
      );
    }
  }

  const trimmed = lines.slice(0, 3);
  return {
    weekStart,
    title: "Your week, read by Gozlin",
    lines: trimmed,
    body: trimmed.join(" "),
  };
}
