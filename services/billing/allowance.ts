/**
 * LIFETIME ALLOWANCES — "how many times has this device EVER used X?"
 *
 * The sibling of usage.ts, and deliberately a separate store rather than a flag
 * on it. A daily meter and a lifetime allowance are different products:
 *
 *   · A DAILY METER is a rhythm. It resets, the user learns its shape, and the
 *     upgrade ask is "you clearly use this every day".
 *   · A LIFETIME ALLOWANCE is a TASTE. It never comes back, so it can be small
 *     enough to be honest about — three real uses of a premium feature, then it
 *     is a paid feature, because that is what it is.
 *
 * Mixing them in one record would mean the daily rollover (which discards the
 * whole `counts` map when the date changes) silently refunds every lifetime
 * allowance at midnight. That bug is invisible in testing and free money in
 * production, so the two stores never share a key.
 *
 * SILENT BY DESIGN. Nothing here surfaces "2 of 3 left". The feature simply
 * works until it doesn't, and then it asks — see components/gozlin/DeepDiveReader.
 * A visible countdown turns a generous trial into a metered utility and makes
 * every remaining use feel like spending rather than discovering.
 *
 * DEVICE-LOCAL, and that is fine for the same reason usage.ts gives: this
 * creates the upgrade moment for a real user. The spend boundary is the backend.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Lifetime-metered actions. Add a key here and a limit in tiers.ts. */
export type AllowanceId = "deepDive";

interface AllowanceRecord {
  counts: Partial<Record<AllowanceId, number>>;
}

const STORAGE_KEY = "@welliva_allowance";

/** In-memory mirror so a check on a tap path never awaits storage twice. */
let cache: AllowanceRecord | null = null;

async function load(): Promise<AllowanceRecord> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as AllowanceRecord) : { counts: {} };
  } catch (e) {
    // Fail generous: a read failure must not lock someone out of a feature
    // they may never have used.
    console.warn("[billing] allowance read failed, starting from zero:", e);
    cache = { counts: {} };
  }
  return cache;
}

export interface AllowanceState {
  allowed: boolean;
  used: number;
  /** Uses left, or Infinity when this tier has no limit. */
  remaining: number;
  /** The cap, or Infinity when unlimited. */
  limit: number;
}

const UNLIMITED: AllowanceState = {
  allowed: true,
  used: 0,
  remaining: Number.POSITIVE_INFINITY,
  limit: Number.POSITIVE_INFINITY,
};

/** How many times `id` has been used, ever. */
export async function getAllowanceUsed(id: AllowanceId): Promise<number> {
  return (await load()).counts[id] ?? 0;
}

/**
 * Check `id` against `limit` WITHOUT spending. `null` means unlimited.
 *
 * Call before doing the work, so the lock can be presented as an offer rather
 * than as a failure after the fact.
 */
export async function checkAllowance(
  id: AllowanceId,
  limit: number | null,
): Promise<AllowanceState> {
  if (limit === null) return UNLIMITED;
  const used = await getAllowanceUsed(id);
  return {
    allowed: used < limit,
    used,
    remaining: Math.max(0, limit - used),
    limit,
  };
}

/**
 * Spend one use of `id`, returning the state AFTER spending.
 *
 * Only call once the work actually succeeded. A deep dive that died on a dead
 * network must not consume one of three — the user got nothing for it.
 */
export async function spendAllowance(
  id: AllowanceId,
  limit: number | null,
): Promise<AllowanceState> {
  if (limit === null) return UNLIMITED;
  const record = await load();
  const used = (record.counts[id] ?? 0) + 1;
  cache = { counts: { ...record.counts, [id]: used } };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("[billing] allowance persist failed:", e);
  }
  return {
    allowed: used < limit,
    used,
    remaining: Math.max(0, limit - used),
    limit,
  };
}

/**
 * Wipe every lifetime allowance. Sign-out (the next account on this device gets
 * its own taste) and the dev tier switch.
 */
export async function resetAllowances(): Promise<void> {
  cache = { counts: {} };
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* best-effort */
  }
}
