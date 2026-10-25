/**
 * services/notifications/cycleActions.ts
 *
 * "Started today" / "It ended today" — the cycle's lock-screen answers, written
 * WITHOUT the app.
 *
 * The cycle reminders were the one place in welliva that asked a question and
 * then could not take the answer: the check-in says "has your period started?"
 * and, until this module existed, the only way to say yes was to open the app
 * and find the screen. Now the press writes the episode straight to storage,
 * through exactly the same pure functions the cycle screen uses
 * (services/cycle/episodes), so a period logged from a locked phone is
 * indistinguishable from one logged by tapping the dial.
 *
 * ── WHICH DAY IT LANDS ON ───────────────────────────────────────────────────
 * The notification's FIRE DATE, not the moment of the press — the rule every
 * other action in this folder follows (./fireTime). A check-in fires at 09:00
 * and sits on the lock screen; answering it at 00:30 is still an answer about
 * the day it asked about. The date is clamped to today, because a period can
 * never start in the future, and the receipt in the journal names the day it
 * wrote, so a press that landed on yesterday says so rather than being silent.
 *
 * ── WHAT "NO" WRITES ────────────────────────────────────────────────────────
 * Nothing. "Not yet" and "Still going" are acknowledgements: they dismiss the
 * banner and leave a receipt, and that is the whole of it. The app already knows
 * what they mean — a period with no log past its predicted window is what
 * "Late by 3 days" on Home reads from, and an unended period going past its
 * usual length is what makes the screen ask "has it ended?". Writing a "she
 * said no" flag would be a second source of truth for a fact the log already
 * holds.
 *
 * ── AFTER A WRITE ───────────────────────────────────────────────────────────
 * Two things have to happen, and both are the reason this file is longer than a
 * one-liner:
 *   · THE QUEUE IS RE-LAID (./relay through services/cycle/reminders). A period
 *     logged as started must cancel its own check-in and schedule the "has it
 *     ended?" question; otherwise the next morning asks again about something
 *     she has already answered.
 *   · THE LIVE APP IS TOLD (./externalWrites). CycleProvider holds the log in
 *     memory; without the announcement the dial would keep showing the old day
 *     until the next remount.
 *
 * Only storage and the pure cycle modules are imported — no react-native, no
 * router — so this is testable under Node and runs in the headless task.
 */
// The SUBMODULES, not the `services/cycle` barrel. This file is in the Android
// headless task's module graph (./backgroundTask → ./pipeline → here), and the
// barrel re-exports care.ts, which pulls in the whole canonical-food database.
// A lock-screen button must not drag the nutrition catalog into a bundle that
// boots to write one date.
import { endPeriod, episodeOn, liveEpisodes, openEpisode, startPeriod } from "../cycle/episodes";
import { typicalPeriodLength } from "../cycle/predict";
import { relayCycleReminders } from "../cycle/reminders";
import { loadCycleData, savePeriods, withCycleLock } from "../cycle/store";
import type { CycleData, PeriodEpisode } from "../cycle/types";
import { todayDate, toLocalDateString } from "../OfflineStorage";
import { emitExternalWrite, subscribeExternalWrites } from "./externalWrites";
import { fireDateOf } from "./fireTime";

/** Which question the press answered. Comes from the notification's `data.kind`. */
export type CycleAnswerKind = "checkin" | "ended";

export type CycleAnswerResult =
  | {
      ok: true;
      kind: CycleAnswerKind;
      /** Local date the episode was written for. */
      date: string;
      /** True when the log already said this and nothing changed. */
      already: boolean;
    }
  | {
      ok: false;
      reason: "disabled" | "no-period" | "not-logged" | "error";
      /** The day it tried, when it got that far — for the follow-up's wording. */
      date?: string;
    };

// ── change notification ─────────────────────────────────────────────

/**
 * Observe out-of-band cycle writes. CycleProvider subscribes so a period logged
 * behind its back (lock screen, app backgrounded) reloads into the live UI — the
 * dial, the Home card and the reminder plan all recompute from the reloaded log.
 * Returns an unsubscribe.
 */
export function subscribeCycleLogChanged(fn: () => void): () => void {
  return subscribeExternalWrites((w) => {
    if (w.kind === "cycle") fn();
  });
}

// ── helpers ─────────────────────────────────────────────────────────

/**
 * The day to write. The reminder's fire date, never later than today — a period
 * cannot start or end in the future, and `startPeriod`/`endPeriod` would refuse
 * one silently.
 */
function dateFor(firedAt: number | undefined, today: string): string {
  const fired = toLocalDateString(fireDateOf(firedAt));
  return fired > today ? today : fired;
}

/** Her typical bleed, which is what resolves an unended period's last day. */
function typicalBleed(data: CycleData): number {
  return typicalPeriodLength(data.periods, data.settings).days;
}

/**
 * Persist periods the way CycleContext does — ordered by stamp, so a round trip
 * through another phone's merge doesn't read as a change.
 */
async function persist(periods: readonly PeriodEpisode[], backupOn: boolean): Promise<void> {
  const ordered = [...periods].sort((a, b) =>
    a.updatedAt !== b.updatedAt ? (a.updatedAt < b.updatedAt ? -1 : 1) : a.id < b.id ? -1 : 1,
  );
  await savePeriods(ordered, backupOn);
}

/** True when the two lists are the same episodes with the same fields. */
function unchanged(a: readonly PeriodEpisode[], b: readonly PeriodEpisode[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((ep, i) => JSON.stringify(ep) === JSON.stringify(b[i]));
}

// ── the actions ─────────────────────────────────────────────────────

/**
 * "Started today" — open a period on the reminder's day.
 *
 * @param firedAt `response.notification.date` (seconds on iOS, ms on Android)
 */
export async function logPeriodStartFromNotification(
  firedAt?: number,
): Promise<CycleAnswerResult> {
  try {
    const today = todayDate();
    const result = await withCycleLock(async (): Promise<CycleAnswerResult> => {
      const data = await loadCycleData();
      if (!data.settings.enabled) return { ok: false, reason: "disabled" };

      const date = dateFor(firedAt, today);
      const bleed = typicalBleed(data);

      // Already a period day: the answer is already in the log. Reported as a
      // success, like a habit that was already marked done — she pressed the
      // right button and the truth it claims is true.
      if (episodeOn(data.periods, date, today, bleed)) {
        return { ok: true, kind: "checkin", date, already: true };
      }

      const next = startPeriod(data.periods, date, today, bleed, new Date().toISOString());
      if (unchanged(data.periods, next)) return { ok: false, reason: "not-logged", date };

      await persist(next, data.settings.backupOn);
      return { ok: true, kind: "checkin", date, already: false };
    });

    if (result.ok) await announce(result.date);
    return result;
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * "It ended today" — close the open period on the reminder's day.
 *
 * Refused when there is nothing open to close: the reminder is only ever laid
 * while a period is running, but it can sit on the lock screen past the moment
 * she closed it in the app, and a button that invented an episode to close
 * would be writing a period she never had.
 */
export async function logPeriodEndFromNotification(
  firedAt?: number,
): Promise<CycleAnswerResult> {
  try {
    const today = todayDate();
    const result = await withCycleLock(async (): Promise<CycleAnswerResult> => {
      const data = await loadCycleData();
      if (!data.settings.enabled) return { ok: false, reason: "disabled" };

      const date = dateFor(firedAt, today);
      const open = openEpisode(data.periods);
      if (!open) {
        // Nothing open. If the period that covers that day is already closed,
        // she answered it in the app — say so as a success, not a failure.
        const covering = liveEpisodes(data.periods).filter((e) => e.start <= date).pop();
        if (covering?.end) return { ok: true, kind: "ended", date, already: true };
        return { ok: false, reason: "no-period", date };
      }

      const next = endPeriod(data.periods, date, today, typicalBleed(data), new Date().toISOString());
      if (unchanged(data.periods, next)) return { ok: false, reason: "not-logged", date };

      await persist(next, data.settings.backupOn);
      return { ok: true, kind: "ended", date, already: false };
    });

    if (result.ok) await announce(result.date);
    return result;
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Tell the live app, then re-lay the queue. Both are best-effort: the write has
 * already landed, and neither failing is a reason to tell her it didn't.
 *
 * The re-lay runs OUTSIDE the cycle lock (it loads the data itself) and is what
 * cancels the question she just answered.
 */
async function announce(date: string): Promise<void> {
  try {
    emitExternalWrite({ kind: "cycle", date });
  } catch {
    // the bus never throws, but a listener might
  }
  await relayCycleReminders().catch(() => 0);
}

/**
 * "Not yet" / "Still going" — acknowledged, nothing written. Exists as a named
 * function so the pipeline's two paths read the same and the reason this writes
 * nothing is documented once, at the top of this file.
 *
 * Returns the day the question was about, for the receipt.
 */
export function declineCycleQuestion(firedAt?: number): { date: string } {
  return { date: dateFor(firedAt, todayDate()) };
}
