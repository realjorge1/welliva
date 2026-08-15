/**
 * SYNC TELEMETRY — makes cloud-sync failures visible instead of silent.
 *
 * The problem this solves: every sync path is deliberately FAIL-SOFT (a hiccup
 * must never block a local write or surface in the UI), and the only trace a
 * failure left was a console.warn — invisible on a real device, in production,
 * or to the user reporting "my data didn't move across". A sync layer you can't
 * observe is one you can't debug.
 *
 * So each operation records what it attempted and how it went. The log is a
 * small ring buffer persisted to AsyncStorage (it must survive the app restart
 * that often follows a bad sync) plus lifetime counters per operation.
 *
 * Deliberately NOT a remote analytics pipeline: this is health data, and the
 * app is offline-first and privacy-minded (see app/privacy.tsx). Nothing here
 * leaves the device — it's a local black box you read from a debug screen.
 * Keep it that way: never log field VALUES, only operation names and errors.
 */
import { KEYS, readJSON, writeJSON } from "../OfflineStorage";

/** Which sync operation an event describes. Extend as slices land. */
export type SyncOp =
  | "profile.push"
  | "profile.pull"
  | "document.push"
  | "document.pull"
  | "storage.upload"
  | "storage.signUrl"
  | "storage.remove";

export type SyncOutcome = "ok" | "failed" | "retried";

export interface SyncEvent {
  op: SyncOp;
  outcome: SyncOutcome;
  /** ISO timestamp (device clock — this is diagnostics, not sync ordering). */
  at: string;
  /** Milliseconds the attempt took. */
  ms: number;
  /** Error message, when it failed. Never contains user data. */
  error?: string;
  /** How many retries it took (only present when > 0). */
  attempts?: number;
}

export interface OpCounters {
  ok: number;
  failed: number;
  /** Attempts that succeeded, but only after at least one retry. */
  retried: number;
  /** ISO time we last saw this op succeed. */
  lastOkAt?: string;
  /** ISO time + message of the most recent failure. */
  lastErrorAt?: string;
  lastError?: string;
}

export interface SyncHealth {
  events: SyncEvent[];
  counters: Partial<Record<SyncOp, OpCounters>>;
}

/** Keep the log bounded — this sits in AsyncStorage on a phone. */
const MAX_EVENTS = 50;

const EMPTY: SyncHealth = { events: [], counters: {} };

/**
 * In-memory mirror so reads are synchronous-ish and we don't hammer
 * AsyncStorage on every event. Loaded lazily, written back debounced.
 */
let cache: SyncHealth | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function load(): Promise<SyncHealth> {
  if (cache) return cache;
  try {
    cache = await readJSON<SyncHealth>(KEYS.SYNC_TELEMETRY, EMPTY);
    // Defend against a truncated/older shape.
    if (!cache || !Array.isArray(cache.events)) cache = { ...EMPTY };
    if (!cache.counters) cache.counters = {};
  } catch {
    cache = { ...EMPTY };
  }
  return cache;
}

/** Batch writes — a burst of events costs one AsyncStorage round-trip. */
function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 2000);
}

/** Force the pending log to disk. Call before sign-out or teardown. */
export async function flush(): Promise<void> {
  if (!cache) return;
  try {
    await writeJSON(KEYS.SYNC_TELEMETRY, cache);
  } catch {
    // Telemetry must never break the app it's observing.
  }
}

/** Record one finished attempt. */
export async function record(event: SyncEvent): Promise<void> {
  const health = await load();

  health.events.unshift(event);
  if (health.events.length > MAX_EVENTS) {
    health.events.length = MAX_EVENTS;
  }

  const c: OpCounters = health.counters[event.op] ?? {
    ok: 0,
    failed: 0,
    retried: 0,
  };
  if (event.outcome === "failed") {
    c.failed += 1;
    c.lastErrorAt = event.at;
    c.lastError = event.error;
  } else {
    c.ok += 1;
    c.lastOkAt = event.at;
    if (event.outcome === "retried") c.retried += 1;
  }
  health.counters[event.op] = c;

  scheduleFlush();
}

/**
 * Record a sync ANOMALY — something refused rather than something that failed.
 *
 * Distinct from a failed attempt on purpose: a 500 is the network being the
 * network, whereas "this document is half a megabyte" is a bug in OUR retention
 * that will keep costing every user bandwidth until someone notices. This is how
 * we notice, before the bandwidth bill or the support ticket does.
 *
 * Same privacy rule as everything else here: operation names and magnitudes
 * only, never field values.
 */
export type SyncAnomaly = "doc_too_large";

export async function recordSyncAnomaly(
  anomaly: SyncAnomaly,
  detail: { key: string; bytes?: number },
): Promise<void> {
  const size = detail.bytes != null ? ` (${Math.round(detail.bytes / 1024)}KB)` : "";
  await record({
    op: "document.push",
    outcome: "failed",
    at: new Date().toISOString(),
    ms: 0,
    error: `${anomaly}: ${detail.key}${size}`,
  });
  if (__DEV__) {
    console.warn(`[sync anomaly] ${anomaly}: ${detail.key}${size}`);
  }
}

/** Read the local black box — for a debug screen or a support dump. */
export async function getSyncHealth(): Promise<SyncHealth> {
  const health = await load();
  // Hand back a copy so a caller can't mutate the live cache.
  return {
    events: [...health.events],
    counters: { ...health.counters },
  };
}

/** Wipe the log. Sign-out should call this — it's per-account diagnostics. */
export async function clearSyncHealth(): Promise<void> {
  cache = { events: [], counters: {} };
  await flush();
}

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

/** Transient = worth retrying. A 4xx/RLS rejection will never fix itself. */
function isTransient(error: unknown): boolean {
  const msg = (
    error instanceof Error ? error.message : String(error ?? "")
  ).toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    msg.includes("socket") ||
    msg.includes("temporarily") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("504") ||
    msg.includes("429")
  );
}

const BASE_DELAY_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a sync operation with telemetry and bounded exponential backoff.
 *
 * `fn` should THROW on failure (so we can see the error) — the fail-soft
 * swallowing stays in the caller, which decides what null means. Retries only
 * on transient errors; a permissions/validation failure fails fast.
 *
 * Returns whatever `fn` returns, or rethrows the final error.
 */
export async function withSyncTelemetry<T>(
  op: SyncOp,
  fn: () => Promise<T>,
  opts: { retries?: number } = {},
): Promise<T> {
  const maxRetries = opts.retries ?? 2;
  const started = Date.now();
  let attempt = 0;

  for (;;) {
    try {
      const result = await fn();
      await record({
        op,
        outcome: attempt > 0 ? "retried" : "ok",
        at: new Date().toISOString(),
        ms: Date.now() - started,
        ...(attempt > 0 ? { attempts: attempt + 1 } : {}),
      });
      return result;
    } catch (e) {
      const canRetry = attempt < maxRetries && isTransient(e);
      if (!canRetry) {
        await record({
          op,
          outcome: "failed",
          at: new Date().toISOString(),
          ms: Date.now() - started,
          error: e instanceof Error ? e.message : String(e),
          ...(attempt > 0 ? { attempts: attempt + 1 } : {}),
        });
        throw e;
      }
      // 400ms, 800ms, … — short enough that a login-time pull still feels instant.
      await sleep(BASE_DELAY_MS * 2 ** attempt);
      attempt += 1;
    }
  }
}
