/**
 * OFFLINE STORAGE SERVICE
 * Single source of truth for all local persistence via AsyncStorage.
 *
 * All reads/writes go through this service to prevent key conflicts
 * and ensure consistent serialization.
 *
 * Storage Schema:
 * - @welliva_user_bio          → UserBio
 * - @welliva_user_goals        → UserGoals
 * - @welliva_plan_state        → PlanState
 * - @welliva_today_nutrition   → TodayNutrition (date-stamped)
 * - @welliva_scheduled_diets   → ScheduledDiet[]
 * - @welliva_week_schedules    → WeekSchedule[]
 * - @welliva_diet_history      → DietHistoryEntry[]
 * - @welliva_workout_plan      → GeneratedWorkoutPlan
 * - @welliva_workout_logs      → WorkoutLog[]
 * - @welliva_body_logs         → BodyLogEntry[]
 * - @welliva_last_active_date  → string (YYYY-MM-DD)
 * - @welliva_onboarding_done   → "true" | null
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ============================================================================
// WRITE OBSERVER — a single optional hook fired after every successful mutation
// through this service. The sync engine registers it (services/sync) to notice
// local changes and queue them for the cloud, WITHOUT this module importing any
// sync/React code. Off by default, so tests and the pre-sync app are unaffected.
//
// NOTE: this only observes writes that go THROUGH OfflineStorage. Several
// services write AsyncStorage directly (StreakService, AchievementService, …);
// the sync engine's periodic full-push sweep is what covers those. Do not rely
// on this observer alone for completeness.
// ============================================================================
let onWrite: ((key: string) => void) | null = null;

/** Register (or clear, with null) the post-write observer. */
export function setWriteObserver(fn: ((key: string) => void) | null): void {
  onWrite = fn;
}

function notifyWrite(key: string): void {
  try {
    onWrite?.(key);
  } catch {
    // The observer must never break the write it's observing.
  }
}

// ============================================================================
// STORAGE KEYS (centralized, no duplication)
// ============================================================================
export const KEYS = {
  USER_BIO: "@welliva_user_bio",
  USER_GOALS: "@welliva_user_goals",
  PLAN_STATE: "@welliva_plan_state",
  TODAY_NUTRITION: "@welliva_today_nutrition",
  SCHEDULED_DIETS: "@welliva_scheduled_diets",
  WEEK_SCHEDULES: "@welliva_week_schedules",
  DIET_HISTORY: "@welliva_diet_history",
  WORKOUT_PLAN: "@welliva_workout_plan",
  WORKOUT_LOGS: "@welliva_workout_logs",
  BODY_LOGS: "@welliva_body_logs",
  LAST_ACTIVE_DATE: "@welliva_last_active_date",
  LAST_CHECKED_DATE: "@welliva_last_checked_date",
  ONBOARDING_DONE: "@welliva_onboarding_done",
  NUTRITION_HISTORY: "@welliva_nutrition_history",
  WATER_HISTORY: "@welliva_water_history",
  EXERCISE_HISTORY: "@welliva_exercise_history",
  WATER_TODAY: "@welliva_water_today",
  WORKOUT_LOG: "@welliva_workout_log",
  THEME_MODE: "themeMode",
  /** Server `updated_at` of the last profile row we reconciled with (cloud sync). */
  PROFILE_SYNCED_AT: "@welliva_profile_synced_at",
  /** Rolling log of recent sync attempts + failure counters (SyncTelemetry). */
  SYNC_TELEMETRY: "@welliva_sync_telemetry",

  // --- Flexible planning (MealPlanService) ---------------------------------
  /** All MealPlanPeriods, newest first — active, scheduled and the archive. */
  MEAL_PLAN_PERIODS: "@welliva_meal_plan_periods",
  /** Hand-picked menus keyed by period id (custom mode). */
  CUSTOM_MENUS: "@welliva_custom_menus",
  /** Reusable meals the user defined, for one-tap re-picking. */
  SAVED_MEALS: "@welliva_saved_meals",
  /** Cached end-of-period reports, so an archived report never recomputes. */
  PERIOD_REPORTS: "@welliva_period_reports",

  // --- Free-form nutrition logging (FoodLogService) ------------------------
  /** Ad-hoc resolved foods logged per date, outside any planned meal. */
  FOOD_LOG: "@welliva_food_log",

  // --- Engagement -----------------------------------------------------------
  /** TrackingMode: which domains this user actually wants tracked. */
  TRACKING_MODE: "@welliva_tracking_mode",
  /** User overrides for daily nutrition targets, when they set their own. */
  CUSTOM_TARGETS: "@welliva_custom_targets",
} as const;

// ============================================================================
// GENERIC HELPERS
// ============================================================================

/** Read and parse JSON from AsyncStorage. Returns fallback on miss/error. */
export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`OfflineStorage.readJSON(${key}):`, e);
    return fallback;
  }
}

/** Write JSON to AsyncStorage. */
export async function writeJSON<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    notifyWrite(key);
  } catch (e) {
    console.error(`OfflineStorage.writeJSON(${key}):`, e);
  }
}

/** Read a plain string. Returns fallback on miss. */
export async function readString(
  key: string,
  fallback: string | null = null,
): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(key)) ?? fallback;
  } catch (e) {
    console.error(`OfflineStorage.readString(${key}):`, e);
    return fallback;
  }
}

/** Write a plain string. */
export async function writeString(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
    notifyWrite(key);
  } catch (e) {
    console.error(`OfflineStorage.writeString(${key}):`, e);
  }
}

/** Remove a key. */
export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
    notifyWrite(key);
  } catch (e) {
    console.error(`OfflineStorage.remove(${key}):`, e);
  }
}

// ============================================================================
// DATE HELPERS — single authority. All "today" logic is LOCAL time.
// Never use `new Date().toISOString().split("T")[0]` (that is UTC and rolls
// over at the wrong moment for any user not on UTC).
// ============================================================================

/** Format a Date as YYYY-MM-DD in LOCAL time. */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string into a Date at LOCAL midnight.
 * `new Date("2026-06-16")` parses as UTC midnight, so `.getDay()` can return
 * the wrong weekday in non-UTC zones — this avoids that drift.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Returns today as YYYY-MM-DD in local time. */
export function todayDate(): string {
  return toLocalDateString(new Date());
}

/** Returns the Monday of the current week as YYYY-MM-DD (local time). */
export function currentWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun,1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return toLocalDateString(monday);
}

// ============================================================================
// WATER HISTORY — daily hydration totals, archived at day-end so today's
// counter (WATER_TODAY) can reset to 0 without losing the record.
// ============================================================================

/** One archived day of hydration. `ml` is the total consumed that day. */
export interface WaterHistoryEntry {
  date: string; // YYYY-MM-DD (local)
  ml: number; // total water consumed that day
  goalMl?: number; // the daily goal in effect that day, if known
}

/** Keep the archive bounded — roughly three months of daily entries. */
const WATER_HISTORY_MAX = 90;

/**
 * Archive a day's hydration total into history. Idempotent per date
 * (re-archiving the same day overwrites), sorted ascending, capped to the most
 * recent WATER_HISTORY_MAX days. No-ops for a missing/zero day so we don't
 * persist empty placeholder entries.
 */
export async function archiveWaterDay(
  date: string,
  ml: number,
  goalMl?: number,
): Promise<void> {
  if (!date || ml <= 0) return;
  const history = await readJSON<WaterHistoryEntry[]>(KEYS.WATER_HISTORY, []);
  const next = history.filter((e) => e.date !== date);
  next.push(goalMl != null ? { date, ml, goalMl } : { date, ml });
  next.sort((a, b) => a.date.localeCompare(b.date));
  await writeJSON(KEYS.WATER_HISTORY, next.slice(-WATER_HISTORY_MAX));
}

/** All archived hydration days, oldest first. */
export async function getWaterHistory(): Promise<WaterHistoryEntry[]> {
  return readJSON<WaterHistoryEntry[]>(KEYS.WATER_HISTORY, []);
}
