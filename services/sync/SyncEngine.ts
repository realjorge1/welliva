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
 * CONFLICT POLICY (v1): per-key last-write-wins on the SERVER `updated_at`. Good
 * enough while the device is the source of truth and one human rarely edits two
 * phones in the same second. Live realtime propagation is a deliberate follow-up.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";
import { setWriteObserver } from "../OfflineStorage";
import { pullDocsSince, pushDoc, type RemoteDoc } from "./DocumentSync";
import {
  isSyncedKey,
  listSyncedKeys,
  OUTBOX_KEY,
  PUSHED_KEY,
  WATERMARKS_KEY,
} from "./syncKeys";

type StampMap = Record<string, string>;

/** Matches the profile-push debounce so a burst of edits costs one round-trip. */
const FLUSH_DEBOUNCE_MS = 1200;

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
 * Push every queued key to the cloud. Successes leave the queue and advance the
 * watermark + pushed-signature; failures are requeued for the next attempt.
 */
export async function flushOutbox(userId: string): Promise<void> {
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
}

/**
 * Scan every synced key, queue whatever changed since we last pushed it, plus
 * tombstones for keys that were deleted locally. THIS is what catches the
 * services that write AsyncStorage directly. Then drain.
 */
export async function fullPushSweep(userId: string): Promise<void> {
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
    void enqueue(key).then(scheduleFlush);
  });

  const onAppState = (state: AppStateStatus) => {
    if (state === "active") void fullPushSweep(userId);
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
