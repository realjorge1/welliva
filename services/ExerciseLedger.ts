/**
 * EXERCISE LEDGER — the stored half of the seen-ledger
 * (services/gozlin/novelty/detector.ts): the first time each exercise, and
 * each family of exercises, appeared on this person's log.
 *
 * WHY IT LIVES BESIDE THE WORKOUT LOG, IN `@welliva_`. It is an index of the
 * session history, not something Gozlin was told. "Clear memory" leaves the
 * session history alone and so leaves this alone; "Reset data" wipes both.
 * Clearing it on its own would make a move done in June look brand new in
 * September — exactly the false claim it exists to prevent.
 *
 * It is fed from two places, and both are idempotent by `sessionRunId`:
 *   · SessionService.saveSummary — every session, the moment it is stored;
 *   · a catch-up over the whole history when the coach screen mounts, which
 *     also detects a hole (see ingestSessions).
 * Writes are serialised: the player and the summary screen save the same run
 * within a second of each other, and two read-modify-writes interleaved would
 * each drop the other's session.
 */

import type { SessionSummaryData } from "../models/session";
import { emptyLedger, ingestSessions, type SeenLedger } from "./gozlin/novelty/detector";
import { readJSON, writeJSON } from "./OfflineStorage";

export const EXERCISE_LEDGER_KEY = "@welliva_exercise_seen";

let queue: Promise<unknown> = Promise.resolve();

function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

export async function loadExerciseLedger(): Promise<SeenLedger> {
  const stored = await readJSON<SeenLedger | null>(EXERCISE_LEDGER_KEY, null);
  return stored && stored.version === 1 && stored.subjects ? stored : emptyLedger();
}

/**
 * Fold sessions into the stored ledger and return it. Never throws: a failed
 * ingest only means the next catch-up does the work.
 */
export function ingestIntoLedger(
  sessions: readonly SessionSummaryData[],
  opts: { fullHistory?: boolean } = {},
): Promise<SeenLedger> {
  return serial(async () => {
    const current = await loadExerciseLedger();
    try {
      const next = ingestSessions(current, sessions, opts);
      if (next !== current) await writeJSON(EXERCISE_LEDGER_KEY, next);
      return next;
    } catch (e) {
      console.error("ExerciseLedger.ingest:", e);
      return current;
    }
  });
}
