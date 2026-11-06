/**
 * services/notifications/waterReminders.ts
 *
 * TAP-TO-LOG WATER — the times the user chose to be asked about a glass, and
 * the check-ins that serve them.
 *
 * Water is the most natural thing in the app to log from a lock screen: it is a
 * fact ("I drank a glass"), it happens several times a day, and opening an app
 * to add 250 ml is exactly the kind of friction that makes people stop counting.
 * So each check-in carries a button that NAMES the amount it adds ("Drank a
 * glass · 250 ml") and records it without the app opening
 * (services/notifications/waterActions).
 *
 * ── A CHECK-IN THAT KNOWS WHAT YOU'VE DONE ──────────────────────────────────
 * These used to be repeating DAILY triggers: the same sentence at the same time
 * whether you had just logged a glass or hit your goal an hour ago. Six of those
 * a day is how a hydration reminder becomes the notification people mute. Now
 * each one is a DATED notification, re-laid every time water is logged (in the
 * app, or from this very button) and on every app open, so today's are written
 * from what actually happened:
 *
 *   · A glass logged in the last {@link QUIET_AFTER_LOG_MINUTES} minutes → the
 *     next check-in inside that window is skipped. You're clearly drinking.
 *   · Today's goal met → nothing more today.
 *   · Otherwise it asks like a person would: "Your last one was at 2:10 PM —
 *     had another since?", and near the goal, "One glass to go".
 *
 * Days ahead can't know any of that yet, so they carry the plain time-of-day
 * line until a log or an app open re-writes them.
 *
 * ── THE WINDOW, AND THE BUDGET ──────────────────────────────────────────────
 * {@link WATER_HORIZON_DAYS} days ahead, never more: iOS keeps at most 64
 * pending notifications (meals and habits draw on the same pool), and six times
 * a day over a week would take forty-two of them. Every press of the button and
 * every app open pushes the window forward, so anyone who answers keeps getting
 * asked; someone who has neither opened the app nor answered one in three days
 * stops hearing about water until they're back — the polite thing.
 *
 * ── THE RULES, SAME AS MEALS ────────────────────────────────────────────────
 *   · The app never picks a time. Everything starts off.
 *   · The OS queue is a projection of the stored settings, rebuilt from scratch
 *     on every change (a converging REPLACE), cancelling only its own ids.
 */
import * as Notifications from "expo-notifications";
import { readJSON, toLocalDateString, writeJSON } from "../OfflineStorage";
import { poursOn } from "../nutrition/waterPours";
import {
  WATER_INBOX_KEY,
  readWaterCounter,
  readWaterPours,
  type WaterInboxEntry,
} from "../nutrition/waterStore";
import {
  DEFAULT_GLASS_ML,
  WATER_REMINDER_CATEGORY,
  setWaterGlassMl,
} from "./categories";
import { REMINDERS_CHANNEL_ID, ensureRemindersChannel } from "./init";
import { formatTime } from "./mealReminders";
import { ownerStamp } from "./owner";
import { notificationsPaused, quietDate } from "./pause";

const SETTINGS_KEY = "@welliva_water_reminders";
/** Ids we scheduled, so a re-sync cancels exactly its own. Device-local. */
export const WATER_REMINDER_IDS_KEY = "@welliva_water_reminder_ids";
/**
 * The water goal the app last knew. The lock-screen path has no React tree and
 * no bio to derive a goal from, and it still has to know whether today's is
 * met. Device-local, regenerable — written by the reminder runner.
 */
export const WATER_GOAL_CACHE_KEY = "@welliva_water_goal_cache";

/** Every id this module lays starts with this — the sweep's handle on orphans. */
const ID_PREFIX = "welliva.water.";

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

/** How many days of check-ins are laid ahead. See "the window" above. */
export const WATER_HORIZON_DAYS = 3;

/** A check-in this soon after a logged glass is skipped. */
export const QUIET_AFTER_LOG_MINUTES = 90;

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

// ── today's water, as the check-ins need it ─────────────────────────

/** What today's check-ins are written from. */
export interface WaterDayState {
  /** Local YYYY-MM-DD these facts are for. */
  date: string;
  /** Logged so far that day. */
  totalMl: number;
  /** The day's goal; 0 when unknown (then no goal-based skip or wording). */
  goalMl: number;
  /** When the most recent glass that day was logged, or null if none was. */
  lastLogAt: Date | null;
}

/** Keep the goal for the lock-screen path. No-op for a nonsense value. */
export async function rememberWaterGoal(ml: number): Promise<void> {
  if (!Number.isFinite(ml) || ml <= 0) return;
  const rounded = Math.round(ml);
  const stored = await readJSON<number>(WATER_GOAL_CACHE_KEY, 0);
  if (stored !== rounded) await writeJSON(WATER_GOAL_CACHE_KEY, rounded);
}

/**
 * Read today's water from storage: the counter (when it is holding today), the
 * glasses still waiting in the inbox for today, and the pour times for "when was
 * the last one". The same sources the app and the lock-screen button write, so
 * it is right whether or not the app has opened today.
 */
export async function readWaterDayState(now: Date = new Date()): Promise<WaterDayState> {
  const date = toLocalDateString(now);
  const [counter, pours, inbox, goal] = await Promise.all([
    readWaterCounter(),
    readWaterPours(),
    readJSON<WaterInboxEntry[]>(WATER_INBOX_KEY, []),
    readJSON<number>(WATER_GOAL_CACHE_KEY, 0),
  ]);

  let totalMl = counter.date === date ? counter.ml : 0;
  let last = -Infinity;
  const consider = (iso: string | undefined) => {
    const t = iso ? Date.parse(iso) : NaN;
    if (Number.isFinite(t) && t <= now.getTime() && t > last) last = t;
  };
  if (counter.date === date) for (const p of poursOn(pours, date)) consider(p.at);
  for (const e of Array.isArray(inbox) ? inbox : []) {
    if (e?.date !== date) continue;
    const ml = Number.isFinite(e.ml) && e.ml > 0 ? e.ml : 0;
    totalMl += ml;
    consider(e.at);
  }

  return {
    date,
    totalMl,
    goalMl: Number.isFinite(goal) && goal > 0 ? goal : 0,
    lastLogAt: Number.isFinite(last) ? new Date(last) : null,
  };
}

// ── copy ────────────────────────────────────────────────────────────

/**
 * Title + body for a check-in on a day whose water isn't known yet (a day
 * ahead). Register: an offer, never an order, and never a count of what the
 * user hasn't done — a reminder that scolds is a reminder that gets turned off.
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

/** Stable 32-bit hash: the same day and time always pick the same wording. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(options: readonly T[], seed: string): T {
  return options[hash(seed) % options.length];
}

/**
 * Title + body for TODAY's check-in, written from what today actually holds.
 *
 * It names the time of the last glass, because that is the question a person
 * would ask ("had another since 2:10?") and the one a user can answer from a
 * locked screen. It never counts what is missing; near the goal it says how
 * close, because "one to go" is the line that gets a glass poured.
 */
export function waterCheckInCopy(input: {
  /** Minutes after midnight the check-in fires. */
  minutes: number;
  date: string;
  glassMl: number;
  /** When it fires. */
  when: Date;
  state: WaterDayState;
}): { title: string; body: string } {
  const { minutes, date, glassMl, when, state } = input;
  const seed = `${date}:${minutes}`;
  const last = state.lastLogAt;

  if (!last) {
    const hour = Math.floor(minutes / 60);
    if (hour < 11)
      return { title: "Morning glass", body: `Start the day with ${glassMl} ml — one tap logs it.` };
    if (hour < 15)
      return { title: "Water break", body: "Had a glass yet today? One tap and it's counted." };
    return { title: "Hydration check", body: "Had some water today? Log a glass right from here." };
  }

  const at = formatTime(last.getHours(), last.getMinutes());
  const remaining = state.goalMl > 0 ? state.goalMl - state.totalMl : null;
  const glassesLeft =
    remaining !== null && remaining > 0 ? Math.ceil(remaining / Math.max(1, glassMl)) : null;

  if (glassesLeft === 1) {
    return {
      title: "One glass to go",
      body: `Your last was at ${at}. Had another since? One tap finishes today's water.`,
    };
  }
  if (glassesLeft === 2) {
    return {
      title: "Nearly there",
      body: `Had another since your ${at} glass? You're two glasses from today's goal.`,
    };
  }

  const gapMinutes = (when.getTime() - last.getTime()) / 60_000;
  if (gapMinutes < 150) {
    return pick(
      [
        { title: "Another glass?", body: `Your last one was at ${at} — had another since? One tap logs it.` },
        { title: "Water check", body: `Had another glass since ${at}? Tap and it's counted.` },
      ],
      seed,
    );
  }
  if (gapMinutes < 300) {
    return pick(
      [
        { title: "Water check", body: `It's been a few hours since your ${at} glass. Had one since?` },
        { title: "Top-up time", body: `Last glass at ${at}. Had another since? One tap logs it.` },
      ],
      seed,
    );
  }
  return pick(
    [
      { title: "Top-up time", body: `Nothing logged since ${at} — had a glass since then? Tap and it's counted.` },
      { title: "Hydration check", body: `Your last glass was at ${at}. Time for another? One tap logs it.` },
    ],
    seed,
  );
}

// ── planning ────────────────────────────────────────────────────────

/** One check-in to lay. */
export interface PlannedWaterCheckIn {
  /** Deterministic OS id — re-laying replaces rather than duplicates. */
  identifier: string;
  /** Local YYYY-MM-DD it is for. */
  date: string;
  /** Minutes after midnight. */
  minutes: number;
  when: Date;
  title: string;
  body: string;
}

/**
 * Every check-in that should be pending right now. PURE — no storage, no
 * notifications — so the skip rules are testable on their own.
 *
 * `state` is today's water; when it is missing or for another day, today is
 * treated like a day ahead (plain wording, nothing skipped). Times already past
 * are dropped: a check-in for 2 pm laid at 3 pm either fires at once or is
 * rejected, and both are worse than nothing.
 */
export function planWaterCheckIns(
  settings: WaterReminderSettings,
  now: Date,
  state: WaterDayState | null,
): PlannedWaterCheckIn[] {
  const config = normalize(settings);
  if (!waterRemindersOn(config)) return [];

  const today = toLocalDateString(now);
  const known = state && state.date === today ? state : null;
  const goalMet = !!known && known.goalMl > 0 && known.totalMl >= known.goalMl;
  const quietMs = QUIET_AFTER_LOG_MINUTES * 60_000;

  const out: PlannedWaterCheckIn[] = [];
  for (let day = 0; day < WATER_HORIZON_DAYS; day++) {
    const base = new Date(now);
    base.setDate(base.getDate() + day);
    const date = toLocalDateString(base);
    const isToday = date === today;

    for (const m of config.times) {
      const { hour, minute } = fromMinutes(m);
      const when = new Date(base);
      when.setHours(hour, minute, 0, 0);
      if (when.getTime() <= now.getTime()) continue;

      if (isToday && known) {
        if (goalMet) continue;
        if (known.lastLogAt && when.getTime() - known.lastLogAt.getTime() < quietMs) continue;
      }

      const copy =
        isToday && known
          ? waterCheckInCopy({ minutes: m, date, glassMl: config.glassMl, when, state: known })
          : waterCopy(m, config.glassMl);
      out.push({ identifier: `${ID_PREFIX}${date}.${m}`, date, minutes: m, when, ...copy });
    }
  }
  return out;
}

// ── scheduling ──────────────────────────────────────────────────────

/**
 * Cancel what this module laid: the ids it recorded, AND anything still pending
 * under its id prefix. The sweep catches a check-in whose id never made it into
 * the list (a crash between schedule and save) and the old repeating
 * `welliva.water.<minutes>` triggers from earlier builds.
 */
async function cancelOurs(): Promise<void> {
  const ids = await readJSON<string[]>(WATER_REMINDER_IDS_KEY, []);
  const doomed = new Set(Array.isArray(ids) ? ids : []);
  try {
    for (const p of await Notifications.getAllScheduledNotificationsAsync()) {
      if (p.identifier?.startsWith(ID_PREFIX)) doomed.add(p.identifier);
    }
  } catch {
    // listing failed — the recorded ids still go
  }
  for (const id of doomed) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
  await writeJSON(WATER_REMINDER_IDS_KEY, []);
}

/** One re-lay at a time: two interleaved REPLACEs could each keep a stale copy. */
let chain: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

/**
 * Bring the OS queue in line with the settings and with today's water. Safe to
 * call on every app open, every change and every logged glass. Returns how many
 * check-ins are now pending.
 */
export function syncWaterReminders(
  settings?: WaterReminderSettings,
  now: Date = new Date(),
): Promise<number> {
  return serialized(async () => {
    try {
      const config = settings ? normalize(settings) : await loadWaterReminders();
      await cancelOurs();
      if (!waterRemindersOn(config)) return 0;
      if (await notificationsPaused()) return 0;

      const perms = await Notifications.getPermissionsAsync();
      if (!perms.granted) return 0;

      await ensureRemindersChannel();
      // The button names the glass — point it at this one before anything that
      // carries it is scheduled.
      await setWaterGlassMl(config.glassMl);

      const state = await readWaterDayState(now).catch(() => null);
      const stamp = await ownerStamp();
      // A rough day silences the rest of TODAY only (./pause `quietDate`).
      const quiet = await quietDate(now);
      const ids: string[] = [];
      for (const p of planWaterCheckIns(config, now, state)) {
        if (quiet && p.date === quiet) continue;
        const id = await Notifications.scheduleNotificationAsync({
          identifier: p.identifier,
          content: {
            title: p.title,
            body: p.body,
            categoryIdentifier: WATER_REMINDER_CATEGORY,
            data: {
              type: "water-reminder",
              ml: config.glassMl,
              // The day it asks about: a 9 pm check-in answered after
              // midnight still counts toward the day it was for.
              date: p.date,
              route: "/(tabs)/diet",
              ...stamp,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            channelId: REMINDERS_CHANNEL_ID,
            date: p.when,
          },
        });
        ids.push(id);
      }
      await writeJSON(WATER_REMINDER_IDS_KEY, ids);
      return ids.length;
    } catch {
      return 0;
    }
  });
}

/** Cancel everything this module scheduled. */
export async function clearWaterReminders(): Promise<void> {
  await serialized(() => cancelOurs()).catch(() => {});
}
