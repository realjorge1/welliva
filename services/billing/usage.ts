/**
 * USAGE METERS — "how many coach turns has this user spent today?"
 *
 * A tiny date-scoped counter store. It backs the free tier's daily coach cap and
 * the Pro fair-use ceiling, and it is deliberately generic so the photo-scan cap
 * (docs/monetization — Tier 3) reuses it rather than inventing a second store.
 *
 * WHY THE COUNT IS DEVICE-LOCAL, AND WHY THAT IS FINE
 *
 * Someone could reinstall, or clear storage, and get three more coach turns.
 * That is accepted: this meter's job is to create the upgrade MOMENT for a real
 * user who has felt the value, not to be a security boundary. The boundary is
 * server-side — the backend counts against the Supabase user id and 402s past
 * the cap (docs/monetization/setup.md Part 6). Enforcing here as well is what
 * makes the limit feel like a product decision (an explained cap, shown before
 * the send) instead of a network error after one.
 *
 * DAY BOUNDARY
 *
 * Keyed on the LOCAL calendar date via the same helper the rest of the app uses
 * for its day rollover, so "today" here is the same "today" the diet plan, the
 * streak engine and the habit tracker mean. A UTC boundary would reset a user's
 * allowance mid-evening in the Americas.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { toLocalDateString } from "../OfflineStorage";

/** Metered actions. Add a key here and a limit in tiers.ts — nothing else. */
export type MeterId = "coach" | "photoScan";

interface UsageRecord {
  /** Local `YYYY-MM-DD` these counts belong to. */
  date: string;
  counts: Partial<Record<MeterId, number>>;
}

const STORAGE_KEY = "@welliva_usage";

/**
 * In-memory mirror, so a quota check on the send path doesn't have to await
 * storage. Hydrated on first use and written through on every bump.
 */
let cache: UsageRecord | null = null;

function today(): string {
  return toLocalDateString(new Date());
}

function emptyFor(date: string): UsageRecord {
  return { date, counts: {} };
}

/**
 * Read the record for today, rolling over (and discarding) yesterday's counts.
 * The rollover happens on read rather than on a timer, so an app left open
 * across midnight still gets a fresh allowance the moment it next asks.
 */
async function load(): Promise<UsageRecord> {
  const date = today();
  if (cache && cache.date === date) return cache;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UsageRecord;
      cache = parsed.date === date ? parsed : emptyFor(date);
    } else {
      cache = emptyFor(date);
    }
  } catch (e) {
    // A read failure must not block the feature. Starting from zero is the
    // generous direction, which is the right way to fail on a paid product.
    console.warn("[billing] usage read failed, starting today at zero:", e);
    cache = emptyFor(date);
  }
  return cache;
}

async function persist(record: UsageRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (e) {
    console.warn("[billing] usage persist failed:", e);
  }
}

/** How many times `id` has been used today. */
export async function getUsage(id: MeterId): Promise<number> {
  return (await load()).counts[id] ?? 0;
}

export interface QuotaState {
  /** Whether one more use is permitted right now. */
  allowed: boolean;
  used: number;
  /** Uses left today. Never negative. */
  remaining: number;
  limit: number;
}

/**
 * Check `id` against `limit` without spending anything. Call this BEFORE doing
 * the work, so the UI can explain the cap instead of failing the action.
 */
export async function checkQuota(id: MeterId, limit: number): Promise<QuotaState> {
  const used = await getUsage(id);
  return {
    allowed: used < limit,
    used,
    remaining: Math.max(0, limit - used),
    limit,
  };
}

/**
 * Spend one use of `id` and return the state AFTER spending.
 *
 * Only call this once the metered work has actually been committed — a turn that
 * failed to reach the backend must not cost the user one of three. The coach
 * path bumps after a successful send for exactly that reason.
 */
export async function recordUsage(id: MeterId, limit: number): Promise<QuotaState> {
  const record = await load();
  const used = (record.counts[id] ?? 0) + 1;
  cache = { ...record, counts: { ...record.counts, [id]: used } };
  await persist(cache);
  return {
    allowed: used < limit,
    used,
    remaining: Math.max(0, limit - used),
    limit,
  };
}

/**
 * Wipe all meters. Used on sign-out (the next account on this device must not
 * inherit a spent allowance) and by the dev tools.
 */
export async function resetUsage(): Promise<void> {
  cache = emptyFor(today());
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* best-effort */
  }
}
