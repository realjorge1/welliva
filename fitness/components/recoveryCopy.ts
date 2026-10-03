/**
 * The recovery card's words: the label beside the score and the line under it.
 *
 * Kept out of the screen so the clock arithmetic can be tested. "Full again
 * by…" is a promise with a time in it, and its edges (midnight, noon, a battery
 * that won't be full until the weekend) are exactly where a hand-checked string
 * goes wrong.
 */
import type { RecoveryState } from "@/services/gozlin/gozlin.types";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface RecoveryCopy {
  /** Beside the score: what to do with it. */
  label: string;
  /**
   * Under the score: when the battery is full again, or, when something other
   * than training holds it down (a short night, "Drained"), what that is. Null
   * at full — there is nothing to wait for.
   */
  note: string | null;
}

export function recoveryCopy(
  r: Pick<RecoveryState, "score" | "level" | "fullAt" | "heldBackBy">,
  now: number,
): RecoveryCopy {
  if (r.score >= 100) return { label: "Fully charged", note: null };
  const label =
    r.level === "green" ? "Ready to train" : r.level === "amber" ? "Keep it light" : "Rest and recharge";
  const note = r.fullAt
    ? fullAgainBy(r.fullAt, now)
    : r.heldBackBy
      ? r.heldBackBy.charAt(0).toUpperCase() + r.heldBackBy.slice(1)
      : null;
  return { label, note };
}

/**
 * "Full again by 4 pm" · "by 7 am tomorrow" · "by Sat 2 pm". Rounded UP to the
 * hour, so the card never promises a full battery before the model has one.
 */
export function fullAgainBy(at: number, now: number): string {
  const t = new Date(at);
  if (t.getMinutes() || t.getSeconds() || t.getMilliseconds()) {
    t.setHours(t.getHours() + 1, 0, 0, 0);
  }
  const h = t.getHours();
  // Midnight closes the evening before it: "by midnight", not "by 12 am tomorrow".
  if (h === 0) t.setDate(t.getDate() - 1);
  const clock = h === 0 ? "midnight" : h === 12 ? "noon" : `${h % 12} ${h < 12 ? "am" : "pm"}`;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(t) - startOf(new Date(now))) / 86_400_000);
  if (days <= 0) return `Full again by ${clock}`;
  if (days === 1) return `Full again by ${clock} tomorrow`;
  return `Full again by ${WEEKDAY[t.getDay()]} ${clock}`;
}
