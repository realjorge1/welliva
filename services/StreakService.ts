/**
 * STREAK SERVICE
 * Tracks daily activity streaks, badges, and motivational data.
 * Offline-first — all data stored in AsyncStorage.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseLocalDate, toLocalDateString } from "./OfflineStorage";

// Storage key
const STREAK_KEY = "@welliva_streak_data";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface StreakData {
  currentStreak: number; // consecutive days active
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  totalActiveDays: number;
  badges: Badge[];
  weekActivity: boolean[]; // Mon-Sun, true if active
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
// PUBLIC API
// ──────────────────────────────────────────────

/**
 * Load streak data from storage.
 */
export async function loadStreakData(): Promise<StreakData> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw) as StreakData;
  } catch (e) {
    console.error("Error loading streak data:", e);
  }
  return { ...DEFAULT_STREAK };
}

/**
 * Record today as active. Call whenever the user logs a meal, completes a workout, etc.
 * Returns the updated streak data and any newly earned badges.
 */
export async function recordActivity(
  today: string,
): Promise<{ data: StreakData; newBadges: Badge[] }> {
  const data = await loadStreakData();

  if (data.lastActiveDate === today) {
    // Already recorded today — just return current state
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

  // Update week activity (Mon = 0, Sun = 6)
  const dayOfWeek = parseLocalDate(today).getDay();
  const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  data.weekActivity[adjustedDay] = true;

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

  return { data, newBadges };
}

/**
 * Reset week activity at the start of a new week.
 */
export async function resetWeekIfNeeded(today: string): Promise<StreakData> {
  const data = await loadStreakData();
  const dayOfWeek = parseLocalDate(today).getDay();
  const isMonday = dayOfWeek === 1;

  // If today is Monday and last active wasn't today, reset the week
  if (isMonday && data.lastActiveDate !== today) {
    data.weekActivity = [false, false, false, false, false, false, false];
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(data));
  }

  return data;
}

/**
 * Get a motivational message based on streak data.
 */
export function getMotivationalMessage(data: StreakData): string {
  if (data.currentStreak === 0) {
    return "Start your streak today! Every journey begins with one step.";
  }
  if (data.currentStreak === 1) {
    return "Day 1 — you've got this! Come back tomorrow to build your streak.";
  }
  if (data.currentStreak < 3) {
    return `${data.currentStreak} days in! Keep going, you're building a habit.`;
  }
  if (data.currentStreak < 7) {
    return `${data.currentStreak}-day streak — you're on a roll.`;
  }
  if (data.currentStreak < 14) {
    return `${data.currentStreak} days strong. This is becoming a lifestyle.`;
  }
  if (data.currentStreak < 30) {
    return `${data.currentStreak}-day streak — you're in the top 10% of users.`;
  }
  return `${data.currentStreak}-day streak. Absolutely remarkable consistency.`;
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
