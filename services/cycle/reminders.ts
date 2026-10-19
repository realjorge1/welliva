/**
 * services/cycle/reminders.ts — the cycle's reminders, in the OS queue.
 *
 * Same rules as every other reminder module (services/notifications): the OS
 * queue is a projection of stored state, rebuilt with a converging REPLACE that
 * cancels only this module's own ids; every notification carries the owner
 * stamp, so a phone that changes hands never acts on someone else's reminder;
 * and a tap opens the cycle screen through the pipeline's `data.route`.
 *
 * `relayCycleReminders` needs nothing from React — it reads storage, derives
 * the view and lays the plan — so the foreground re-lay
 * (components/notifications/ReminderSyncRunner) can keep the queue honest even
 * when the cycle screen hasn't been opened in weeks.
 */

import * as Notifications from "expo-notifications";
import type { UserBio } from "../../models/user";
import { REMINDERS_CHANNEL_ID, ensureRemindersChannel } from "../notifications/init";
import { ownerStamp } from "../notifications/owner";
import { KEYS, readJSON, todayDate, writeJSON } from "../OfflineStorage";
import { planCycleReminders, type PlannedReminder } from "./reminderPlan";
import { loadCycleData } from "./store";
import { computeView } from "./view";

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

/** Bring the OS queue in line with `plan`. Returns how many are pending. Never throws. */
export async function syncCycleReminders(plan: readonly PlannedReminder[]): Promise<number> {
  try {
    await cancelOurs();
    if (!plan.length) return 0;
    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) return 0;
    await ensureRemindersChannel();
    const stamp = await ownerStamp();
    const ids: string[] = [];
    for (const r of plan) {
      const id = await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: {
          title: r.title,
          body: r.body,
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

/** Re-derive the plan from storage and lay it. For the headless foreground re-lay. */
export async function relayCycleReminders(): Promise<number> {
  try {
    const data = await loadCycleData();
    if (!data.settings.enabled) {
      await clearCycleReminders();
      return 0;
    }
    const bio = await readJSON<Partial<UserBio> | null>(KEYS.USER_BIO, null);
    const view = computeView(data, {
      today: todayDate(),
      profile: { age: bio?.age ?? null, conditions: bio?.medicalConditions ?? [] },
    });
    return await syncCycleReminders(
      planCycleReminders({
        settings: data.settings,
        status: view.status,
        prediction: view.prediction,
        now: new Date(),
      }),
    );
  } catch {
    return 0;
  }
}
