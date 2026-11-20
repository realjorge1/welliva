/**
 * services/cycle/bbt.ts — a temperature rise that CONFIRMS ovulation. PURE.
 *
 * After ovulation, progesterone lifts the resting (basal) body temperature by a
 * few tenths of a degree and holds it there until the period. So a sustained
 * rise says, after the fact, that ovulation happened — and roughly when. It is
 * the best free sign there is for someone who doesn't buy ovulation tests, and
 * the only way she can learn her own second half without them.
 *
 * THE RULE (the "three over six" rule, the standard one):
 *   · three readings on three consecutive days, each higher than the highest
 *     of the six readings before them (the "cover line"),
 *   · the third at least RISE_MIN_C above that line,
 *   · at least COVER_READINGS readings in the COVER_LOOKBACK_DAYS days before
 *     the first high day (a gappy chart can't draw a cover line),
 *   · readings outside PLAUSIBLE_C are ignored (a fever, a typo, a °F number
 *     typed as °C).
 * Ovulation is the day BEFORE the first high day.
 *
 * RETROSPECTIVE ONLY. It can confirm ovulation once the third high day is
 * logged; it can never predict it, and every surface says so. Illness,
 * alcohol, a short or broken night, travel and shift work all disturb it.
 *
 * Unlike an LH test it is allowed with PCOS on the profile: an LH test can
 * read positive without ovulation there, but a sustained temperature rise
 * reflects progesterone, which only ovulation makes.
 *
 * TEMPERATURE_LOGGING gates the day-sheet row (and the unit switch, and the
 * library page): temperature is a new kind of health information, so it waited
 * for its words in the Privacy Policy (LEGAL_VERSION 7, published 2026-11-20).
 */

import { addDays, daysBetween } from "./dates";
import type { CycleDays } from "./types";

/**
 * Whether she may log a temperature: the day-sheet row (fertile window on), the
 * °C/°F choice and the library page. ON since 2026-11-20, when the privacy
 * wording for it went into LEGAL_VERSION 7 and was published (the owner's
 * "yes"). Switching it off again hides the row; the engine still reads any
 * temperature already logged.
 */
export const TEMPERATURE_LOGGING = true;

/** What can be stored, in °C: a thermometer's plausible range. Values are kept to 0.05. */
export const TEMPERATURE_RANGE_C = { min: 34, max: 42 } as const;
export const TEMPERATURE_STEP_C = 0.05;
/** What the rule reads as a resting temperature at all; anything else is ignored. */
export const PLAUSIBLE_C = { min: 35, max: 38 } as const;
/** The cover line is the highest of this many readings before the rise... */
export const COVER_READINGS = 6;
/** ...which must fall within this many days before the first high day. */
export const COVER_LOOKBACK_DAYS = 10;
/** Consecutive high days that make a rise sustained. */
export const HIGH_DAYS = 3;
/** The last high day sits at least this far above the cover line, in °C. */
export const RISE_MIN_C = 0.2;

/** A stored temperature: inside the range, kept to 0.05 °C. Null for anything else. */
export function normalizeTemperatureC(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < TEMPERATURE_RANGE_C.min || v > TEMPERATURE_RANGE_C.max) return null;
  return Number((Math.round(v / TEMPERATURE_STEP_C) * TEMPERATURE_STEP_C).toFixed(2));
}

/** °C → °F, to one decimal. */
export const cToF = (c: number) => Math.round((c * 1.8 + 32) * 10) / 10;
/** °F → °C (unrounded: normalizeTemperatureC rounds what is stored). */
export const fToC = (f: number) => (f - 32) / 1.8;

/** A reading the rule will use, or null. */
function reading(days: CycleDays, date: string): number | null {
  const t = days[date]?.temperatureC;
  return typeof t === "number" && t >= PLAUSIBLE_C.min && t <= PLAUSIBLE_C.max ? t : null;
}

export interface TemperatureRise {
  /** The day before the first high day. */
  ovulation: string;
  /** The first of the three high days. */
  firstHigh: string;
  /** The highest of the readings before it. */
  coverLine: number;
}

/**
 * The first sustained rise whose first high day falls in [from, to], with all
 * three high days logged by `to`. Null when there is none — including when
 * there are too few readings to tell.
 */
export function temperatureRise(days: CycleDays, from: string, to: string): TemperatureRise | null {
  for (let first = from; daysBetween(first, to) >= HIGH_DAYS - 1; first = addDays(first, 1)) {
    const highs: number[] = [];
    for (let i = 0; i < HIGH_DAYS; i += 1) {
      const t = reading(days, addDays(first, i));
      if (t === null) break;
      highs.push(t);
    }
    if (highs.length < HIGH_DAYS) continue;

    // The six most recent readings before the first high day, within the lookback.
    const before: number[] = [];
    for (let k = 1; k <= COVER_LOOKBACK_DAYS && before.length < COVER_READINGS; k += 1) {
      const t = reading(days, addDays(first, -k));
      if (t !== null) before.push(t);
    }
    if (before.length < COVER_READINGS) continue;

    const coverLine = Math.max(...before);
    if (highs.every((t) => t > coverLine) && highs[HIGH_DAYS - 1] - coverLine >= RISE_MIN_C - 1e-9) {
      return { ovulation: addDays(first, -1), firstHigh: first, coverLine };
    }
  }
  return null;
}

/** "36.55 °C" / "97.8 °F". */
export function formatTemperature(c: number, unit: "C" | "F"): string {
  return unit === "F" ? `${cToF(c).toFixed(1)} °F` : `${c.toFixed(2)} °C`;
}

/** What the day sheet and the library say about it. */
export const TEMPERATURE_COPY = {
  label: "Temperature",
  hint: "Optional. Taken on waking, before you get up. Temperature confirms ovulation after it happens; it can't predict it.",
  confirmed: (day: string) => `Your temperature rise confirmed ovulation around ${day}.`,
} as const;
