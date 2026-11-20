/**
 * services/cycle/contraception.ts — the one question about contraception.
 *
 * WHY ASK AT ALL. On a hormonal method (the pill, patch, ring, implant,
 * injection or a hormonal coil) bleeding follows the method, not a cycle: on
 * the combined pill it is a withdrawal bleed in the break, and on the others it
 * often becomes irregular or stops altogether. A tracker that keeps predicting
 * "your next period" from those bleeds is wrong for exactly the people who most
 * need it to be quiet — so a "yes" here turns predictions off and keeps the log
 * (./predict's "hormonal" mode).
 *
 * The question is optional and carries no judgement: "prefer not to say" is a
 * full answer, and it behaves exactly like never having been asked.
 *
 * STOPPING IS A FRESH START. When she switches away from "yes", the bleeds she
 * logged on the method stop counting as cycles — the same fresh start a birth
 * gives (`postpartumSince`). Her history restarts from the bleed she is having
 * that day, if any, which is how a first cycle after stopping is counted, or
 * else from that day itself. A "yes" taken back within a couple of days
 * ({@link CORRECTION_DAYS}) was a mis-tap, or too short to change anything, so it
 * restarts nothing: nobody should lose a year of history to a slip of the thumb.
 *
 * NEVER CONTRACEPTION. Nothing in this module or anywhere it is shown suggests
 * that welliva is, or replaces, a method. It decides what NOT to predict.
 */

import { daysBetween, formatDay, minDate } from "./dates";
import { DEFAULT_PACK_DAYS, PILL_LINE } from "./pill";
import type { Contraception, ContraceptionAnswer, ContraceptionMethod } from "./types";

/** A "yes" taken back in fewer days than this restarts nothing. See the header. */
export const CORRECTION_DAYS = 3;

/** The question, in the words setup and settings both use. */
export const CONTRACEPTION_QUESTION = "Do you use hormonal contraception?";
export const CONTRACEPTION_HINT =
  "The pill, patch, ring, implant, injection or a hormonal coil. It helps me predict the right thing.";

/** Answer chips, in the order they are offered. */
export const CONTRACEPTION_OPTIONS: readonly { value: ContraceptionAnswer; label: string }[] = [
  { value: "hormonal", label: "Yes" },
  { value: "none", label: "No" },
  { value: "unsaid", label: "Prefer not to say" },
];

/**
 * The one calm line that says what a "yes" changes. Bleeding on these methods
 * is expected to change; nothing here says it is a sign of anything.
 */
export const HORMONAL_LINE =
  "On hormonal contraception, bleeding often changes, comes irregularly or stops. So I log it and don't predict it.";

/**
 * Her answer, applied on `today`. Returns `prev` unchanged when nothing changed,
 * so a repeated tap writes nothing.
 *
 * @param bleedStart  first day of a bleed still going today, if any
 */
export function answerContraception(
  prev: Contraception | null,
  answer: ContraceptionAnswer,
  today: string,
  bleedStart: string | null = null,
): Contraception {
  if (prev && prev.answer === answer) return prev;
  let restartFrom = prev?.restartFrom ?? null;
  if (prev?.answer === "hormonal" && daysBetween(prev.since, today) >= CORRECTION_DAYS) {
    restartFrom = bleedStart ? minDate(bleedStart, today) : today;
  }
  // Which method belongs to a "yes" only: changing the answer drops it.
  return { answer, since: today, restartFrom };
}

/**
 * "Which one?" — the follow-up to a "yes" (./pill). Changes nothing about where
 * her history counts from: she is on a method either way. Returns `prev` when
 * nothing changed, and nothing at all unless she said yes.
 */
export function answerMethod(
  prev: Contraception | null,
  method: ContraceptionMethod,
  packDays: number = DEFAULT_PACK_DAYS,
): Contraception | null {
  if (!prev || prev.answer !== "hormonal") return prev;
  const pack = method === "combined_pill" ? (packDays === 91 ? 91 : 28) : undefined;
  if (prev.method === method && prev.packDays === pack) return prev;
  const next: Contraception = { ...prev, method };
  if (pack) next.packDays = pack;
  else delete next.packDays;
  return next;
}

/** What her answer is doing right now, for under the question in settings. Null: nothing to add. */
export function contraceptionNote(c: Contraception | null): string | null {
  if (!c) return null;
  if (c.answer === "hormonal") return c.method === "combined_pill" ? PILL_LINE : HORMONAL_LINE;
  if (c.restartFrom) {
    return `Predictions start fresh from ${formatDay(c.restartFrom)}. Bleeds before that were on a method, so they're kept but not counted.`;
  }
  return null;
}

/** For the doctor summary — what a clinician asks first, in her numbers. Null when she hasn't said. */
export function contraceptionForDoctor(c: Contraception | null): string | null {
  if (!c) return null;
  const noted = formatDay(c.since, { year: true });
  switch (c.answer) {
    case "hormonal":
      return c.method === "combined_pill"
        ? `Hormonal contraception: yes, the combined pill, ${c.packDays ?? DEFAULT_PACK_DAYS}-day pack (noted in welliva on ${noted}). Bleeds are logged; the next is shown from the pack schedule only.`
        : `Hormonal contraception: yes${c.method === "other" ? ", a method other than the combined pill" : ""} (noted in welliva on ${noted}). Bleeding on it is logged, not predicted.`;
    case "none":
      return c.restartFrom
        ? `Hormonal contraception: stopped (noted in welliva on ${noted}). Cycle figures count from ${formatDay(c.restartFrom, { year: true })}.`
        : "Hormonal contraception: no.";
    case "unsaid":
      return c.restartFrom
        ? `Cycle figures count from ${formatDay(c.restartFrom, { year: true })}, after a change of contraception.`
        : null;
  }
}
