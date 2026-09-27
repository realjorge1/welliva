/**
 * services/notifications/pipeline.ts
 *
 * THE NOTIFICATION RESPONSE PIPELINE — every button press and every tap on every
 * welliva notification goes through here, exactly once.
 *
 * ── THREE WAYS A RESPONSE ARRIVES ───────────────────────────────────────────
 * A press on "Mark as Done" can reach JavaScript by three different doors, and
 * which one depends on the platform and on whether the app was running:
 *
 *   1. LISTENER — `addNotificationResponseReceivedListener`, installed at module
 *      scope from the app entry (./boot), so it exists before React mounts. iOS
 *      launches a killed app in the background to deliver an action and gives it
 *      a few seconds; a listener that waited for fonts, auth and the provider
 *      tree would miss that window.
 *   2. COLD REPLAY — `getLastNotificationResponseAsync`, for a response that was
 *      delivered before the listener subscribed. It returns the SAME response on
 *      every launch until another one arrives.
 *   3. BACKGROUND TASK — Android only (./backgroundTask). With the app killed,
 *      Android never starts the listener at all; expo-task-manager boots the JS
 *      bundle headless and hands the press to a task. With the app merely
 *      backgrounded, Android delivers the press to the task AND the listener.
 *
 * So the same press can arrive twice, and it must be applied once. Every
 * response is keyed (`identifier:date:action`), the key is recorded in a small
 * persisted ledger BEFORE the write, and every response runs through one
 * serialized queue. The writes underneath are idempotent where they can be (a
 * habit day is a set member; a meal tick is checked under the schedule lock); a
 * glass of water cannot be, which is why the ledger is recorded first.
 *
 * ── WHOSE DATA ──────────────────────────────────────────────────────────────
 * A write only happens when the notification belongs to the account whose data
 * this device holds (./owner). A leftover from a signed-out account is dismissed
 * and its trigger cancelled, never applied.
 *
 * ── NOTHING FAILS SILENTLY ──────────────────────────────────────────────────
 * Every applied press lands in the lock-screen journal (./journal) — the receipt
 * the Notifications screen shows. A press that could NOT be counted (no meal on
 * that day's plan, a day already closed) is answered with a follow-up
 * notification that says so and taps through to finish it in the app.
 *
 * Only `expo-notifications`, AsyncStorage and the domain services are imported —
 * no `react-native`, no router — so this is testable under Node. Navigation for a
 * plain tap is handed to React through {@link subscribeRouteIntents}.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { MealType } from "../../models/diet";
import {
  ACTION_LOG_MEAL,
  ACTION_LOG_WATER,
  ACTION_MARK_DONE,
  ACTION_SNOOZE,
} from "./categories";
import { markHabitDoneFromNotification } from "./habitActions";
import { appendJournal, type JournalEntry } from "./journal";
import { logMealFromNotification } from "./mealActions";
import { toLocalDateString } from "../OfflineStorage";
import { fireDateOf } from "./fireTime";
import { mayWriteFor } from "./owner";
import { presentFollowUp, snoozeReminder } from "./send";
import { logWaterFromNotification } from "./waterActions";

/** Keys of responses already applied — bounded, device-local. */
export const HANDLED_KEY = "@welliva_notif_handled";
const HANDLED_MAX = 64;

/** `Notifications.DEFAULT_ACTION_IDENTIFIER`, restated so tests needn't mock it. */
export const DEFAULT_ACTION = "expo.modules.notifications.actions.DEFAULT";

const SLOT_LABEL: Record<string, string> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
};

// ── normalization ───────────────────────────────────────────────────

/** One response, in the one shape every path below reads. */
export interface NormalizedResponse {
  /** Dedupe key: `identifier:date:action`. */
  key: string;
  /** The notification request's identifier (what dismiss/cancel take). */
  identifier: string;
  actionIdentifier: string;
  /** Raw fire time — seconds on iOS, ms on Android (see ./fireTime). */
  firedAt: number | undefined;
  title: string | null;
  body: string | null;
  categoryIdentifier: string | null;
  data: Record<string, unknown>;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Accept a response from any of the three doors.
 *
 * The listener and the cold replay get expo's MAPPED response (`content.data` is
 * an object). The Android background task gets the RAW native bundle, where the
 * payload is still a JSON string under `content.dataString` — read without this,
 * every lock-screen press on a killed Android app would look like a notification
 * with no habit and no meal. Returns null for anything that isn't a response
 * (the same task also receives incoming remote pushes).
 */
export function normalizeResponse(raw: unknown): NormalizedResponse | null {
  let r = asRecord(raw);
  if (!r) return null;
  // Some task payloads wrap the response one level down.
  if (typeof r.actionIdentifier !== "string" && asRecord(r.data)?.actionIdentifier) {
    r = asRecord(r.data)!;
  }
  const actionIdentifier = r.actionIdentifier;
  if (typeof actionIdentifier !== "string" || !actionIdentifier) return null;

  const notification = asRecord(r.notification);
  const request = asRecord(notification?.request);
  const content = asRecord(request?.content) ?? {};
  const identifier = typeof request?.identifier === "string" ? request.identifier : "";

  let data = asRecord(content.data) ?? {};
  if (Object.keys(data).length === 0 && typeof content.dataString === "string") {
    try {
      data = asRecord(JSON.parse(content.dataString)) ?? {};
    } catch {
      data = {};
    }
  }

  const rawDate = notification?.date;
  const firedAt =
    typeof rawDate === "number"
      ? rawDate
      : typeof rawDate === "string" && rawDate.trim() !== "" && Number.isFinite(Number(rawDate))
        ? Number(rawDate)
        : undefined;

  return {
    key: `${identifier}:${firedAt ?? ""}:${actionIdentifier}`,
    identifier,
    actionIdentifier,
    firedAt,
    title: typeof content.title === "string" ? content.title : null,
    body: typeof content.body === "string" ? content.body : null,
    categoryIdentifier:
      typeof content.categoryIdentifier === "string" ? content.categoryIdentifier : null,
    data,
  };
}

// ── the handled-key ledger ──────────────────────────────────────────

async function readHandled(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(HANDLED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

/** Record `key`; returns false when it was already there (a repeat delivery). */
async function claim(key: string): Promise<boolean> {
  const handled = await readHandled();
  if (handled.includes(key)) return false;
  try {
    await AsyncStorage.setItem(
      HANDLED_KEY,
      JSON.stringify([key, ...handled].slice(0, HANDLED_MAX)),
    );
  } catch {
    // fail-soft: worst case an idempotent action is re-applied
  }
  return true;
}

// ── route intents (plain taps) ──────────────────────────────────────

type RouteListener = (route: string) => void;
const routeListeners = new Set<RouteListener>();
let pendingRoute: string | null = null;

/**
 * Observe "open the app at this screen" intents. A plain tap on a notification
 * is the one response that needs React (the router), so the pipeline only
 * RECORDS where to go; the root runner navigates once the app is ready. An
 * intent raised before any runner subscribed is held and delivered on
 * subscribe, so a tap that cold-launched the app still lands on its screen.
 */
export function subscribeRouteIntents(fn: RouteListener): () => void {
  routeListeners.add(fn);
  if (pendingRoute) {
    const route = pendingRoute;
    pendingRoute = null;
    try {
      fn(route);
    } catch {
      // the runner retries on its own schedule
    }
  }
  return () => {
    routeListeners.delete(fn);
  };
}

function raiseRoute(route: string): void {
  if (routeListeners.size === 0) {
    pendingRoute = route;
    return;
  }
  for (const fn of [...routeListeners]) {
    try {
      fn(route);
    } catch {
      // one bad listener must not stop the others
    }
  }
}

// ── outcomes ────────────────────────────────────────────────────────

export type PipelineOutcome =
  | { kind: "ignored"; reason: "not-a-response" | "duplicate" | "not-owner" | "unknown-action" | "malformed" }
  | { kind: "habit" | "meal" | "water"; ok: boolean; title: string; detail: string }
  | { kind: "snooze" }
  | { kind: "open"; route: string | null }
  | { kind: "test" };

type OutcomeListener = (o: PipelineOutcome) => void;
const outcomeListeners = new Set<OutcomeListener>();

/** Observe applied responses (the React runner uses it for foreground haptics). */
export function subscribePipelineOutcomes(fn: OutcomeListener): () => void {
  outcomeListeners.add(fn);
  return () => {
    outcomeListeners.delete(fn);
  };
}

function report(o: PipelineOutcome): PipelineOutcome {
  for (const fn of [...outcomeListeners]) {
    try {
      fn(o);
    } catch {
      // never let an observer break the pipeline
    }
  }
  return o;
}

// ── helpers ─────────────────────────────────────────────────────────

async function dismiss(identifier: string): Promise<void> {
  if (!identifier) return;
  try {
    await Notifications.dismissNotificationAsync(identifier);
  } catch {
    // already gone
  }
}

async function journal(
  n: NormalizedResponse,
  entry: Omit<JournalEntry, "id" | "at">,
): Promise<void> {
  try {
    await appendJournal({ ...entry, id: n.key, at: new Date().toISOString() });
  } catch {
    // the receipt is a courtesy; the write it describes already landed
  }
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The fire time to date a write by. Normally the notification's own fire time;
 * but a reminder that knows which DAY it is for says so in its data (a meal
 * reminder's `date`, or the `forDate` a snooze stamps), and that wins. A 23:45
 * snack reminder snoozed to 00:15 is still about the day it was first sent for.
 */
function effectiveFiredAt(n: NormalizedResponse): number | undefined {
  const hint =
    typeof n.data.forDate === "string" && DAY_RE.test(n.data.forDate)
      ? n.data.forDate
      : typeof n.data.date === "string" && DAY_RE.test(n.data.date)
        ? n.data.date
        : null;
  if (!hint) return n.firedAt;
  const [y, m, d] = hint.split("-").map(Number);
  // Midday of that day: unambiguous whatever the local offset.
  return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
}

function prettyDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const when = new Date(y, (m || 1) - 1, d || 1);
  return when.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

// ── the handlers ────────────────────────────────────────────────────

/**
 * The Settings demo looks real and owns no habit, meal or glass. Answer the
 * press so the user sees the whole loop work — that is what the test is for —
 * and write nothing.
 */
async function answerTest(): Promise<PipelineOutcome> {
  await presentFollowUp({
    title: "That's all it takes",
    body: "In a real reminder, that tap logs it for you — welliva never had to open.",
  });
  return report({ kind: "test" });
}

async function onMarkDone(n: NormalizedResponse): Promise<PipelineOutcome> {
  await dismiss(n.identifier);

  if (n.data.test === true) return answerTest();

  const habitId = typeof n.data.habitId === "string" ? n.data.habitId : null;
  if (!habitId) return report({ kind: "ignored", reason: "malformed" });

  const result = await markHabitDoneFromNotification(habitId, effectiveFiredAt(n));
  if (result.ok) {
    const detail = result.alreadyDone
      ? "Already done — nothing changed"
      : result.streak > 1
        ? `Marked done · ${result.streak}-day streak`
        : "Marked done";
    await journal(n, { kind: "habit", date: result.date, title: result.habitName, detail, ok: true });
    return report({ kind: "habit", ok: true, title: result.habitName, detail });
  }

  if (result.reason === "not-found" || result.reason === "not-manual") {
    // A reminder for a habit that no longer takes one — retired, or turned into
    // an auto-tracked habit. Stop it firing rather than answering it forever.
    await cancelRemindersForHabit(habitId);
    const detail = "No longer tracked — its reminder has been switched off";
    await journal(n, { kind: "habit", date: "", title: n.title ?? "Habit", detail, ok: false });
    return report({ kind: "habit", ok: false, title: n.title ?? "Habit", detail });
  }

  await presentFollowUp({
    title: "That didn't save",
    body: `Tap to mark ${n.title ?? "it"} done in welliva.`,
    route: `/habit/${habitId}`,
  });
  const detail = "Couldn't save — sent a reminder to finish it in the app";
  await journal(n, { kind: "habit", date: "", title: n.title ?? "Habit", detail, ok: false });
  return report({ kind: "habit", ok: false, title: n.title ?? "Habit", detail });
}

async function cancelRemindersForHabit(habitId: string): Promise<void> {
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    for (const p of pending) {
      const data = (p.content?.data ?? {}) as Record<string, unknown>;
      if (data.type === "habit-reminder" && data.habitId === habitId) {
        await Notifications.cancelScheduledNotificationAsync(p.identifier).catch(() => {});
      }
    }
  } catch {
    // best effort — the boot reconcile catches whatever this misses
  }
}

async function onLogMeal(n: NormalizedResponse): Promise<PipelineOutcome> {
  await dismiss(n.identifier);
  if (n.data.test === true) return answerTest();

  const slot = typeof n.data.slot === "string" && n.data.slot in SLOT_LABEL ? n.data.slot : null;
  if (!slot) return report({ kind: "ignored", reason: "malformed" });
  const label = SLOT_LABEL[slot];

  const result = await logMealFromNotification(slot as MealType, effectiveFiredAt(n));
  if (result.ok) {
    const detail = result.alreadyLogged ? `Already logged as ${label}` : `Logged as ${label}`;
    await journal(n, { kind: "meal", date: result.date, title: result.mealName, detail, ok: true });
    return report({ kind: "meal", ok: true, title: result.mealName, detail });
  }

  const title = label[0].toUpperCase() + label.slice(1);
  if (result.reason === "closed") {
    const when = result.date ? prettyDay(result.date) : "that day";
    await presentFollowUp({
      title: "Too late to log that one",
      body: `That reminder was for ${when}, which is now closed for logging.`,
      route: "/(tabs)/diet",
    });
    const detail = "Day already closed — not counted";
    await journal(n, { kind: "meal", date: result.date ?? "", title, detail, ok: false });
    return report({ kind: "meal", ok: false, title, detail });
  }

  // No meal in that slot on that day's plan (or the write failed): nothing to
  // tick — but the user just said they ate. Take them to log what they had.
  await presentFollowUp({
    title: result.reason === "no-meal" ? `No ${label} on the plan` : "That didn't save",
    body:
      result.reason === "no-meal"
        ? `Tap to log what you had for ${label} — it takes a few seconds.`
        : `Tap to log your ${label} in welliva.`,
    route: "/diet/log-food",
  });
  const detail =
    result.reason === "no-meal"
      ? "Nothing planned for that slot — sent a link to log it"
      : "Couldn't save — sent a link to log it";
  await journal(n, { kind: "meal", date: result.date ?? "", title, detail, ok: false });
  return report({ kind: "meal", ok: false, title, detail });
}

async function onLogWater(n: NormalizedResponse): Promise<PipelineOutcome> {
  await dismiss(n.identifier);
  if (n.data.test === true) return answerTest();

  const result = await logWaterFromNotification(n.data.ml, effectiveFiredAt(n));
  if (result.ok) {
    const detail = `+${result.ml} ml`;
    await journal(n, { kind: "water", date: result.date, title: "Water", detail, ok: true });
    return report({ kind: "water", ok: true, title: "Water", detail });
  }
  await presentFollowUp({
    title: "That didn't save",
    body: "Tap to add your glass in welliva.",
    route: "/(tabs)/diet",
  });
  const detail = "Couldn't save — sent a link to add it";
  await journal(n, { kind: "water", date: "", title: "Water", detail, ok: false });
  return report({ kind: "water", ok: false, title: "Water", detail });
}

async function onSnooze(n: NormalizedResponse): Promise<PipelineOutcome> {
  // The snoozed copy fires later — possibly after midnight — but it is still
  // about the day the original was sent for. Stamp that day so its button logs
  // there (see effectiveFiredAt).
  const forDate = toLocalDateString(fireDateOf(effectiveFiredAt(n)));
  await snoozeReminder({
    title: n.title ?? "Reminder",
    body: n.body ?? "Still here whenever you're ready.",
    data: { ...n.data, forDate },
    categoryIdentifier: n.categoryIdentifier,
  });
  await dismiss(n.identifier);
  return report({ kind: "snooze" });
}

function onOpen(n: NormalizedResponse): PipelineOutcome {
  const route = typeof n.data.route === "string" && n.data.route ? n.data.route : null;
  const habitId = typeof n.data.habitId === "string" ? n.data.habitId : null;
  const target = route ?? (habitId ? `/habit/${habitId}` : null);
  if (target) raiseRoute(target);
  return report({ kind: "open", route: target });
}

// ── the queue ───────────────────────────────────────────────────────

let queue: Promise<unknown> = Promise.resolve();

/** Where a response came in — for diagnostics only; handling is identical. */
export type ResponseSource = "listener" | "cold" | "task";

/**
 * Apply one notification response. Serialized with every other response, so two
 * buttons pressed in quick succession both land, in order, and a response that
 * arrives by two doors is applied once. Never throws.
 */
export function processNotificationResponse(
  raw: unknown,
  _source: ResponseSource = "listener",
): Promise<PipelineOutcome> {
  const run = queue.then(async (): Promise<PipelineOutcome> => {
    const n = normalizeResponse(raw);
    if (!n) return { kind: "ignored", reason: "not-a-response" };

    if (!(await claim(n.key))) return { kind: "ignored", reason: "duplicate" };

    // A plain tap only navigates; it writes nothing, so it needs no owner.
    if (n.actionIdentifier === DEFAULT_ACTION) return onOpen(n);

    const writes =
      n.actionIdentifier === ACTION_MARK_DONE ||
      n.actionIdentifier === ACTION_LOG_MEAL ||
      n.actionIdentifier === ACTION_LOG_WATER;
    if (writes && n.data.test !== true && !(await mayWriteFor(n.data))) {
      // Somebody else's reminder. Never apply it; stop it coming back.
      await dismiss(n.identifier);
      if (n.identifier) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
      }
      return report({ kind: "ignored", reason: "not-owner" });
    }

    switch (n.actionIdentifier) {
      case ACTION_MARK_DONE:
        return onMarkDone(n);
      case ACTION_LOG_MEAL:
        return onLogMeal(n);
      case ACTION_LOG_WATER:
        return onLogWater(n);
      case ACTION_SNOOZE:
        return onSnooze(n);
      default:
        return { kind: "ignored", reason: "unknown-action" };
    }
  });
  queue = run.catch(() => undefined);
  return run.catch(
    (): PipelineOutcome => ({ kind: "ignored", reason: "malformed" }),
  );
}
