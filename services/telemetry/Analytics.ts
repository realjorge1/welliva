/**
 * ANALYTICS — first-party product analytics, in our own Supabase.
 *
 * Third in the telemetry family, and the first one whose data is allowed to leave
 * the phone:
 *
 *   SyncTelemetry  — why cloud sync failed.        Device-local.
 *   CrashLog       — what threw, and where.        Device-local black box.
 *   Analytics      — did this install become a user, come back, and pay?
 *
 * WHY IT HAD TO BE OURS. See the header of the migration
 * (supabase/migrations/20261030120000_analytics.sql): the privacy policy promises
 * no third-party analytics, the Trust screen is built on that promise, and a
 * vendor SDK in a cycle-tracking app would hand a stream of behavioural health
 * signals to someone else's servers. So: two append-only tables, the anon key the
 * app already ships, and a closed event taxonomy in ./events.ts.
 *
 * THIS FILE IS PURE — NO REACT NATIVE, NO SUPABASE. `track()` is called from the
 * middle of the domain layer (the intake ledger, the water store, the billing
 * gate), and `services/*` runs under plain Node in vitest. Importing
 * `react-native` here — directly, or via `lib/supabase`, which imports it — kills
 * every test that touches a logging path with "Flow is not supported". The way
 * out is ./sink.ts: the network lives behind an injected port, installed at boot
 * by ./boot.ts. With no sink, track() still sanitizes and still queues, and
 * nothing is sent. Keep it that way.
 *
 * THE FOUR GUARANTEES THIS MODULE MAKES
 *
 *  1. IT NEVER THROWS, EVER. `track()` is called from render paths, from boot,
 *     and from inside the crash handler. Every path here swallows its own errors.
 *     An analytics layer that can break the app is a liability, not an asset.
 *  2. IT NEVER BLOCKS. `track()` returns void and does no I/O on the caller's
 *     turn; it appends to an in-memory queue and schedules a write. No await at a
 *     call site, ever.
 *  3. IT RESPECTS CONSENT, CHECKED AT SEND TIME. Not at boot — at send time. A
 *     user who switches analytics off in Trust stops being measured on the next
 *     event, not on the next launch, and the pending queue is dropped.
 *  4. IT SURVIVES THE CRASH. The queue is persisted, so the events leading up to
 *     a fatal error are still there after the restart. An analytics buffer that
 *     only lives in memory loses exactly the data you most needed.
 *
 * WHAT IT DELIBERATELY IS NOT. No session stitching, no user properties, no
 * funnels computed on the device, no retries with backoff, no sampling. The
 * reporting lives in SQL views where it can be read and corrected; this module's
 * whole job is to get a small, honest row to the table and get out of the way.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { consent } from "@/health-os/privacy/ConsentRepository";

import {
  ALLOWED_PROP_KEYS,
  type AnalyticsEventName,
  type AnalyticsEvents,
  KNOWN_EVENTS,
  MAX_PROP_STRING,
} from "./events";
import { getInstallId } from "./installId";
import { type AnalyticsSink, type EventRow, NULL_SINK } from "./sink";

/** Queue of events not yet accepted by the server. Device-local by nature. */
export const ANALYTICS_QUEUE_KEY = "@welliva_analytics_queue";
/** Set once, when `activated` has been sent — so it can only ever fire once. */
export const ANALYTICS_ACTIVATED_KEY = "@welliva_analytics_activated";

/**
 * Queue ceiling. Generous enough to hold a long offline stretch, small enough
 * that it cannot grow without bound in AsyncStorage next to real user data. When
 * full, the OLDEST events are dropped: recent behaviour is what we query.
 */
const MAX_QUEUED = 300;
/** Rows per insert. Keeps a catch-up flush off a slow connection's critical path. */
const BATCH_SIZE = 50;
/** Coalesce the bursts (open app, four events in 200ms) into one write. */
const WRITE_DEBOUNCE_MS = 1_500;
/** Send once this many are waiting, so a long session is not all stuck in the queue. */
const FLUSH_AT = 10;

let queue: EventRow[] = [];
let loaded = false;
let userId: string | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let sink: AnalyticsSink = NULL_SINK;
let lastReported: string | null = null;

/**
 * Say why an upload failed — ONCE per reason, and as a log line, never a warning.
 *
 * A dev-build warning raises LogBox's toast along the bottom of the screen, and
 * a reason that never changes (the migration not applied yet: "Could not find
 * the table") re-raised it on every flush, every ~20 s. It sat over the workout
 * player's controls and hid their names (owner, 2026-11-01). The queue is kept
 * either way, so nothing is lost by saying it quietly.
 */
function reportFailure(what: string, error: unknown): void {
  if (!__DEV__) return;
  const reason = `${what}: ${error instanceof Error ? error.message : String(error)}`;
  if (reason === lastReported) return;
  lastReported = reason;
  console.log(`[analytics] ${reason}`);
}

/**
 * Install the real sink. Called once from ./boot.ts. Passing nothing restores the
 * no-op, which is what sign-out and the tests want.
 */
export function setAnalyticsSink(next: AnalyticsSink | null): void {
  sink = next ?? NULL_SINK;
}

/* ───────────────────────────── the privacy guard ───────────────────────────── */

/**
 * Drop anything the taxonomy does not sanction. The types in ./events.ts are the
 * first lock; this is the second, because a typed boundary does not survive an
 * `as any` and this is the last code that runs before health data could leave the
 * device. Unknown event: dropped entirely. Unknown prop key: dropped. Long
 * string: dropped (every legitimate value is a short literal). Object or array:
 * dropped, since nesting is how a whole record gets in by accident.
 */
export function sanitize(
  event: string,
  props: Record<string, unknown> | undefined,
): {
  event: AnalyticsEventName;
  props: Record<string, string | number | boolean>;
} | null {
  if (!KNOWN_EVENTS.includes(event as AnalyticsEventName)) return null;

  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props ?? {})) {
    if (!ALLOWED_PROP_KEYS.includes(key)) continue;
    if (typeof value === "boolean") {
      clean[key] = value;
    } else if (typeof value === "number") {
      if (Number.isFinite(value)) clean[key] = value;
    } else if (typeof value === "string") {
      if (value.length > 0 && value.length <= MAX_PROP_STRING) clean[key] = value;
    }
    // undefined, null, objects, arrays, functions: silently dropped.
  }

  return { event: event as AnalyticsEventName, props: clean };
}

/* ────────────────────────────── queue plumbing ─────────────────────────────── */

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(ANALYTICS_QUEUE_KEY);
    const list = raw ? (JSON.parse(raw) as EventRow[]) : [];
    if (Array.isArray(list)) queue = list.slice(-MAX_QUEUED);
  } catch {
    queue = [];
  }
}

function scheduleWrite(): void {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void persist();
  }, WRITE_DEBOUNCE_MS);
}

export async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* fail-soft — the in-memory queue still flushes this session */
  }
}

/* ──────────────────────────────── public API ───────────────────────────────── */

/**
 * Record one event. Fire-and-forget: returns void, never throws, never awaited.
 *
 * Typed against the closed map in ./events.ts — an event or prop that is not
 * declared there will not compile, and would be dropped at runtime anyway.
 */
export function track<E extends AnalyticsEventName>(
  event: E,
  ...[props]: AnalyticsEvents[E] extends Record<string, never> ? [] : [AnalyticsEvents[E]]
): void {
  void (async () => {
    try {
      if (!(await consent.isGranted("product_analytics"))) {
        // Switched off: drop this event AND anything still waiting, so turning
        // the toggle off means "stop sending", not "stop collecting from now on".
        if (queue.length > 0) {
          queue = [];
          await persist();
        }
        return;
      }

      const safe = sanitize(event, props as Record<string, unknown> | undefined);
      if (!safe) return;

      await load();
      queue.push({
        install_id: await getInstallId(),
        user_id: userId,
        event: safe.event,
        props: safe.props,
        platform: sink.platform,
        app_version: sink.appVersion,
        occurred_at: new Date().toISOString(),
      });
      if (queue.length > MAX_QUEUED) queue = queue.slice(-MAX_QUEUED);

      scheduleWrite();
      if (queue.length >= FLUSH_AT) void flush();
    } catch {
      /* an analytics call must never surface to a caller */
    }
  })();
}

/**
 * Attach (or clear) the signed-in user on subsequent events. Called by the auth
 * provider. Earlier anonymous events keep their install id and are joined to the
 * account through it — which is the whole point of keying on install.
 */
export function setAnalyticsUser(id: string | null): void {
  userId = id;
}

/**
 * Send what is queued. Safe to call often — deduped, and a failure is a no-op
 * that leaves the queue intact for the next attempt.
 *
 * Deliberately no retry/backoff loop: the next `flush()` is already triggered by
 * foregrounding, by the next ten events, and by app background. A retry loop here
 * would just be a second, worse scheduler.
 */
export async function flush(): Promise<void> {
  if (flushing || sink === NULL_SINK) return;
  flushing = true;
  try {
    await load();
    if (queue.length === 0) return;
    if (!(await consent.isGranted("product_analytics"))) {
      queue = [];
      await persist();
      return;
    }

    while (queue.length > 0) {
      const batch = queue.slice(0, BATCH_SIZE);
      const result = await sink.sendEvents(batch);
      if (!result.ok) {
        reportFailure("flush failed", result.error);
        return; // keep the queue; try again on the next trigger
      }
      queue = queue.slice(batch.length);
      await persist();
    }
  } catch (e) {
    reportFailure("flush threw", e);
  } finally {
    flushing = false;
  }
}

/**
 * ACTIVATION — the one event that may fire only once per install.
 *
 * Call it from every path that counts as "started using the product" (the first
 * food, water or workout log). It reads a latch first, so the tenth meal does not
 * re-activate anyone and the number stays a count of installs rather than of
 * logging actions.
 */
export async function markActivated(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(ANALYTICS_ACTIVATED_KEY)) return;
    await AsyncStorage.setItem(ANALYTICS_ACTIVATED_KEY, new Date().toISOString());
    track("activated");
  } catch {
    /* fail-soft */
  }
}

/**
 * Send a crash to the server half of the black box. Called by CrashLog, which
 * remains the local record — this is the copy we can actually see.
 *
 * Gated on `crash_diagnostics` and not on `product_analytics`: they are separate
 * switches on the Trust screen, and someone who turns off usage analytics may
 * still want their crashes to reach us.
 */
export async function uploadCrash(input: {
  surface: string;
  message: string;
  stack?: string;
  componentStack?: string;
  at: string;
}): Promise<void> {
  try {
    if (sink === NULL_SINK) return;
    if (!(await consent.isGranted("crash_diagnostics"))) return;

    const result = await sink.sendCrash({
      install_id: await getInstallId(),
      user_id: userId,
      surface: input.surface.slice(0, 64),
      message: input.message.slice(0, 300),
      stack: input.stack?.slice(0, 2000) ?? null,
      component_stack: input.componentStack?.slice(0, 2000) ?? null,
      platform: sink.platform,
      app_version: sink.appVersion,
      occurred_at: input.at,
    });
    if (!result.ok) reportFailure("crash upload failed", result.error);
  } catch {
    /* the crash path must never crash */
  }
}

/** Test seam — clears module state without touching storage. */
export function __resetAnalyticsForTests(): void {
  queue = [];
  loaded = false;
  userId = null;
  flushing = false;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = null;
  sink = NULL_SINK;
  lastReported = null;
}

/** Test/debug read of the pending queue. */
export function __queueForTests(): EventRow[] {
  return [...queue];
}
