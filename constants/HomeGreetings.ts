/**
 * HOME GREETINGS
 * Time-of-day headline shown on the home dashboard (replaces the old static
 * goal headline like "Let's get fitter").
 *
 * 5 day-parts × 30 greetings. Each app open shows the *next* greeting in a
 * shuffled rotation for the current day-part — a particular greeting never
 * repeats until the other 29 in its bucket have all been shown. Rotation
 * state is persisted via OfflineStorage so it survives app restarts.
 */

import { readJSON, writeJSON } from "@/services/OfflineStorage";

export type DayPart =
  | "morning"
  | "afternoon"
  | "evening"
  | "night"
  | "lateNight";

/** Bucket the current local hour into a day-part. */
export function getDayPart(date: Date = new Date()): DayPart {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "morning"; // 5am – 11:59am
  if (h >= 12 && h < 17) return "afternoon"; // 12pm – 4:59pm
  if (h >= 17 && h < 21) return "evening"; // 5pm – 8:59pm
  if (h >= 21 && h < 24) return "night"; // 9pm – 11:59pm
  return "lateNight"; // 12am – 4:59am
}

// Each greeting is kept short (≤18 chars) so it fits the single-line title
// in the home header without truncating, even on small phones.
export const HOME_GREETINGS: Record<DayPart, string[]> = {
  morning: [
    "Rise and grind",
    "Good morning",
    "Fresh start",
    "Own the morning",
    "New day, new gains",
    "Morning fuel",
    "Wake up and win",
    "Today is yours",
    "Strong start",
    "First move",
    "Sunrise, let's go",
    "Make it count",
    "Morning momentum",
    "Up and at it",
    "Rise and shine",
    "Best day yet",
    "Seize the day",
    "Fuel up",
    "Morning hustle",
    "Bright day ahead",
    "Let's make moves",
    "Start strong",
    "Grow today",
    "Crush it today",
    "Today's the day",
    "Energy unlocked",
    "With intention",
    "Go get it",
    "Clear and ready",
    "Let's thrive",
  ],
  afternoon: [
    "Keep going",
    "Good afternoon",
    "Halfway there",
    "Power hour",
    "Refuel, refocus",
    "Stay on track",
    "You're doing great",
    "Second wind",
    "Keep crushing it",
    "Finish strong",
    "Steady the pace",
    "Midday momentum",
    "Don't slow down",
    "Push through",
    "Stay locked in",
    "Keep it moving",
    "Afternoon hustle",
    "Keep showing up",
    "You've got this",
    "Beat the slump",
    "Recharge, roll on",
    "Make it count",
    "Strong all day",
    "Stay hungry",
    "Onward",
    "Full focus",
    "Keep the streak",
    "Fuel the grind",
    "Stay the course",
    "Keep at it",
  ],
  evening: [
    "Finish strong",
    "Good evening",
    "Wind down",
    "You showed up",
    "End on a high",
    "Reflect, recharge",
    "Lasting gains",
    "You earned this",
    "Close proud",
    "Time to unwind",
    "Strong finish",
    "Wrap it up right",
    "Evening reset",
    "Today's wins",
    "Breathe easy",
    "One more push",
    "Settle in",
    "Your time",
    "Done is good",
    "Ease into night",
    "Well deserved",
    "Solid day",
    "You've earned it",
    "Evening momentum",
    "See your progress",
    "Good evening champ",
    "Finish it off",
    "Recover and grow",
    "Today was a win",
    "Recharge tonight",
  ],
  night: [
    "Rest up",
    "Good night",
    "Sleep is power",
    "Wind it down",
    "Let it rebuild",
    "You earned rest",
    "Recharge tonight",
    "Time to recover",
    "Power down",
    "Chase the dream",
    "Rest hard",
    "You did well",
    "Recovery mode",
    "Let the day go",
    "Breathe, unwind",
    "Sleep to grow",
    "Rest for tomorrow",
    "Switch off",
    "End grateful",
    "Rest, warrior",
    "Let muscles grow",
    "Calm night",
    "Slow it down",
    "Strong soul",
    "Drift off",
    "Recover, reset",
    "Sleep tight",
    "Let rest restore",
    "Rest pays off",
    "See you stronger",
  ],
  lateNight: [
    "Midnight oil",
    "Be kind to you",
    "Take it easy",
    "Quiet hours",
    "Night owl mode",
    "You're here",
    "Rest soon",
    "Midnight check-in",
    "Clear mind",
    "Gentle pace",
    "Don't forget rest",
    "Time to reflect",
    "Night owl?",
    "Food for thought",
    "Take it slow",
    "Midnight motive",
    "Still grinding?",
    "Wind down soon",
    "Deep breaths",
    "The night is calm",
    "Rest is calling",
    "Be gentle",
    "Big dreams",
    "Soft focus",
    "Up early? Let's go",
    "Pre-dawn warrior",
    "Catch some rest",
    "Recharge mode",
    "You've got this",
    "Steady heart",
  ],
};

// ============================================================================
// ROTATION — shuffled, no repeat until the whole bucket has been shown.
// ============================================================================

const ROTATION_KEY = "@welliva_home_greeting_rotation";

interface BucketState {
  /** A shuffled sequence of indices into HOME_GREETINGS[part]. */
  order: number[];
  /** Position of the *next* greeting to show within `order`. */
  cursor: number;
}

type RotationState = Partial<Record<DayPart, BucketState>>;

/** Fisher–Yates shuffle of [0..n-1]. */
function shuffledIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Return the next greeting for the current day-part and advance the rotation.
 * Call once per app open (e.g. on the home screen mount).
 */
export async function nextHomeGreeting(now: Date = new Date()): Promise<string> {
  const part = getDayPart(now);
  const greetings = HOME_GREETINGS[part];

  const state = await readJSON<RotationState>(ROTATION_KEY, {});
  let bucket = state[part];

  // Start (or restart) the cycle when there's no state, the bucket is
  // exhausted, or the greeting list length changed (e.g. after an update).
  if (
    !bucket ||
    bucket.cursor >= bucket.order.length ||
    bucket.order.length !== greetings.length
  ) {
    bucket = { order: shuffledIndices(greetings.length), cursor: 0 };
  }

  const greeting = greetings[bucket.order[bucket.cursor]];
  bucket.cursor += 1;

  state[part] = bucket;
  await writeJSON(ROTATION_KEY, state);

  return greeting;
}
