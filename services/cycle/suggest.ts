/**
 * services/cycle/suggest.ts — one new suggestion at a time.
 *
 * The smart-cycle features each have something to put in front of her: why a
 * period might be late, a period that will land on a trip, "that's water, not
 * fat", "what helped?", and the hungrier-week offer. Any one of them is useful;
 * five at once is a wall, and a wall is skimmed. So the cycle screen keeps ONE
 * slot for them, and the most time-sensitive one that applies today takes it.
 *
 * The order is the owner's brief: a late period outranks everything, then a
 * trip it will land on, then the water reading, then the question about
 * yesterday, then the offer.
 *
 * A TRIP FAR OFF WAITS ITS TURN. "Coming up" can be true for two months. Taking
 * the slot for all of them would silence a one-day question about yesterday's
 * cramps for weeks, for the sake of a line that says the same thing tomorrow. So
 * a trip outranks the others once it is close ({@link TRIP_SOON_DAYS}); before
 * then it shows on days nothing more pressing has anything to say.
 *
 * The welcome state and the pregnancy pause are not suggestions and always win
 * by being the whole screen; the existing Gozlin ask and the doctor notes keep
 * their own places.
 */

export type SuggestionKind = "late" | "trip" | "water" | "relief" | "hungry" | "trip-later";

export const SUGGESTION_ORDER: readonly SuggestionKind[] = [
  "late",
  "trip",
  "water",
  "relief",
  "hungry",
  "trip-later",
];

/** From this many days before a trip, it outranks everything but a late period. */
export const TRIP_SOON_DAYS = 14;

/** The suggestion that takes the slot today, or null when none applies. */
export function topSuggestion(available: Partial<Record<SuggestionKind, boolean>>): SuggestionKind | null {
  return SUGGESTION_ORDER.find((k) => available[k]) ?? null;
}
