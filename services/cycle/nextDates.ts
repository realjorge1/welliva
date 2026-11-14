/**
 * services/cycle/nextDates.ts — three small things about the next dates
 * (owner-approved 2026-11-12/13):
 *
 *   startReceipt     — "We said the 14th. It came on the 15th." When a period
 *                      start is logged, what the prediction said the day
 *                      before. A pure recompute: nothing new is stored.
 *   shareDatesLine   — "My next period is likely 18–21 Nov." for the share sheet.
 *   testingStartLine — "Test daily from Thu 14 Nov until you get a positive."
 *                      for someone who uses ovulation tests.
 *
 * The register is ./copy's: plain, calm, never surer than the numbers, and a
 * miss is said as a miss. None of this is counted in analytics, and none of it
 * reaches a lock screen.
 */

import { confidenceWord } from "./copy";
import { addDays, daysBetween, formatDay, formatRange, maxDate } from "./dates";
import { liveEpisodes } from "./episodes";
import {
  buildCycles,
  countFrom,
  cycleModeOf,
  lastPositiveTest,
  predict,
  type CycleProfile,
  type Prediction,
} from "./predict";
import type { CycleDays, CycleSettings, PeriodEpisode } from "./types";

/* ───────────────────────────── the receipt ───────────────────────────── */

/** The receipt is about a start logged in the last few days: a late log still gets its answer. */
export const RECEIPT_WITHIN_DAYS = 3;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The local calendar day of an ISO instant (when something was saved). */
export function localDateOf(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * What the prediction said the day before her latest period started, said
 * back once — on the day she logged it (screen button, "Started on another
 * day?", the Home card or a lock-screen button: all of them stamp the period).
 *
 * Gates: the start is within the last RECEIPT_WITHIN_DAYS days and was saved
 * today; a prediction existed the day before (so never on a first log, and
 * never for the first period after a birth, whose history starts fresh); and
 * the mode predicts a cycle (normal or postpartum).
 */
export function startReceipt(input: {
  episodes: readonly PeriodEpisode[];
  days: CycleDays;
  settings: CycleSettings;
  profile: CycleProfile;
  today: string;
}): string | null {
  const { settings, today, profile } = input;
  const mode = cycleModeOf(profile.conditions, settings.contraception?.answer);
  if (mode !== "normal" && mode !== "postpartum") return null;
  const live = liveEpisodes(input.episodes);
  const latest = live[live.length - 1];
  if (!latest) return null;
  const start = latest.start;
  const ago = daysBetween(start, today);
  if (ago < 0 || ago >= RECEIPT_WITHIN_DAYS) return null;
  if (localDateOf(latest.updatedAt) !== today) return null;

  // Everything as it stood the day before the start.
  const eve = addDays(start, -1);
  const before = input.episodes.filter((e) => e.start < start);
  const days: CycleDays = {};
  for (const [d, log] of Object.entries(input.days)) if (d < start) days[d] = log;
  const said = predict({ episodes: before, days, settings, today: eve, profile });
  if (!said) return null;

  const off = daysBetween(said.likely, start);
  const range = formatRange(said.earliest, said.latest);
  let line: string;
  if (off === 0) {
    line = "Right on the day we said.";
  } else if (start >= said.earliest && start <= said.latest) {
    line = `We said around ${formatDay(said.likely, { weekday: true })} (${range}). It came on ${formatDay(start, {
      weekday: true,
    })}: inside the window, ${plural(Math.abs(off), "day")} ${off > 0 ? "after" : "before"} the likeliest day.`;
  } else if (start > said.latest) {
    line = `It came ${plural(daysBetween(said.latest, start), "day")} after the window we gave (${range}).`;
  } else {
    line = `It came ${plural(daysBetween(start, said.earliest), "day")} before the window we gave (${range}).`;
  }

  // Only when the cycle that just ended really joins the average.
  const since = countFrom(settings, mode);
  const ended = buildCycles(input.episodes, settings, today, since).find((c) => c.nextStart === start);
  if (ended?.status === "counted") line += " Your next window now includes this cycle.";
  return line;
}

/* ───────────────────────────── sharing the dates ───────────────────────────── */

/**
 * The one line the share sheet carries. "most likely" only when the cycle
 * screen itself says "Fairly sure"; a window it isn't sure of is shared as a
 * window. Null when there is no window to share.
 */
export function shareDatesLine(p: Prediction | null): string | null {
  if (!p) return null;
  const sure = confidenceWord(p) === "Fairly sure";
  return `My next period is likely ${formatRange(p.earliest, p.latest)}${
    sure ? `, most likely ${formatDay(p.likely, { weekday: true })}` : ""
  }.`;
}

/* ───────────────────────────── when to start testing ───────────────────────────── */

/**
 * Start testing this many days before the earliest likely start, on top of
 * the luteal length: the surge comes a luteal phase plus a day before the
 * period, and this leaves room for an early one.
 */
export const TESTING_LEAD_DAYS = 3;

export const PCOS_TESTING_LINE =
  "With PCOS these tests can read positive without ovulation, so treat a positive as a hint, not a date.";

/**
 * "Test daily from Thu 14 Nov until you get a positive." Shown in the fertile
 * box when: the fertile window is on, there is a prediction, she has logged an
 * ovulation test at least once, there's no positive yet this cycle, and today
 * is no later than the estimated ovulation + 1. The day is the window's
 * earliest edge less (luteal length + TESTING_LEAD_DAYS), never before the
 * current period's expected end. In the app only: the reminder budget is full.
 */
export function testingStartLine(input: {
  prediction: Prediction | null;
  days: CycleDays;
  showFertile: boolean;
  today: string;
}): string | null {
  const { prediction: p, days, showFertile, today } = input;
  if (!showFertile || !p) return null;
  if (!Object.values(days).some((log) => !!log.ovulationTest)) return null;
  if (lastPositiveTest(days, p.lastStart, today)) return null;
  if (today > addDays(p.ovulation, 1)) return null;
  const from = maxDate(
    addDays(p.earliest, -(p.lutealDays + TESTING_LEAD_DAYS)),
    addDays(p.lastStart, p.periodLength - 1),
  );
  return from > today
    ? `Test daily from ${formatDay(from, { weekday: true })} until you get a positive.`
    : "Test daily now until you get a positive.";
}
