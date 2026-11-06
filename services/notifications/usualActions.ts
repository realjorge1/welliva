/**
 * services/notifications/usualActions.ts
 *
 * "Had my usual" — the meal reminder's other button, for someone who logs that
 * meal freely rather than off a plan (services/smart/usual).
 *
 * The sibling of mealActions, with the same promises:
 *
 *   · IDEMPOTENT. The pipeline's ledger stops a repeat delivery; underneath it,
 *     a meal that already holds the usual is reported as logged, not logged
 *     twice (services/smart/usualLog).
 *   · DATED BY THE NOTIFICATION, never past today. A reminder that fired
 *     before midnight and is pressed after it logs the day it was for.
 *   · NOTHING RESOLVED. The usual's entries rode in the notification itself,
 *     snapshotted when it was scheduled, so a press that boots the app
 *     headless never loads a food catalog or the nutrient resolver.
 *   · FAIL-SOFT. Every failure is a returned reason, never a throw.
 */
import { toLocalDateString } from "../OfflineStorage";
import { isUsualSnapshot, usualLabels } from "../smart/usual";
import { logUsual } from "../smart/usualLog";
import { fireDateOf } from "./fireTime";

export type LogUsualResult =
  | {
      ok: true;
      /** Local date logged. */
      date: string;
      /** "Oats with milk, coffee" — the usual, in its own words. */
      label: string;
      /** Already in that meal; nothing changed. */
      alreadyLogged: boolean;
    }
  | {
      ok: false;
      reason: "malformed" | "forgotten" | "closed" | "error";
      date?: string;
    };

/**
 * @param snapshot  the notification's `data.usual`
 * @param firedAt   when it fired, or the day it was for (see pipeline)
 */
export async function logUsualFromNotification(
  snapshot: unknown,
  firedAt?: number,
): Promise<LogUsualResult> {
  if (!isUsualSnapshot(snapshot)) return { ok: false, reason: "malformed" };
  let date: string | undefined;
  try {
    const fired = toLocalDateString(fireDateOf(firedAt));
    const today = toLocalDateString(new Date());
    date = fired > today ? today : fired;

    const out = await logUsual(snapshot, date);
    const label = usualLabels(snapshot).join(", ");
    switch (out.status) {
      case "logged":
        return { ok: true, date, label, alreadyLogged: false };
      case "already":
        return { ok: true, date, label, alreadyLogged: true };
      case "closed":
        return { ok: false, reason: "closed", date };
      case "forgotten":
        return { ok: false, reason: "forgotten", date };
    }
  } catch {
    return { ok: false, reason: "error", date };
  }
}
