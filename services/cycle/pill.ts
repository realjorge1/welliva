/**
 * services/cycle/pill.ts — the combined pill's bleed, from the pack. PURE.
 *
 * On hormonal contraception the tracker logs and predicts nothing (./predict's
 * "hormonal" mode, decided 2026-11-03), because bleeding follows the method.
 * But on the COMBINED pill it follows the pack, and that is the most
 * predictable bleed there is: the owner said yes to saying so (2026-11-20,
 * Fix 12), for the combined pill only.
 *
 * So one small, separate forecast — never "your period", always "from your
 * pack schedule": her last bleed's first day plus the pack length (28 days, or
 * 91 for an extended pack), give or take PILL_HALF_WIDTH. Nothing else of a
 * cycle comes with it: no ovulation, no fertile window, no phases, no "late",
 * no hormone card, no hungrier-week plan, no "why am I late". The mode stays
 * "hormonal", so every other switch on the mode is untouched.
 *
 * A bleed that doesn't come when the pack says is something a pregnancy test
 * answers — the late page's own line (./late PREGNANCY_TEST_LINE), nothing new.
 * Another method (patch, ring, implant, injection, coil, the progestogen-only
 * pill) stays log-only: bleeding on those often changes or stops.
 */

import { addDays, formatRange } from "./dates";
import { splitEpisodes } from "./episodes";
import type { CycleMode } from "./predict";
import type { ContraceptionMethod, CycleSettings, PeriodEpisode } from "./types";

/** Days either side of the pack's day: the bleed usually starts a day or two into the break. */
export const PILL_HALF_WIDTH = 2;
/** The pack lengths she can choose: a standard pack, and an extended (three-month) one. */
export const PACK_DAYS_OPTIONS = [28, 91] as const;
export const DEFAULT_PACK_DAYS = 28;

/** The follow-up to a "yes", in the words setup and settings both use. */
export const METHOD_QUESTION = "Which one?";
export const METHOD_OPTIONS: readonly { value: ContraceptionMethod; label: string }[] = [
  { value: "combined_pill", label: "Combined pill" },
  { value: "other", label: "Another method" },
];
/** Chip values are text (the chip grid's contract); `Number(value)` is the pack length. */
export const PACK_OPTIONS: readonly { value: "28" | "91"; label: string }[] = [
  { value: "28", label: "28-day pack" },
  { value: "91", label: "91-day pack" },
];

/** What a "Combined pill" answer does, in one calm line. */
export const PILL_LINE =
  "On the combined pill the bleed follows your pack, so I show when the next one is likely from your pack schedule. Nothing else is predicted.";

export interface PillForecast {
  /** First day of her last bleed: the pack is counted from it. */
  from: string;
  earliest: string;
  likely: string;
  latest: string;
  packDays: number;
  /** Past `latest` with no new bleed logged. */
  missed: boolean;
}

/**
 * The next bleed on the combined pill, or null: any other method, any other
 * mode, no bleed logged yet, or so long past the pack's day (a whole pack
 * later) that it no longer says anything.
 */
export function pillForecast(input: {
  episodes: readonly PeriodEpisode[];
  settings: Pick<CycleSettings, "contraception">;
  mode: CycleMode;
  today: string;
}): PillForecast | null {
  const c = input.settings.contraception;
  if (input.mode !== "hormonal" || c?.answer !== "hormonal" || c.method !== "combined_pill") return null;
  const periods = splitEpisodes(input.episodes).periods;
  const last = periods[periods.length - 1];
  if (!last || last.start > input.today) return null;
  const packDays = c.packDays ?? DEFAULT_PACK_DAYS;
  const likely = addDays(last.start, packDays);
  const latest = addDays(likely, PILL_HALF_WIDTH);
  if (input.today > addDays(latest, packDays)) return null;
  return {
    from: last.start,
    earliest: addDays(likely, -PILL_HALF_WIDTH),
    likely,
    latest,
    packDays,
    missed: input.today > latest,
  };
}

/** "Next bleed likely 12–16 Dec, from your pack schedule." — never "period". */
export function pillLine(f: PillForecast): string {
  return f.missed
    ? `Your pack schedule put your bleed around ${formatRange(f.earliest, f.latest)}, and none is logged yet.`
    : `Next bleed likely ${formatRange(f.earliest, f.latest)}, from your pack schedule.`;
}
