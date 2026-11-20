/**
 * services/cycle/reminderPlan.ts — which cycle reminders should be pending.
 *
 * Pure, so the copy and the timing are testable without a phone. The scheduler
 * (./reminders) turns this into OS notifications.
 *
 * At most three, all one-off and dated:
 *   heads-up   09:00, two days before the predicted window opens
 *   check-in   09:00, the day after the most likely start, if nothing's logged
 *   trip       09:00, two days before a trip a predicted period is likely to
 *              meet (./upcoming) — and it replaces a heads-up due the same morning
 *   ended?     19:00, the day after her period would usually end, while one
 *              is still open
 * Re-planned after every change, so a period logged today cancels the check-in.
 * (The heads-up and the check-in need her not to be bleeding and "ended?" needs
 * her to be, so three is the most that can ever be pending at once.)
 *
 * THE TRIP REMINDER NEVER NAMES THE PERIOD, with discreet wording on or off
 * (owner's decision): it says there's something to plan around, and the app says
 * what. It carries no buttons, because it asks nothing.
 *
 * DISCREET BY DEFAULT. A lock screen is the most public surface a phone has, so
 * unless she turns discreet wording off, no reminder names her period: it says
 * there's something to check, and the app says what.
 *
 * THE TWO QUESTIONS CAN BE ANSWERED WHERE THEY'RE ASKED. The check-in and the
 * "ended?" reminder carry lock-screen buttons (services/notifications/categories
 * registers them; ./reminders attaches them), so the copy below says "answer
 * below" rather than "tap to open your log" — a body that sends her into the app
 * past two buttons that would have done it is the reminder lying about itself.
 * The button words hold the discretion rule too: "Started today" and "Not yet"
 * name nothing.
 */

import { addDays, formatRange } from "./dates";
import type { PillForecast } from "./pill";
import { givenWindow, type CycleToday, type Prediction } from "./predict";
import type { CycleSettings } from "./types";
import { nextTripOverlap, TRIP_REMINDER_DAYS, type LifeMoment } from "./upcoming";

export type CycleReminderKind = "headsup" | "checkin" | "ended" | "trip";

export interface PlannedReminder {
  id: string;
  kind: CycleReminderKind;
  /** Local fire time. */
  at: Date;
  title: string;
  body: string;
}

export const CYCLE_REMINDER_ID = (kind: CycleReminderKind) => `welliva.cycle.${kind}`;

/** A local Date for a calendar day at an hour. */
export function atLocal(iso: string, hour: number): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hour, 0, 0, 0);
}

export function reminderCopy(
  kind: CycleReminderKind,
  discreet: boolean,
  prediction: Prediction | null,
  /** On the combined pill the check-in asks about a bleed, never a period (./pill). */
  bleed = false,
): { title: string; body: string } {
  if (bleed && !discreet && kind === "checkin") {
    return { title: "Has your bleed started?", body: "Answer below to log it. No need to open the app." };
  }
  if (kind === "trip") {
    return { title: "A heads-up for your trip", body: "Something to plan around. Open welliva to see." };
  }
  if (discreet) {
    if (kind === "headsup") {
      return { title: "A gentle heads-up", body: "Something to plan around in the next few days. Tap to see." };
    }
    // Deliberately says nothing about WHAT started or ended — the buttons do
    // the same. Either answer lands without the app opening.
    return { title: "Quick check-in", body: "Answer below, or tap to open your log." };
  }
  switch (kind) {
    case "headsup":
      return {
        title: "Period likely soon",
        body: prediction
          ? `Likely ${formatRange(givenWindow(prediction).earliest, givenWindow(prediction).latest)}. Worth having what you need with you.`
          : "It's likely in the next few days.",
      };
    case "checkin":
      return {
        title: "Has your period started?",
        body: "Answer below and your predictions re-tune. No need to open the app.",
      };
    case "ended":
      return { title: "Has your period ended?", body: "Answer below to log the last day." };
  }
}

export function planCycleReminders(input: {
  settings: CycleSettings;
  status: CycleToday;
  prediction: Prediction | null;
  now: Date;
  /** Her trips and events (./lifeMoments). Absent: no trip reminder. */
  moments?: readonly LifeMoment[];
  /** On the combined pill: the bleed her pack schedule expects (./pill). */
  pill?: PillForecast | null;
}): PlannedReminder[] {
  const { settings, status, prediction, now } = input;
  if (!settings.enabled || !settings.remindersOn) return [];

  const out: PlannedReminder[] = [];
  const push = (kind: CycleReminderKind, at: Date, bleed = false) => {
    if (at.getTime() <= now.getTime()) return;
    out.push({ id: CYCLE_REMINDER_ID(kind), kind, at, ...reminderCopy(kind, settings.discreet, prediction, bleed) });
  };

  // The combined pill: only the one "has it started?", once, the morning after
  // the pack's window — no heads-up, no trip, no "has it ended?" (./pill).
  if (status.mode === "hormonal") {
    const pill = input.pill;
    if (pill && !pill.missed && !status.inPeriod) push("checkin", atLocal(addDays(pill.latest, 1), 9), true);
    return out;
  }
  // The other logging-only modes have nothing to remind about: no likely day to
  // check in after, and no usual length to ask "has it ended?" against.
  if (status.mode === "pregnancy" || status.mode === "menopause") return [];

  const trip = nextTripOverlap({ prediction, status, moments: input.moments ?? [] });
  const tripDay = trip ? addDays(trip.start, -TRIP_REMINDER_DAYS) : null;

  if (status.predicting && prediction && !status.inPeriod) {
    // Against the window she was GIVEN (./predict givenWindow): once she is
    // late the forecast rolls forward every day, and a check-in timed off it
    // would be laid again each morning, a day later, and never fire. Timed off
    // the given window, the one check-in has already had its morning.
    const given = givenWindow(prediction);
    // Two cycle reminders on one morning is one too many; the trip's is the specific one.
    const headsUpDay = addDays(given.earliest, -2);
    if (headsUpDay !== tripDay) push("headsup", atLocal(headsUpDay, 9));
    push("checkin", atLocal(addDays(given.likely, 1), 9));
  }
  if (status.inPeriod && status.periodOpen && !status.periodStale && status.expectedEnd) {
    push("ended", atLocal(addDays(status.expectedEnd, 1), 19));
  }
  if (tripDay) push("trip", atLocal(tripDay, 9));
  return out;
}
