/**
 * STREAK SERVICE
 * Tracks the daily-commitment streak — the days you showed up for yourself.
 * Offline-first — all data stored in AsyncStorage.
 *
 * What a streak MEANS, and how it is read back, lives in ./commitment (pure).
 * This file owns the record and its writes.
 *
 * ── TWO RULES THIS FILE NOW KEEPS (2026-10-15) ─────────────────────────────
 *
 * 1. A LOADED STREAK IS THE LIVE STREAK. `currentStreak` is stored as "the run
 *    as of the last kept day", which stops being true two days later. Every
 *    load now returns the run as it stands today (0 once it has lapsed), so
 *    Home, the achievements, Gozlin and the moment engine all read the truth
 *    instead of a number that froze the day the user stopped.
 *
 * 2. ONLY TODAY CAN BE CREDITED. A meal back-logged for yesterday used to be
 *    handed to `recordActivity(yesterday)`, which saw a "gap" and rewound a
 *    live run to 1. Keeping a past day is not something a streak can honestly
 *    accept after the fact, so anything but today is ignored.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { liveStreak, readCommitment, withKeptDay } from "./commitment";
import { emitExternalWrite } from "./notifications/externalWrites";
import { parseLocalDate, toLocalDateString, todayDate } from "./OfflineStorage";

// Storage key
const STREAK_KEY = "@welliva_streak_data";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface StreakData {
  currentStreak: number; // consecutive days kept — LIVE as of the last load
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  totalActiveDays: number;
  badges: Badge[];
  /**
   * Mon–Sun of the CURRENT week, true if kept. Derived from `days` on every
   * load; kept on the record only for older readers of the shape.
   */
  weekActivity: boolean[];
  /**
   * Every kept date, ascending (YYYY-MM-DD), capped. The ledger the week strip
   * is read from. Absent on records written before 2026-10-15 — the current
   * run is reconstructed for those (see commitment.readCommitment).
   */
  days?: string[];
}

export interface Badge {
  id: string;
  name: string;
  icon: string; // emoji
  description: string;
  earnedAt: string; // ISO timestamp
}

const DEFAULT_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: "",
  totalActiveDays: 0,
  badges: [],
  weekActivity: [false, false, false, false, false, false, false],
  days: [],
};

// ──────────────────────────────────────────────
// BADGE DEFINITIONS
// ──────────────────────────────────────────────

interface BadgeDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  check: (data: StreakData) => boolean;
}

// `icon` is an Ionicons glyph name (premium icon set), not an emoji. The
// Profile screen renders it via IconBadge; keep these names valid Ionicons.
const BADGE_DEFINITIONS: BadgeDef[] = [
  {
    id: "first_day",
    name: "First Step",
    icon: "flag",
    description: "Logged your first day",
    check: (d) => d.totalActiveDays >= 1,
  },
  {
    id: "streak_3",
    name: "On a Roll",
    icon: "flame",
    description: "3-day streak",
    check: (d) => d.currentStreak >= 3,
  },
  {
    id: "streak_7",
    name: "Week Warrior",
    icon: "flash",
    description: "7-day streak",
    check: (d) => d.currentStreak >= 7,
  },
  {
    id: "streak_14",
    name: "Unstoppable",
    icon: "barbell",
    description: "14-day streak",
    check: (d) => d.currentStreak >= 14,
  },
  {
    id: "streak_30",
    name: "Monthly Master",
    icon: "medal",
    description: "30-day streak",
    check: (d) => d.currentStreak >= 30,
  },
  {
    id: "days_10",
    name: "Getting Started",
    icon: "leaf",
    description: "10 total active days",
    check: (d) => d.totalActiveDays >= 10,
  },
  {
    id: "days_50",
    name: "Dedicated",
    icon: "trophy",
    description: "50 total active days",
    check: (d) => d.totalActiveDays >= 50,
  },
  {
    id: "days_100",
    name: "Century Club",
    icon: "diamond",
    description: "100 total active days",
    check: (d) => d.totalActiveDays >= 100,
  },
];

// ──────────────────────────────────────────────
// THE MOMENT A DAY IS KEPT
// ──────────────────────────────────────────────

/**
 * Fired once per day per device, the moment `recordActivity` turns today from
 * open to kept — whichever writer did it (a meal tick, the food log, a
 * workout, a lock-screen button while the app is alive).
 *
 * WHY AN EVENT AND NOT A STATE WATCHER. Watching `lastActiveDate` change in
 * React state cannot tell a day kept just now from a record that merely
 * arrived: the launch load, a re-hydrate after sign-in, a cloud copy from
 * another device. Each of those would have fired the flame for something
 * nobody just did. This fires only where the day actually turns.
 */
type KeptListener = (data: StreakData) => void;
const keptListeners = new Set<KeptListener>();

export function onCommitmentKept(fn: KeptListener): () => void {
  keptListeners.add(fn);
  return () => {
    keptListeners.delete(fn);
  };
}

function announceKept(data: StreakData): void {
  for (const fn of [...keptListeners]) {
    try {
      fn(data);
    } catch {
      // one bad listener must not stop the others
    }
  }
}

// ──────────────────────────────────────────────
// PUBLIC API
// ──────────────────────────────────────────────

/**
 * The record as it stands on `today`: the run made live (0 once lapsed) and
 * the week re-derived from the dated ledger. Pure — nothing is written back;
 * the next kept day rewrites the run anyway.
 */
function asOf(raw: StreakData, today: string): StreakData {
  const data: StreakData = { ...DEFAULT_STREAK, ...raw };
  data.currentStreak = liveStreak(data, today);
  data.weekActivity = readCommitment(data, today).week.map((d) => d.kept);
  return data;
}

/**
 * Load streak data from storage, as of today.
 */
export async function loadStreakData(): Promise<StreakData> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    if (raw) return asOf(JSON.parse(raw) as StreakData, todayDate());
  } catch (e) {
    console.error("Error loading streak data:", e);
  }
  return { ...DEFAULT_STREAK, days: [] };
}

/**
 * Record today as kept. Call whenever the user logs a meal, completes a
 * workout, etc. — anything that counts as showing up (see ./commitment).
 * Returns the updated streak data and any newly earned badges.
 *
 * A date other than today is ignored (see rule 2 in the header).
 */
export async function recordActivity(
  today: string,
): Promise<{ data: StreakData; newBadges: Badge[] }> {
  const data = await loadStreakData();

  if (today !== todayDate() || data.lastActiveDate === today) {
    // Already kept today — or not today at all. Nothing moves.
    return { data, newBadges: [] };
  }

  // Check if yesterday was active (streak continues) or not (streak resets)
  const yesterday = getYesterday(today);
  if (data.lastActiveDate === yesterday) {
    data.currentStreak += 1;
  } else {
    data.currentStreak = 1;
  }

  data.lastActiveDate = today;
  data.totalActiveDays += 1;
  if (data.currentStreak > data.longestStreak) {
    data.longestStreak = data.currentStreak;
  }

  data.days = withKeptDay(data.days, today);
  data.weekActivity = readCommitment(data, today).week.map((d) => d.kept);

  // Check for new badges
  const existingIds = new Set(data.badges.map((b) => b.id));
  const newBadges: Badge[] = [];
  for (const def of BADGE_DEFINITIONS) {
    if (!existingIds.has(def.id) && def.check(data)) {
      const badge: Badge = {
        id: def.id,
        name: def.name,
        icon: def.icon,
        description: def.description,
        earnedAt: new Date().toISOString(),
      };
      data.badges.push(badge);
      newBadges.push(badge);
    }
  }

  // Persist
  await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(data));
  announceKept(data);

  return { data, newBadges };
}

/**
 * Keep today from OUTSIDE AppContext — the food log, a weigh-in, a check-in,
 * a habit, the water goal. Records the day and announces it on the
 * external-write bus, which AppContext listens to, so the streak (and the
 * day's flame) update wherever the write came from. Never throws.
 */
export async function creditCommitment(date: string = todayDate()): Promise<void> {
  if (date !== todayDate()) return;
  try {
    // Only a day that actually moves is announced; the tenth meal logged today
    // must not make every listener re-read the record.
    const prior = await loadStreakData();
    if (prior.lastActiveDate === date) return;
    await recordActivity(date);
    emitExternalWrite({ kind: "streak", date });
  } catch {
    // a failed credit must never break the write that earned it
  }
}

/**
 * The record at app launch. Kept under its old name for the loader; the week
 * no longer needs a Monday reset — it is derived from the dated ledger.
 */
export async function resetWeekIfNeeded(_today: string): Promise<StreakData> {
  return loadStreakData();
}

/**
 * Get all possible badge definitions (for badge showcase).
 */
export function getAllBadgeDefinitions(): BadgeDef[] {
  return BADGE_DEFINITIONS;
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function getYesterday(todayStr: string): string {
  const d = parseLocalDate(todayStr);
  d.setDate(d.getDate() - 1);
  return toLocalDateString(d);
}
