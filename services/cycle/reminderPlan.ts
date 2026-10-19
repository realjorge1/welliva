/**
 * services/cycle/reminderPlan.ts — which cycle reminders should be pending.
 *
 * Pure, so the copy and the timing are testable without a phone. The scheduler
 * (./reminders) turns this into OS notifications.
 *
 * At most three, all one-off and dated:
 *   heads-up   09:00, two days before the predicted window opens
 *   check-in   09:00, the day after the most likely start, if nothing's logged
 *   ended?     19:00, the day after her period would usually end, while one
 *              is still open
 * Re-planned after every change, so a period logged today cancels the check-in.
 *
 * DISCREET BY DEFAULT. A lock screen is the most public surface a phone has, so
 * unless she turns discreet wording off, no reminder names her period: it says
 * there's something to check, and the app says what.
 */

import { addDays, formatRange } from "./dates";
import type { CycleToday, Prediction } from "./predict";
import type { CycleSettings } from "./types";

export type CycleReminderKind = "headsup" | "checkin" | "ended";

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
): { title: string; body: string } {
  if (discreet) {
    if (kind === "headsup") {
      return { title: "A gentle heads-up", body: "Something to plan around in the next few days. Tap to see." };
    }
    return { title: "Quick check-in", body: "Tap to update your log. It takes a second." };
  }
  switch (kind) {
    case "headsup":
      return {
        title: "Period likely soon",
        body: prediction
          ? `Likely ${formatRange(prediction.earliest, prediction.latest)}. Worth having what you need with you.`
          : "It's likely in the next few days.",
      };
    case "checkin":
      return { title: "Has your period started?", body: "One tap logs it, and your predictions re-tune." };
    case "ended":
      return { title: "Has your period ended?", body: "Tap to log the last day." };
  }
}

export function planCycleReminders(input: {
  settings: CycleSettings;
  status: CycleToday;
  prediction: Prediction | null;
  now: Date;
}): PlannedReminder[] {
  const { settings, status, prediction, now } = input;
  if (!settings.enabled || !settings.remindersOn) return [];
  if (status.mode === "pregnancy" || status.mode === "menopause") return [];

  const out: PlannedReminder[] = [];
  const push = (kind: CycleReminderKind, at: Date) => {
    if (at.getTime() <= now.getTime()) return;
    out.push({ id: CYCLE_REMINDER_ID(kind), kind, at, ...reminderCopy(kind, settings.discreet, prediction) });
  };

  if (status.predicting && prediction && !status.inPeriod) {
    push("headsup", atLocal(addDays(prediction.earliest, -2), 9));
    push("checkin", atLocal(addDays(prediction.likely, 1), 9));
  }
  if (status.inPeriod && status.periodOpen && !status.periodStale && status.expectedEnd) {
    push("ended", atLocal(addDays(status.expectedEnd, 1), 19));
  }
  return out;
}
