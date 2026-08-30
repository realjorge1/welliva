/**
 * TODAY'S INTAKE, READ FROM DISK — and the difference between "nothing" and
 * "we could not tell".
 *
 * ── WHY THIS IS ITS OWN MODULE ──────────────────────────────────────────────
 * A day's intake lives in two documents (the intake ledger and the free-form
 * food log), and the provider reads both on launch, on every tick, on a day
 * rollover and on every return to the foreground. Whenever that read was
 * written inline it was written as one `await` chain over both — which means
 * the FIRST failure decides BOTH, and the value the provider is left holding is
 * the one it was initialised with: zero.
 *
 * That is not a hypothetical. It is the exact shape of the bug this whole
 * subsystem exists to end — a day that reads 0 kcal with its meals still
 * visibly ticked. Nothing on screen distinguishes "you ate nothing today" from
 * "we could not read what you ate", and the first is a lie the app tells with
 * total confidence.
 *
 * So the read returns `null` for a half it could not load, and ZERO only when
 * the record genuinely says zero. The caller keeps what it already had for a
 * `null`. Stale numbers are a wrongness the next read fixes; a confident zero
 * is one the user acts on — skipping dinner because the app said they had
 * room, or force-quitting an app they no longer trust.
 *
 * ── WHY BOTH HALVES ARE READ EVEN IF THE PLAN IS UNREADABLE ─────────────────
 * The day's calories do not depend on the plan. They are the records of what
 * was eaten, and the plan is a different question (what was scheduled, and how
 * much of it was followed). Callers resolve the plan first only because doing
 * so reconciles the ledger against it — never because the total needs it.
 */

import { foodLogMacrosRaw, intakeMacrosRaw, type MacroTotals } from "./DayTotals";
import { getIntakeForDate } from "./IntakeLedger";
import { getFoodLogForDate } from "./foodLogStore";

export interface DayIntakeRead {
  /**
   * The ticked-meal half, UNROUNDED — or null if the ledger could not be read.
   * Null means "keep what you had", never "the user ate nothing".
   */
  intake: MacroTotals | null;
  /** The free-form half, UNROUNDED. Same null contract as `intake`. */
  foodLog: MacroTotals | null;
}

/**
 * Read both halves of a day's intake, each on its own.
 *
 * Unrounded on purpose: the caller adds the two and rounds ONCE, so the total
 * on screen always equals the sum of the parts printed under it rather than the
 * sum of two separately-rounded halves. See DayTotals.sumMacros.
 */
export async function readDayIntake(date: string): Promise<DayIntakeRead> {
  const [intake, log] = await Promise.allSettled([
    getIntakeForDate(date),
    getFoodLogForDate(date),
  ]);

  if (intake.status === "rejected") {
    console.error(`readDayIntake(${date}): intake ledger unreadable:`, intake.reason);
  }
  if (log.status === "rejected") {
    console.error(`readDayIntake(${date}): food log unreadable:`, log.reason);
  }

  return {
    intake: intake.status === "fulfilled" ? intakeMacrosRaw(intake.value) : null,
    foodLog: log.status === "fulfilled" ? foodLogMacrosRaw(log.value) : null,
  };
}
