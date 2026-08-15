/**
 * SYNC ENGINE — orchestrates the per-user document mirror (fixes findings #1/#2:
 * all logged data + Gozlin's memory now follow the account across devices).
 *
 * Three moving parts, all fail-soft:
 *  1. reconcileOnLogin  — pull the cloud, adopt anything newer, then push local.
 *  2. flushOutbox       — drain the queue of dirty keys to the cloud.
 *  3. startAutoSync     — watch local writes + app foreground, keep draining.
 *
 * WHY A CHANGE-DETECTING SWEEP (not just the write observer). OfflineStorage's
 * write observer only sees writes that go THROUGH OfflineStorage. Several
 * services — StreakService, AchievementService, TournamentService,
 * ChallengeService, JourneyService, SessionService, ScheduleService — write
 * AsyncStorage directly, so the observer never fires for streaks or achievements
 * (which is precisely what finding #1 asks us to sync). `fullPushSweep` closes
 * that gap: it scans every synced key, compares a cheap signature against what we
 * last pushed, and queues whatever actually changed — regardless of who wrote it.
 *
 * CONFLICT POLICY (v2): TWO policies, chosen per key by services/sync/
 * mergeStrategies.ts.
 *
 *  · Append-only logs (food log, water/diet history, body logs, workout and
 *    session history, plan periods) MERGE. Both sides' entries survive.
 *  · Single-valued documents (bio, plan state, preferences) stay last-write-wins
 *    on the server `updated_at`, still protected by the local-dirty check.
 *
 * v1 was LWW for everything, and the granularity was the whole document — so
 * logging breakfast on a phone and lunch on a tablet discarded one device's
 * entire day. The old note here ("one human rarely edits two phones in the same
 * second") measured the wrong window: with document-level LWW the collision
 * window is as long as a device stays offline, not a second.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";
import { setWriteObserver } from "../OfflineStorage";
import { invalidateConnectivityCache, isOnline } from "./connectivity";
import { pullDocsSince, pushDoc, type RemoteDoc } from "./DocumentSync";
import { isMergeable, merge } from "./mergeStrategies";
import {
  isSyncedKey,
  LAST_SYNC_KEY,
  listSyncedKeys,
  OUTBOX_KEY,
  PUSHED_KEY,
  WATERMARKS_KEY,
} from "./syncKeys";

type StampMap = Record<string, string>;

/** Matches the profile-push debounce so a burst of edits costs one round-trip. */
const FLUSH_DEBOUNCE_MS = 1200;

// ---------------------------------------------------------------------------
// Suspension — one flag, owned by account deletion.
// ---------------------------------------------------------------------------
/**
 * While true, nothing pushes. Set by services/account/AccountDeletion.ts for the
 * few seconds between "start deleting" and "session torn down".
 *
 * The FK graph already makes a resurrection IMPOSSIBLE — once `auth.users` is
 * gone, an INSERT into `public.users` fails its foreign key, so a late flush
 * cannot rebuild the account. This flag is not about correctness of the delete;
 * it is about not spending the user's radio on a burst of writes that are all
 * guaranteed to fail, and not filling telemetry with errors that look like a
 * broken sync when they are just a race we chose not to run.
 *
 * Deliberately NOT persisted: if the app dies mid-deletion the flag should die
 * with it, or a crash would leave sync silently off forever. The next launch
 * finds either a deleted account (sign-in fails, nothing to sync) or an intact
 * one (sync should resume) — both correct with an in-memory flag.
 */
let syncSuspended = false;

/** @returns the previous value, so a caller can restore it if the delete aborts. */
export function setSyncSuspended(next: boolean): boolean {
  const previous = syncSuspended;
  syncSuspended = next;
  return previous;
}

export function isSyncSuspended(): boolean {
  return syncSuspended;
}

// ---------------------------------------------------------------------------
// Tier gate — cloud backup + multi-device sync is a paid feature.
// ---------------------------------------------------------------------------
/**
 * Whether this account may PUSH to the cloud. Injected rather than imported:
 * services/billing/config.ts reads `Platform` from react-native, and this module
 * is unit-tested in a node environment that mocks react-native down to
 * `AppState` alone. Injection keeps the engine free of a billing dependency and
 * keeps the existing suite honest — the same reason `setSyncSuspended` exists.
 *
 * Defaults to ALLOW, matching the fail-open rule in services/billing/gating.ts:
 * a build with no store keys behaves exactly as the app did before billing.
 */
let pushGate: () => boolean = () => true;

/** Install the predicate. Called once from contexts/BillingContext.tsx. */
export function setSyncPushGate(fn: (() => boolean) | null): void {
  pushGate = fn ?? (() => true);
}

/**
 * PUSH is the paid half; PULL is never gated.
 *
 * Uploading is the real infrastructure cost and the thing "sync across devices"
 * actually means, so it is what Pro buys. Downloading on login stays open on
 * purpose: someone who subscribed, filled the cloud, then lapsed must still be
 * able to get their own data back onto a reinstalled device. Withholding data we
 * are already storing for them would be hostile, and it is the same principle
 * that keeps export and account deletion free (see services/billing/tiers.ts).
 *
 * It cannot leak the paid feature: with pushes gated, nothing new ever reaches
 * the cloud, so there is nothing for a second device to pull.
 */
function canPush(): boolean {
  try {
    return pushGate();
  } catch {
    return true; // a broken gate must not silently disable sync for a payer
  }
}

// ---------------------------------------------------------------------------
// Bookkeeping I/O — raw AsyncStorage so it bypasses the write observer (these
// keys are device-local and must never feed back into the sync loop).
// ---------------------------------------------------------------------------
async function readMap(key: string): Promise<StampMap> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const obj = raw ? (JSON.parse(raw) as StampMap) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}
async function writeMap(key: string, map: StampMap): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* fail-soft */
  }
}
async function readOutbox(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
async function writeOutbox(list: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
  } catch {
    /* fail-soft */
  }
}

// ---------------------------------------------------------------------------
// A tiny mutex so the observer's bursty enqueues + concurrent flushes can't lose
// an outbox entry to a read-modify-write race.
// ---------------------------------------------------------------------------
let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => {});
  return run as Promise<T>;
}

/** djb2 over the raw value — cheap change detection, not cryptographic. */
function sign(value: string | null): string {
  if (value === null) return " "; // distinct tombstone signature
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) {
    h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  }
  return `${value.length}:${(h >>> 0).toString(36)}`;
}

function maxIso(map: StampMap): string | null {
  let max: string | null = null;
  for (const v of Object.values(map)) if (!max || v > max) max = v;
  return max;
}

// ---------------------------------------------------------------------------
// Queue ops (locked)
// ---------------------------------------------------------------------------
async function enqueue(key: string): Promise<void> {
  await withLock(async () => {
    const outbox = await readOutbox();
    if (!outbox.includes(key)) {
      outbox.push(key);
      await writeOutbox(outbox);
    }
  });
}

/** Snapshot the outbox and clear it in one atomic step. */
async function takeOutbox(): Promise<string[]> {
  return withLock(async () => {
    const outbox = await readOutbox();
    if (outbox.length) await writeOutbox([]);
    return outbox;
  });
}

/** Put failed keys back (union with anything queued while we were pushing). */
async function requeue(keys: string[]): Promise<void> {
  if (!keys.length) return;
  await withLock(async () => {
    const outbox = await readOutbox();
    await writeOutbox([...new Set([...outbox, ...keys])]);
  });
}

/** Merge watermark + pushed-signature updates under the lock. */
async function applyStamps(
  watermarks: StampMap,
  pushed: StampMap,
): Promise<void> {
  if (!Object.keys(watermarks).length && !Object.keys(pushed).length) return;
  await withLock(async () => {
    const w = { ...(await readMap(WATERMARKS_KEY)), ...watermarks };
    const p = { ...(await readMap(PUSHED_KEY)), ...pushed };
    await writeMap(WATERMARKS_KEY, w);
    await writeMap(PUSHED_KEY, p);
  });
}

/** Write an adopted remote value locally, bypassing the observer (no echo push). */
async function adopt(doc: RemoteDoc): Promise<void> {
  try {
    if (doc.deleted || doc.value === null) await AsyncStorage.removeItem(doc.key);
    else await AsyncStorage.setItem(doc.key, doc.value);
  } catch {
    /* fail-soft */
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** True while there are unpushed local changes — lets sign-out avoid data loss. */
export async function hasPendingWrites(): Promise<boolean> {
  return (await readOutbox()).length > 0;
}

/**
 * How many local changes haven't reached the cloud. Drives the status pill and
 * the sign-out warning — "3 changes waiting" is information a user can act on;
 * a silent console.warn is not.
 */
export async function pendingWriteCount(): Promise<number> {
  return (await readOutbox()).length;
}

/** ISO time this device last drained its queue completely, or null if never. */
export async function getLastSyncAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

async function markSynced(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {
    /* fail-soft */
  }
}

/**
 * Push every queued key to the cloud. Successes leave the queue and advance the
 * watermark + pushed-signature; failures are requeued for the next attempt.
 */
export async function flushOutbox(userId: string): Promise<void> {
  // The account is being torn down — every push below would 404 or fail a FK.
  // Checked before the connectivity probe so deletion doesn't even wake the radio.
  if (syncSuspended) return;
  // Free tier: cloud backup is Pro. Bail before the radio, same as above.
  if (!canPush()) return;
  // Don't burn the radio and the battery on a round of fetches that cannot
  // succeed. The queue is durable, the foreground hook re-drains it, and the
  // status pill tells the user what's still waiting — so skipping here loses
  // nothing and stops an offline device retrying every write it makes.
  if (!(await isOnline())) return;

  const batch = await takeOutbox();
  if (batch.length === 0) return;

  const watermarks: StampMap = {};
  const pushed: StampMap = {};
  const failed: string[] = [];

  for (const key of batch) {
    const value = await AsyncStorage.getItem(key); // null → tombstone
    const stamp = await pushDoc(userId, key, value);
    if (stamp) {
      watermarks[key] = stamp;
      pushed[key] = sign(value);
    } else {
      failed.push(key);
    }
  }

  await applyStamps(watermarks, pushed);
  await requeue(failed);
  // "Last synced" means the queue actually emptied — a partial drain with
  // failures still pending is not a moment we should reassure the user about.
  if (failed.length === 0) await markSynced();
}

/**
 * Scan every synced key, queue whatever changed since we last pushed it, plus
 * tombstones for keys that were deleted locally. THIS is what catches the
 * services that write AsyncStorage directly. Then drain.
 */
export async function fullPushSweep(userId: string): Promise<void> {
  // Same reason as flushOutbox, but this one matters more: the sweep TOMBSTONES
  // keys that vanished locally, and account deletion wipes every local key. An
  // unguarded sweep during teardown would enqueue a tombstone for all ~50 of
  // them — pure waste against rows the cascade is deleting anyway.
  if (syncSuspended) return;
  // Free tier. Returning BEFORE the enqueue loop is the point: queueing keys we
  // will never drain would leave the sync status pill reading "50 waiting"
  // forever, which looks like a broken sync rather than an unsubscribed one.
  if (!canPush()) return;
  const pushed = await readMap(PUSHED_KEY);
  const liveKeys = await listSyncedKeys();
  const liveSet = new Set(liveKeys);

  for (const key of liveKeys) {
    const value = await AsyncStorage.getItem(key);
    if (pushed[key] !== sign(value)) await enqueue(key);
  }
  // Deletions: previously-pushed keys that vanished locally → tombstone once.
  for (const key of Object.keys(pushed)) {
    if (!liveSet.has(key) && isSyncedKey(key) && pushed[key] !== sign(null)) {
      await enqueue(key);
    }
  }

  await flushOutbox(userId);
}

/**
 * Login-time reconcile: pull the delta since our high-watermark, adopt anything
 * the cloud has that we don't (fresh device) or that is newer than what we hold
 * and not locally dirty, then push our own changes up. Blocks the caller so the
 * UI can wait for a new device's data to land before routing to the app.
 */
export async function reconcileOnLogin(userId: string): Promise<void> {
  const watermarks = await readMap(WATERMARKS_KEY);
  const dirty = new Set(await readOutbox());
  const sinceIso = maxIso(watermarks);

  const docs = await pullDocsSince(userId, sinceIso);
  const adoptedW: StampMap = {};
  const adoptedP: StampMap = {};

  for (const doc of docs) {
    const local = await AsyncStorage.getItem(doc.key);
    const fresh = local === null;
    const isDirty = dirty.has(doc.key);
    const known = watermarks[doc.key];
    const remoteNewer = !known || doc.updatedAt > known;

    if (doc.deleted) {
      // Adopt a deletion unless we hold a newer local change to that key.
      if (!isDirty && (fresh || remoteNewer)) {
        await adopt(doc);
        adoptedW[doc.key] = doc.updatedAt;
        adoptedP[doc.key] = sign(null);
      }
      continue;
    }
    if (isMergeable(doc.key)) {
      // APPEND-ONLY LOGS: union both sides instead of picking a winner. This is
      // the fix for "breakfast on the phone, lunch on the tablet" — under the
      // old adopt-or-discard branch one of those days was silently thrown away.
      // Merging unconditionally (not only when remote is newer) is safe because
      // the union is idempotent and commutative: a stale remote contributes
      // nothing, it can't take anything away.
      const merged = merge(doc.key, local, doc.value);
      if (merged !== local) {
        await adopt({ ...doc, value: merged });
        adoptedW[doc.key] = doc.updatedAt;
        adoptedP[doc.key] = sign(merged);
        // The merge produced something the cloud doesn't have (our local-only
        // entries) — push it back, or the other device never learns about them.
        // Skipped on the free tier: the merge still ran, so the user KEEPS the
        // union locally; only the upload is withheld.
        if (merged !== doc.value && canPush()) await enqueue(doc.key);
      } else if (merged !== doc.value && canPush()) {
        // Local already contained everything remote has, plus more.
        await enqueue(doc.key);
      }
      continue;
    }

    // SINGLE-VALUED DOCUMENTS (bio, plan state, preferences): last-write-wins is
    // the right semantic — merging two versions of one object is meaningless —
    // so the original guard stands, including the local-dirty protection.
    if (fresh || (remoteNewer && !isDirty)) {
      await adopt(doc);
      adoptedW[doc.key] = doc.updatedAt;
      // Record the pushed-signature too: we now hold exactly what the cloud has,
      // so the sweep below must NOT echo this value straight back up.
      adoptedP[doc.key] = sign(doc.value);
    }
    // else: keep local; the sweep below pushes it up.
  }

  await applyStamps(adoptedW, adoptedP);

  // Push local-newer data AND the direct-AsyncStorage writers the observer can't
  // see — the half of finding #1 (streaks, achievements, …) that would otherwise
  // never reach the cloud.
  await fullPushSweep(userId);
}

/**
 * Start capturing local writes and draining them. Registers the OfflineStorage
 * write observer + an AppState foreground hook (a foreground runs a full sweep so
 * even direct-AsyncStorage writes made offline get caught). Returns a cleanup
 * that unregisters both; call it when the user signs out.
 */
export function startAutoSync(userId: string): () => void {
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushOutbox(userId);
    }, FLUSH_DEBOUNCE_MS);
  };

  setWriteObserver((key) => {
    if (!isSyncedKey(key)) return;
    // Don't even queue on the free tier — see the note in fullPushSweep. The
    // observer stays registered so an upgrade mid-session starts working at the
    // very next write, with no re-login needed.
    if (!canPush()) return;
    void enqueue(key).then(scheduleFlush);
  });

  const onAppState = (state: AppStateStatus) => {
    if (state !== "active") return;
    // The radio may have changed while we were backgrounded — re-probe rather
    // than trusting a cached "offline" from three hours ago.
    invalidateConnectivityCache();
    void fullPushSweep(userId);
  };
  const sub = AppState.addEventListener("change", onAppState);

  return () => {
    setWriteObserver(null);
    sub.remove();
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  };
}
