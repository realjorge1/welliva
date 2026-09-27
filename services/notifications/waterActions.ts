/**
 * services/notifications/waterActions.ts
 *
 * "Drank a glass" — the water-logging path that runs WITHOUT the app.
 *
 * Unlike a meal or a habit, a glass has no natural identity to dedupe on: two
 * glasses at 10am are two glasses. So idempotency lives one level up, in the
 * response pipeline's handled-key ledger (the same press delivered twice has the
 * same key and is applied once). Everything else follows the sibling actions:
 *
 *   • DATED BY THE NOTIFICATION — a 9pm reminder pressed after midnight counts
 *     toward the day it was for.
 *   • LANDS ON THE RIGHT DAY — through services/nutrition/waterStore, which only
 *     touches today's counter when the counter is holding that day, and parks
 *     anything else in an inbox the app folds in later.
 *   • FAIL-SOFT — a reason, never a throw.
 */
import { toLocalDateString } from "../OfflineStorage";
import { logWaterFor } from "../nutrition/waterStore";
import { DEFAULT_GLASS_ML } from "./categories";
import { emitExternalWrite } from "./externalWrites";
import { fireDateOf } from "./fireTime";

export type LogWaterResult =
  | { ok: true; ml: number; date: string; queued: boolean }
  | { ok: false; reason: "error" };

/**
 * @param ml       from the notification's `data.ml` (the glass the button named)
 * @param firedAt  `response.notification.date` (seconds on iOS, ms on Android)
 */
export async function logWaterFromNotification(
  ml: unknown,
  firedAt?: number,
): Promise<LogWaterResult> {
  try {
    const amount =
      typeof ml === "number" && Number.isFinite(ml) && ml > 0 && ml <= 2000
        ? Math.round(ml)
        : DEFAULT_GLASS_ML;
    const date = toLocalDateString(fireDateOf(firedAt));
    const written = await logWaterFor(date, amount);
    emitExternalWrite({ kind: "water", date });
    return { ok: true, ml: amount, date, queued: written.where === "inbox" };
  } catch {
    return { ok: false, reason: "error" };
  }
}
