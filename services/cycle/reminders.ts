/**
 * services/cycle/reminders.ts — the cycle's reminders, in the OS queue.
 *
 * Same rules as every other reminder module (services/notifications): the OS
 * queue is a projection of stored state, rebuilt with a converging REPLACE that
 * cancels only this module's own ids; every notification carries the owner
 * stamp, so a phone that changes hands never acts on someone else's reminder;
 * and a tap opens the cycle screen through the pipeline's `data.route`.
 *
 * TWO OF THE THREE CARRY BUTTONS. The check-in and the "has it ended?" question
 * each wear their own category (services/notifications/categories), so the
 * answer can be given from the lock screen and written without the app
 * (services/notifications/cycleActions). The heads-up deliberately has none:
 * "your period is likely in a few days" is information, not a question, and a
 * button under it would have to invent something to record.
 *
 * `relayCycleReminders` needs nothing from React — it reads storage, derives
 * the view and lays the plan — so the foreground re-lay
 * (components/notifications/ReminderSyncRunner) can keep the queue honest even
 * when the cycle screen hasn't been opened in weeks.
 */

import * as Notifications from "expo-notifications";
import type { UserBio } from "../../models/user";
import {
  CYCLE_ENDED_CATEGORY,
  CYCLE_REMINDER_CATEGORY,
  ensureNotificationCategories,
} from "../notifications/categories";
import { REMINDERS_CHANNEL_ID, ensureRemindersChannel } from "../notifications/init";
import { ownerStamp } from "../notifications/owner";
import { KEYS, readJSON, todayDate, writeJSON } from "../OfflineStorage";
import { cycleModeOf, predict, todayStatus } from "./predict";
import { planCycleReminders, type CycleReminderKind, type PlannedReminder } from "./reminderPlan";
import { loadCycleData } from "./store";

/** Ids this module scheduled on THIS phone. Device-local in syncKeys. */
export const CYCLE_REMINDER_IDS_KEY = "@welliva_cycle_reminder_ids";

async function cancelOurs(): Promise<void> {
  const raw = await readJSON<string[]>(CYCLE_REMINDER_IDS_KEY, []);
  const ids = Array.isArray(raw) ? raw : [];
  // Nothing laid, nothing to do — and no key written for the many people who
  // never track a cycle.
  if (!ids.length) return;
  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
  await writeJSON(CYCLE_REMINDER_IDS_KEY, []);
}

/**
 * The category a kind wears, and therefore the buttons it arrives with. The
 * heads-up has none — see the header.
 */
function categoryFor(kind: CycleReminderKind): string | undefined {
  if (kind === "checkin") return CYCLE_REMINDER_CATEGORY;
  if (kind === "ended") return CYCLE_ENDED_CATEGORY;
  return undefined;
}

/** Bring the OS queue in line with `plan`. Returns how many are pending. Never throws. */
export async function syncCycleReminders(plan: readonly PlannedReminder[]): Promise<number> {
  try {
    await cancelOurs();
    if (!plan.length) return 0;
    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) return 0;
    await ensureRemindersChannel();
    // A category must be registered with the OS BEFORE a notification carrying
    // it is delivered, or it arrives with no buttons at all.
    await ensureNotificationCategories();
    const stamp = await ownerStamp();
    const ids: string[] = [];
    for (const r of plan) {
      const id = await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: {
          title: r.title,
          body: r.body,
          categoryIdentifier: categoryFor(r.kind),
          data: { type: "cycle-reminder", kind: r.kind, route: "/cycle", ...stamp },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: r.at,
          channelId: REMINDERS_CHANNEL_ID,
        },
      });
      ids.push(id);
    }
    await writeJSON(CYCLE_REMINDER_IDS_KEY, ids);
    return ids.length;
  } catch {
    return 0;
  }
}

/** Everything this module scheduled, gone. */
export async function clearCycleReminders(): Promise<void> {
  await cancelOurs().catch(() => {});
}

/**
 * Re-derive the plan from storage and lay it. For the headless foreground
 * re-lay, and for a lock-screen answer that has just changed the log
 * (services/notifications/cycleActions).
 *
 * IT CALLS `predict` AND `todayStatus`, NOT `computeView`. The plan needs two
 * things — where she is and when the next period is likely — and `computeView`
 * would also compute her doctor notes, her symptom-timing patterns and her iron
 * picks, the last of which drags the whole canonical-food database into the
 * Android headless task's module graph. Nothing is lost: the view builds its own
 * `status` and `prediction` from exactly these two calls.
 */
export async function relayCycleReminders(): Promise<number> {
  try {
    const data = await loadCycleData();
    if (!data.settings.enabled) {
      await clearCycleReminders();
      return 0;
    }
    const bio = await readJSON<Partial<UserBio> | null>(KEYS.USER_BIO, null);
    const input = {
      episodes: data.periods,
      days: data.days,
      settings: data.settings,
      today: todayDate(),
      profile: { age: bio?.age ?? null, conditions: bio?.medicalConditions ?? [] },
    };
    const prediction = cycleModeOf(input.profile.conditions) === "pregnancy" ? null : predict(input);
    return await syncCycleReminders(
      planCycleReminders({
        settings: data.settings,
        status: todayStatus(input, prediction),
        prediction,
        now: new Date(),
      }),
    );
  } catch {
    return 0;
  }
}
