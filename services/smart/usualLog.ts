/**
 * services/smart/usualLog.ts
 *
 * Log "your usual" — the one write both doors share: the Log it button in the
 * app and "Had my usual" on a meal reminder's lock screen.
 *
 *   · EXACTLY AS RECORDED. The snapshot's entries go in unchanged, through the
 *     food log's own lock and back-log window (foodLogStore.relogEntries).
 *   · ONCE. If that meal already holds every item of the usual that day, it is
 *     reported as already logged and nothing is written — a second press, or a
 *     press after logging it in the app, can't add a second breakfast.
 *   · A FORGET WINS. A usual turned away after this snapshot was taken is not
 *     logged from it.
 *   · THE DAY IS KEPT the same way any food log keeps it — today only.
 *
 * Lean: no React, no food catalogs, no resolver. Safe in the headless task.
 */
import { todayDate } from "../OfflineStorage";
import { emitExternalWrite } from "../notifications/externalWrites";
import { relogEntries, type FoodLogEntry } from "../nutrition/foodLogStore";
import { creditCommitment } from "../StreakService";
import { containsAll, itemKey, type UsualSnapshot } from "./usual";
import { loadForgottenUsuals } from "./usualStore";

export type LogUsualOutcome =
  | { status: "logged"; date: string; entries: FoodLogEntry[] }
  | { status: "already"; date: string }
  | { status: "closed"; date: string }
  | { status: "forgotten"; date: string };

export async function logUsual(
  snapshot: UsualSnapshot,
  date: string,
  now: Date = new Date(),
): Promise<LogUsualOutcome> {
  const forgotten = await loadForgottenUsuals();
  if (forgotten.some((f) => f.id === snapshot.id && f.at > snapshot.madeAt)) {
    return { status: "forgotten", date };
  }

  const wanted = snapshot.entries.flatMap((e) => e.items.map(itemKey));
  const result = await relogEntries({
    date,
    slot: snapshot.slot,
    entries: snapshot.entries,
    alreadyLogged: (day) =>
      containsAll(
        day.filter((e) => e.slot === snapshot.slot).flatMap((e) => (e.items ?? []).map(itemKey)),
        wanted,
      ),
    now,
  });

  if (result.status !== "logged") return { status: result.status, date };
  if (date === todayDate()) await creditCommitment(date);
  emitExternalWrite({ kind: "meal", date });
  return { status: "logged", date, entries: result.entries };
}
