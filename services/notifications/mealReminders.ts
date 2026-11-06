/**
 * services/notifications/mealReminders.ts
 *
 * TAP-TO-LOG MEAL REMINDERS — the times the user chose, and the rolling window
 * of notifications that serve them.
 *
 * ── THE ROLLING WINDOW, AND WHY IT ISN'T A REPEATING TRIGGER ────────────────
 * A DAILY trigger is one line of code and would have been wrong. Its content is
 * baked at schedule time and shown forever, so every lunch reminder for the
 * rest of the user's life would read the same sentence about the same unnamed
 * meal. Three of those a day is how an app teaches someone to swipe it away
 * without reading it.
 *
 * So each reminder is its own DATED notification, scheduled a week ahead and
 * topped up every time the app opens. That buys two things a repeating trigger
 * cannot:
 *
 *   · different copy every day (services/notifications/copy)
 *   · the meal's REAL NAME in the body, once the plan for that date exists —
 *     "Grilled chicken salad — had it?" is answerable from a locked screen in a
 *     way that "Lunch — had it?" is not
 *
 * ── THE BUDGET ──────────────────────────────────────────────────────────────
 * iOS keeps at most 64 pending local notifications and silently drops the rest,
 * and habit reminders are drawing on the same pool. {@link HORIZON_DAYS} × four
 * slots is the ceiling this module will ever ask for, and it is deliberately
 * well under half the budget. A week is also about as far ahead as a meal plan
 * is worth reminding someone of.
 *
 * ── WHAT THIS WILL NOT DO ───────────────────────────────────────────────────
 * Schedule anything for a workout. The user picks the times, the app never
 * invents one, and a session cannot be logged from a button — see
 * ./mealActions for why.
 */
import * as Notifications from "expo-notifications";
import type { DaySchedule, MealType, ScheduledDiet } from "../../models/diet";
import { KEYS, readJSON, toLocalDateString, writeJSON } from "../OfflineStorage";
import type { IntakeLedger } from "../nutrition/IntakeLedger";
import type { LogStore } from "../nutrition/foodLogStore";
import { findUsuals, snapshotOf, usualReminderBody, type Usual } from "../smart/usual";
import { loadForgottenUsuals } from "../smart/usualStore";
import {
  MEAL_REMINDER_CATEGORY,
  MEAL_USUAL_CATEGORY,
  ensureNotificationCategories,
} from "./categories";
import { mealBody, mealOpenBody, mealTitle, type MealSlotKey } from "./copy";
import { REMINDERS_CHANNEL_ID, ensureRemindersChannel } from "./init";
import { ownerStamp } from "./owner";
import { notificationsPaused, quietDate } from "./pause";

const SETTINGS_KEY = "@welliva_meal_reminders";
/**
 * Ids we scheduled, so a re-sync can cancel exactly its own and nothing else.
 * Exported so a test can clear it by name rather than restating the string —
 * a storage key written twice is a storage key that eventually differs.
 */
export const MEAL_REMINDER_IDS_KEY = "@welliva_meal_reminder_ids";

/** How many days ahead the window reaches. See "the budget" above. */
export const HORIZON_DAYS = 7;

/** The slots a reminder can be set for. Snack is one slot, as everywhere. */
export const MEAL_SLOTS: readonly MealSlotKey[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

export const SLOT_LABEL: Record<MealSlotKey, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/** One slot's reminder: whether it is on, and the local time it fires. */
export interface MealReminder {
  enabled: boolean;
  /** 0–23, local. */
  hour: number;
  /** 0–59, local. */
  minute: number;
}

export interface MealReminderSettings {
  /** The master switch. Off means nothing is scheduled, whatever the slots say. */
  enabled: boolean;
  slots: Record<MealSlotKey, MealReminder>;
}

/**
 * The times a reminder STARTS AT, before the user changes them.
 *
 * These are defaults for a control the user is looking at, not a schedule the
 * app imposes: nothing is scheduled until they turn a slot on. They sit inside
 * the app's existing eating windows (components/navigation/nextMove) so a
 * reminder never asks about a meal the rest of the app does not think is due.
 */
export const DEFAULT_SETTINGS: MealReminderSettings = {
  enabled: false,
  slots: {
    breakfast: { enabled: false, hour: 8, minute: 30 },
    lunch: { enabled: false, hour: 13, minute: 0 },
    dinner: { enabled: false, hour: 19, minute: 30 },
    snack: { enabled: false, hour: 16, minute: 0 },
  },
};

// ── Storage ─────────────────────────────────────────────────────────

/** Merged against the defaults, so a stored blob from an older build still loads. */
export async function loadMealReminders(): Promise<MealReminderSettings> {
  const stored = await readJSON<Partial<MealReminderSettings>>(SETTINGS_KEY, {});
  const slots = { ...DEFAULT_SETTINGS.slots };
  for (const slot of MEAL_SLOTS) {
    const s = stored.slots?.[slot];
    if (s && typeof s.hour === "number" && typeof s.minute === "number") {
      slots[slot] = {
        enabled: !!s.enabled,
        hour: clamp(s.hour, 0, 23),
        minute: clamp(s.minute, 0, 59),
      };
    }
  }
  return { enabled: !!stored.enabled, slots };
}

export async function saveMealReminders(
  settings: MealReminderSettings,
): Promise<void> {
  await writeJSON(SETTINGS_KEY, settings);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/** Is any reminder actually going to fire? */
export function anyEnabled(settings: MealReminderSettings): boolean {
  return settings.enabled && MEAL_SLOTS.some((s) => settings.slots[s].enabled);
}

/** "8:30 AM" — the time, as the row shows it. */
export function formatTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

// ── Scheduling ──────────────────────────────────────────────────────

/** What one scheduled reminder needs to know about itself. */
interface Planned {
  slot: MealSlotKey;
  date: string;
  when: Date;
}

/**
 * Every reminder that should exist right now, for the next {@link HORIZON_DAYS}.
 *
 * Pure — no storage, no notifications — so the window logic is testable on its
 * own. Times already past today are skipped: scheduling a 1pm reminder at 3pm
 * either fires immediately or is rejected, and both are worse than nothing.
 */
export function plannedReminders(
  settings: MealReminderSettings,
  now: Date,
): Planned[] {
  if (!anyEnabled(settings)) return [];

  const out: Planned[] = [];
  for (let day = 0; day < HORIZON_DAYS; day++) {
    const base = new Date(now);
    base.setDate(base.getDate() + day);
    const date = toLocalDateString(base);

    for (const slot of MEAL_SLOTS) {
      const r = settings.slots[slot];
      if (!r.enabled) continue;
      const when = new Date(base);
      when.setHours(r.hour, r.minute, 0, 0);
      if (when.getTime() <= now.getTime()) continue;
      out.push({ slot, date, when });
    }
  }
  return out;
}

/**
 * Re-scheduling is a REPLACE, not an append.
 *
 * The ids we wrote last time are stored and cancelled first. Cancelling by
 * stored id rather than calling `cancelAllScheduledNotificationsAsync` is what
 * keeps this module from wiping every habit reminder in the app every time the
 * user opens it — they live in the same OS queue and there is no way to ask for
 * "mine" back out of it.
 */
async function cancelOurs(): Promise<void> {
  const ids = await readJSON<string[]>(MEAL_REMINDER_IDS_KEY, []);
  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
  await writeJSON(MEAL_REMINDER_IDS_KEY, []);
}

/**
 * Bring the OS queue in line with the user's settings.
 *
 * Safe to call on every app open and on every settings change — it cancels its
 * own previous window and lays down a fresh one, so it converges rather than
 * accumulating. Fail-soft throughout: no permission, no native module or a
 * thrown schedule all mean "no reminders", never a crash.
 *
 * Returns how many were actually scheduled, which the settings screen shows so
 * the user can see that the thing they just switched on is real.
 */
export async function syncMealReminders(
  settings?: MealReminderSettings,
  now: Date = new Date(),
): Promise<number> {
  try {
    const config = settings ?? (await loadMealReminders());
    await cancelOurs();
    if (!anyEnabled(config)) return 0;
    if (await notificationsPaused()) return 0;

    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) return 0;

    await ensureRemindersChannel();
    await ensureNotificationCategories();

    // The whole week's plan, read ONCE. This runs on every app open, and
    // `getScheduledDietForDate` re-reads and re-parses the entire scheduled-diets
    // blob per call — twenty-eight of those on a cold start is a measurable
    // stall for a lookup that is the same document every time.
    const plans = await scheduleIndex();
    const foodLog = await foodLogIndex();
    const usuals = await usualIndex(now);
    // A rough day silences the rest of TODAY only (./pause `quietDate`).
    const quiet = await quietDate(now);

    const stamp = await ownerStamp();
    const ids: string[] = [];
    for (const plan of plannedReminders(config, now)) {
      if (quiet && plan.date === quiet) continue;
      // ALREADY EATEN, SO DON'T ASK. "Lunch — had it?" twenty minutes after
      // lunch was ticked is the reminder that teaches people to swipe these
      // away unread. Ticking a meal (or logging one under that slot) re-lays
      // this window (components/notifications/ReminderSyncRunner), so today's
      // reminder for it disappears from the queue.
      if (alreadyEaten(plans.get(plan.date), foodLog, plan.date, plan.slot)) continue;
      // The meal's real name, when the plan for that day already exists. A
      // reminder six days out usually has nothing to read; the next top-up
      // fills it in once the day is generated.
      const name = mealNameIn(plans.get(plan.date), plan.slot);
      // Someone who logs this meal freely, the same foods most days, is asked
      // about THAT: "Your usual? Oats with milk, coffee" — and "Had my usual"
      // logs it exactly as last time. The usual's entries ride in the data, so
      // the button never has to look a food up (services/notifications/usualActions).
      const usual = usuals.get(plan.slot);
      // THE BUTTON ONLY WHEN THERE IS SOMETHING TO TICK. "Ate it" records the
      // meal planned in that slot; on a day with no planned meal it could only
      // fail. So an unplanned day gets the honest version — no button, and a
      // tap that opens the food log to record what was actually eaten. If the
      // plan appears before the reminder fires, the next top-up (every app
      // open) upgrades it to the named, one-tap version.
      const id = await Notifications.scheduleNotificationAsync({
        // Deterministic: re-laying the window replaces rather than duplicates,
        // even if the stored id list was lost.
        identifier: `welliva.meal.${plan.date}.${plan.slot}`,
        content: usual
          ? {
              title: mealTitle(plan.slot, plan.date),
              body: usualReminderBody(usual),
              categoryIdentifier: MEAL_USUAL_CATEGORY,
              data: {
                type: "meal-reminder",
                slot: plan.slot,
                date: plan.date,
                route: "/(tabs)/diet",
                usual: snapshotOf(usual, now),
                ...stamp,
              },
            }
          : name
          ? {
              title: mealTitle(plan.slot, plan.date),
              body: mealBody(plan.slot, plan.date, name),
              categoryIdentifier: MEAL_REMINDER_CATEGORY,
              data: {
                type: "meal-reminder",
                slot: plan.slot,
                date: plan.date,
                route: "/(tabs)/diet",
                ...stamp,
              },
            }
          : {
              title: mealTitle(plan.slot, plan.date),
              body: mealOpenBody(plan.slot, plan.date),
              data: {
                type: "meal-reminder",
                slot: plan.slot,
                date: plan.date,
                route: "/diet/log-food",
                ...stamp,
              },
            },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          channelId: REMINDERS_CHANNEL_ID,
          date: plan.when,
        },
      });
      ids.push(id);
    }

    await writeJSON(MEAL_REMINDER_IDS_KEY, ids);
    return ids.length;
  } catch {
    return 0;
  }
}

/** Every scheduled day, indexed by date. Read-only; never writes. */
async function scheduleIndex(): Promise<Map<string, DaySchedule>> {
  try {
    const diets = await readJSON<ScheduledDiet[]>(KEYS.SCHEDULED_DIETS, []);
    const index = new Map<string, DaySchedule>();
    for (const d of diets) if (d?.date && d.schedule) index.set(d.date, d.schedule);
    return index;
  } catch {
    return new Map();
  }
}

/**
 * Each meal's USUAL, when it has one (services/smart/usual) — someone who logs
 * that meal freely, the same foods most days. Read once per sync, from the same
 * food log. Empty on any failure: the reminder then falls back to the plain one.
 */
async function usualIndex(now: Date): Promise<Map<MealSlotKey, Usual>> {
  try {
    const [foodLog, intake, forgotten] = await Promise.all([
      readJSON<LogStore>(KEYS.FOOD_LOG, {}),
      readJSON<IntakeLedger>(KEYS.INTAKE_LEDGER, {}),
      loadForgottenUsuals(),
    ]);
    const index = new Map<MealSlotKey, Usual>();
    for (const u of findUsuals({ foodLog, intake, forgotten, today: toLocalDateString(now) })) {
      index.set(u.slot, u);
    }
    return index;
  } catch {
    return new Map();
  }
}

/** Free-form food-log entries by date — only the slot each was logged under. */
type FoodLogSlots = Record<string, { slot?: string | null }[]>;

/** The food log, read once per sync. Read-only; never writes. */
async function foodLogIndex(): Promise<FoodLogSlots> {
  try {
    const store = await readJSON<FoodLogSlots>(KEYS.FOOD_LOG, {});
    return store && typeof store === "object" ? store : {};
  } catch {
    return {};
  }
}

/**
 * Has this slot's meal already been eaten on that day? Either the planned meal
 * is ticked, or the user logged something from the food log under that slot.
 * For snacks, any snack counts — there is one snack reminder, not one per snack.
 */
export function alreadyEaten(
  schedule: DaySchedule | undefined,
  foodLog: FoodLogSlots,
  date: string,
  slot: MealSlotKey,
): boolean {
  if (schedule) {
    const ticked =
      slot === "snack"
        ? (schedule.snacks ?? []).some((s) => s?.isConsumed)
        : !!schedule[slot as Exclude<MealType, "snack">]?.isConsumed;
    if (ticked) return true;
  }
  const logged = foodLog[date];
  return Array.isArray(logged) && logged.some((e) => e?.slot === slot);
}

/** The scheduled meal's name for a slot, or null if there isn't one yet. */
function mealNameIn(
  schedule: DaySchedule | undefined,
  slot: MealSlotKey,
): string | null {
  if (!schedule) return null;
  const meal =
    slot === "snack"
      ? schedule.snacks?.[0]
      : (schedule[slot as Exclude<MealType, "snack">] ?? null);
  return meal?.name ?? null;
}

/** Cancel everything this module scheduled. Used when the master switch goes off. */
export async function clearMealReminders(): Promise<void> {
  await cancelOurs().catch(() => {});
}
