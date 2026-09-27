/**
 * services/notifications/fireTime.ts
 *
 * WHEN DID THIS REMINDER FIRE? — in one unit, on both platforms.
 *
 * Every lock-screen write is dated by the notification's fire time, not by the
 * clock when the button is pressed (a 9pm reminder pressed at 00:20 belongs to
 * the day it was for). That date comes from `response.notification.date`, and
 * the two platforms disagree about its unit:
 *
 *   · Android serializes it in MILLISECONDS (`Date.getTime()`).
 *   · iOS serializes it in SECONDS (`timeIntervalSince1970`), and expo's JS layer
 *     passes it through untouched.
 *
 * Handed straight to `new Date()`, an iOS value lands in January 1970 — every
 * "Mark as Done" pressed on an iPhone logged the habit on 1970-01-21, and every
 * "Ate it" looked for a meal plan from 1970 and found none. So nothing reads
 * that field except through here.
 *
 * The split point is 1e11: as seconds that is the year 5138, as milliseconds it
 * is 1973. No real fire time is on the wrong side of it in either unit.
 */

const SECONDS_CEILING = 1e11;

/** A notification's fire time in epoch milliseconds, or null if unusable. */
export function fireTimeMs(raw: unknown): number | null {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  return n < SECONDS_CEILING ? Math.round(n * 1000) : Math.round(n);
}

/** The fire time as a Date — falling back to now when the value is unusable. */
export function fireDateOf(raw: unknown): Date {
  const ms = fireTimeMs(raw);
  return ms === null ? new Date() : new Date(ms);
}
