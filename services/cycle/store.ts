/**
 * services/cycle/store.ts — where the cycle log lives on the phone, and whether
 * it is backed up.
 *
 * ── BACKUP IS A NAMESPACE, NOT A FLAG ───────────────────────────────────────
 * The sync engine backs up every app key it isn't told to leave alone
 * (services/sync/syncKeys — a denylist), so the three documents under
 * `@welliva_cycle_*` are backed up with the rest of the account by default —
 * the owner's call (2026-10-15).
 *
 * When she switches backup OFF, the documents MOVE to `@welliva_cycle_local_*`,
 * a prefix syncKeys keeps on the device. Moving rather than flagging buys two
 * things for free: the engine never has to ask a setting before it pushes (so a
 * cold start can't race the setting and upload anyway), and deleting the old
 * keys makes the engine's own sweep push a TOMBSTONE for each — the cloud copy
 * is erased by the mechanism that already erases everything else.
 *
 * Every move writes the destination before it removes the source, and
 * `loadCycleData` finishes a move that a crash interrupted, so no ordering of
 * failures can lose the log. The local settings document is the marker: if it
 * exists, the log is device-only.
 */

import { readString, remove, writeJSON } from "../OfflineStorage";
import { addDays } from "./dates";
import {
  isEmptyDayLog,
  normalizeDays,
  normalizePeriods,
  normalizeSettings,
  type CycleData,
  type CycleDays,
  type CycleSettings,
  type PeriodEpisode,
} from "./types";

export const CYCLE_KEYS = {
  settings: "@welliva_cycle_settings",
  periods: "@welliva_cycle_periods",
  days: "@welliva_cycle_days",
} as const;

/** Device-only twins. The prefix is in syncKeys' DEVICE_LOCAL_PREFIXES. */
export const CYCLE_LOCAL_PREFIX = "@welliva_cycle_local_";
export const CYCLE_LOCAL_KEYS = {
  settings: `${CYCLE_LOCAL_PREFIX}settings`,
  periods: `${CYCLE_LOCAL_PREFIX}periods`,
  days: `${CYCLE_LOCAL_PREFIX}days`,
} as const;

/** How long a day log is kept. Two years covers any pattern or doctor summary. */
const DAY_RETENTION_DAYS = 730;
/** A cleared day is kept this long as a merge tombstone, then dropped. */
const CLEARED_DAY_KEEP_DAYS = 180;

type Keys = typeof CYCLE_KEYS | typeof CYCLE_LOCAL_KEYS;
const keysFor = (backupOn: boolean): Keys => (backupOn ? CYCLE_KEYS : CYCLE_LOCAL_KEYS);

let chain: Promise<unknown> = Promise.resolve();
/** Serialize every read-modify-write, so two quick taps can't clobber each other. */
export function withCycleLock<T>(op: () => Promise<T>): Promise<T> {
  const run = chain.then(op, op);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function parse(raw: string | null, fallback: unknown): unknown {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function loadCycleData(): Promise<CycleData> {
  const [ls, lp, ld, ss, sp, sd] = await Promise.all([
    readString(CYCLE_LOCAL_KEYS.settings),
    readString(CYCLE_LOCAL_KEYS.periods),
    readString(CYCLE_LOCAL_KEYS.days),
    readString(CYCLE_KEYS.settings),
    readString(CYCLE_KEYS.periods),
    readString(CYCLE_KEYS.days),
  ]);
  const local = ls !== null;

  // Finish a move a crash interrupted (see the header). Both are safe given the
  // write-before-remove order: in local mode the local copies are complete, and
  // in synced mode the synced copies are. Only keys that actually exist are
  // removed — a removal is a sync event, and a tombstone pushed on every launch
  // would be churn for nothing.
  const candidates: [string | null, string][] = local
    ? [
        [ss, CYCLE_KEYS.settings],
        [sp, CYCLE_KEYS.periods],
        [sd, CYCLE_KEYS.days],
      ]
    : [
        [lp, CYCLE_LOCAL_KEYS.periods],
        [ld, CYCLE_LOCAL_KEYS.days],
      ];
  const leftovers = candidates.filter(([raw]) => raw !== null).map(([, key]) => key);
  await Promise.all(leftovers.map((k) => remove(k)));

  const normalized = normalizeSettings(parse(local ? ls : ss, null));
  return {
    settings: { ...normalized, backupOn: !local },
    periods: normalizePeriods(parse(local ? lp : sp, [])),
    days: normalizeDays(parse(local ? ld : sd, {})),
  };
}

/** Drop day logs past retention, and cleared days past their tombstone window. */
export function pruneDays(days: CycleDays, today: string): CycleDays {
  const keepFrom = addDays(today, -DAY_RETENTION_DAYS);
  const clearedFrom = addDays(today, -CLEARED_DAY_KEEP_DAYS);
  const out: CycleDays = {};
  for (const [date, log] of Object.entries(days)) {
    if (date < keepFrom) continue;
    if (isEmptyDayLog(log) && log.updatedAt.slice(0, 10) < clearedFrom) continue;
    out[date] = log;
  }
  return out;
}

export async function saveSettings(settings: CycleSettings): Promise<void> {
  await writeJSON(keysFor(settings.backupOn).settings, settings);
}

export async function savePeriods(periods: PeriodEpisode[], backupOn: boolean): Promise<void> {
  await writeJSON(keysFor(backupOn).periods, periods);
}

export async function saveDays(days: CycleDays, backupOn: boolean): Promise<void> {
  await writeJSON(keysFor(backupOn).days, days);
}

/**
 * Move the log between backed-up and device-only. Writes the destination first,
 * flips the marker, then removes the source — see the header for why that order.
 */
export async function moveCycleData(data: CycleData, backupOn: boolean): Promise<CycleData> {
  const next: CycleData = { ...data, settings: { ...data.settings, backupOn } };
  if (backupOn) {
    await writeJSON(CYCLE_KEYS.periods, next.periods);
    await writeJSON(CYCLE_KEYS.days, next.days);
    await writeJSON(CYCLE_KEYS.settings, next.settings);
    await remove(CYCLE_LOCAL_KEYS.settings);
    await remove(CYCLE_LOCAL_KEYS.periods);
    await remove(CYCLE_LOCAL_KEYS.days);
  } else {
    await writeJSON(CYCLE_LOCAL_KEYS.periods, next.periods);
    await writeJSON(CYCLE_LOCAL_KEYS.days, next.days);
    await writeJSON(CYCLE_LOCAL_KEYS.settings, next.settings);
    await remove(CYCLE_KEYS.periods);
    await remove(CYCLE_KEYS.days);
    await remove(CYCLE_KEYS.settings);
  }
  return next;
}

/** Everything, from both namespaces. The sync sweep tombstones the backed-up copies. */
export async function eraseCycleData(): Promise<void> {
  await Promise.all([
    remove(CYCLE_KEYS.settings),
    remove(CYCLE_KEYS.periods),
    remove(CYCLE_KEYS.days),
    remove(CYCLE_LOCAL_KEYS.settings),
    remove(CYCLE_LOCAL_KEYS.periods),
    remove(CYCLE_LOCAL_KEYS.days),
  ]);
}
