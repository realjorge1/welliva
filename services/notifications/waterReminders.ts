/**
 * services/notifications/waterReminders.ts
 *
 * TAP-TO-LOG WATER — the times the user chose to be asked about a glass, and
 * the reminders that serve them.
 *
 * Water is the most natural thing in the app to log from a lock screen: it is a
 * fact ("I drank a glass"), it happens several times a day, and opening an app
 * to add 250 ml is exactly the kind of friction that makes people stop counting.
 * So each reminder carries a button that NAMES the amount it adds ("Drank a
 * glass · 250 ml") and records it without the app opening
 * (services/notifications/waterActions).
 *
 * ── REPEATING TRIGGERS, UNLIKE MEALS ────────────────────────────────────────
 * Meal reminders are a rolling week of dated notifications because each one
 * names a different planned meal. A water reminder has nothing day-specific to
 * say, so a DAILY trigger per time is the honest shape — and it matters for the
 * budget: iOS keeps at most 64 pending notifications and silently drops the
 * rest. Six daily triggers cost six slots; a rolling week would cost forty-two
 * and crowd out the user's habits. Copy still varies by the time of day.
 *
 * ── THE RULES, SAME AS MEALS ────────────────────────────────────────────────
 *   · The app never picks a time. Everything starts off.
 *   · The OS queue is a projection of the stored settings, rebuilt from scratch
 *     on every change (a converging REPLACE), cancelling only its own ids.
 */
import * as Notifications from "expo-notifications";
import { readJSON, writeJSON } from "../OfflineStorage";
import {
  DEFAULT_GLASS_ML,
  WATER_REMINDER_CATEGORY,
  setWaterGlassMl,
} from "./categories";
import { REMINDERS_CHANNEL_ID, ensureRemindersChannel } from "./init";
import { ownerStamp } from "./owner";

const SETTINGS_KEY = "@welliva_water_reminders";
/** Ids we scheduled, so a re-sync cancels exactly its own. Device-local. */
export const WATER_REMINDER_IDS_KEY = "@welliva_water_reminder_ids";

/** The glass sizes offered. A choice, not a free field — see the screen. */
export const GLASS_SIZES: readonly number[] = [200, 250, 330, 500];

/** The times a reminder can be set to — spread across a waking day. */
export const WATER_TIMES: readonly { hour: number; minute: number }[] = [
  { hour: 8, minute: 0 },
  { hour: 10, minute: 0 },
  { hour: 12, minute: 0 },
  { hour: 14, minute: 0 },
  { hour: 16, minute: 0 },
  { hour: 18, minute: 0 },
  { hour: 20, minute: 0 },
];

/** More than this and it stops being a reminder and becomes a nag. */
export const MAX_WATER_TIMES = 6;

export interface WaterReminderSettings {
  /** The master switch. Off means nothing is scheduled. */
  enabled: boolean;
  /** Minutes after midnight, ascending, de-duplicated. */
  times: number[];
  /** What one tap of the button adds. */
  glassMl: number;
}

export const DEFAULT_WATER_SETTINGS: WaterReminderSettings = {
  enabled: false,
  times: [],
  glassMl: DEFAULT_GLASS_ML,
};

export function toMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

export function fromMinutes(m: number): { hour: number; minute: number } {
  return { hour: Math.floor(m / 60), minute: m % 60 };
}

function normalize(s: Partial<WaterReminderSettings> | null | undefined): WaterReminderSettings {
  const times = Array.isArray(s?.times)
    ? [...new Set(s!.times.filter((m) => Number.isInteger(m) && m >= 0 && m < 1440))]
        .sort((a, b) => a - b)
        .slice(0, MAX_WATER_TIMES)
    : [];
  const glass =
    typeof s?.glassMl === "number" && GLASS_SIZES.includes(s.glassMl)
      ? s.glassMl
      : DEFAULT_GLASS_ML;
  return { enabled: !!s?.enabled, times, glassMl: glass };
}

export async function loadWaterReminders(): Promise<WaterReminderSettings> {
  return normalize(await readJSON<Partial<WaterReminderSettings>>(SETTINGS_KEY, {}));
}

export async function saveWaterReminders(s: WaterReminderSettings): Promise<void> {
  await writeJSON(SETTINGS_KEY, normalize(s));
}

/** Is any water reminder actually going to fire? */
export function waterRemindersOn(s: WaterReminderSettings): boolean {
  return s.enabled && s.times.length > 0;
}

// ── copy ────────────────────────────────────────────────────────────

/**
 * Title + body for a reminder at `minutes`. Register: an offer, never an order,
 * and never a count of what the user hasn't done — a reminder that scolds is a
 * reminder that gets turned off.
 */
export function waterCopy(minutes: number, glassMl: number): { title: string; body: string } {
  const hour = Math.floor(minutes / 60);
  if (hour < 10)
    return { title: "Morning glass", body: `Start the day with ${glassMl} ml — one tap logs it.` };
  if (hour < 13)
    return { title: "Water break", body: `A glass before lunch? Tap once and it's counted.` };
  if (hour < 16)
    return { title: "Afternoon top-up", body: `The afternoon dip is often thirst. ${glassMl} ml, one tap.` };
  if (hour < 19)
    return { title: "Hydration check", body: `Had a glass lately? Log it from right here.` };
  return { title: "Evening glass", body: `One more before the day winds down — tap and it's in.` };
}

// ── scheduling ──────────────────────────────────────────────────────

async function cancelOurs(): Promise<void> {
  const ids = await readJSON<string[]>(WATER_REMINDER_IDS_KEY, []);
  for (const id of Array.isArray(ids) ? ids : []) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
  await writeJSON(WATER_REMINDER_IDS_KEY, []);
}

/**
 * Bring the OS queue in line with the settings. Safe to call on every app open
 * and every change. Returns how many reminders are now pending.
 */
export async function syncWaterReminders(settings?: WaterReminderSettings): Promise<number> {
  try {
    const config = settings ? normalize(settings) : await loadWaterReminders();
    await cancelOurs();
    if (!waterRemindersOn(config)) return 0;

    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) return 0;

    await ensureRemindersChannel();
    // The button names the glass — point it at this one before anything that
    // carries it is scheduled.
    await setWaterGlassMl(config.glassMl);

    const stamp = await ownerStamp();
    const ids: string[] = [];
    for (let i = 0; i < config.times.length; i++) {
      const m = config.times[i];
      const { hour, minute } = fromMinutes(m);
      const { title, body } = waterCopy(m, config.glassMl);
      const id = await Notifications.scheduleNotificationAsync({
        identifier: `welliva.water.${m}`,
        content: {
          title,
          body,
          categoryIdentifier: WATER_REMINDER_CATEGORY,
          data: {
            type: "water-reminder",
            ml: config.glassMl,
            route: "/(tabs)/diet",
            ...stamp,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          channelId: REMINDERS_CHANNEL_ID,
          hour,
          minute,
        },
      });
      ids.push(id);
    }
    await writeJSON(WATER_REMINDER_IDS_KEY, ids);
    return ids.length;
  } catch {
    return 0;
  }
}

/** Cancel everything this module scheduled. */
export async function clearWaterReminders(): Promise<void> {
  await cancelOurs().catch(() => {});
}
