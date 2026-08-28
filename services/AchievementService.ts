/**
 * ACHIEVEMENT SERVICE
 *
 * The app-wide achievement system. Unlike a cosmetic badge list, every
 * achievement here is wired to REAL app data — its `metric` reads from the
 * user's actual streaks, workouts, reps, meals, protein, hydration, weigh-ins,
 * etc. You cannot "fake" an achievement: it unlocks the moment the underlying
 * number crosses its target, and locks would never appear unlocked otherwise.
 *
 * Design (Shadow-Fight style):
 *  - `AchievementStats` is a snapshot assembled by AppContext from the existing
 *    single-source-of-truth state (streakData, workoutLog, sessionHistory,
 *    dietHistory, bodyLogs, today's consumption) + one tiny persisted counter
 *    (water-goal days, the only signal not already recorded elsewhere).
 *  - `ACHIEVEMENTS` defines each goal with a pure `metric(stats)` and `target`,
 *    so progress bars come for free (`metric / target`).
 *  - The earned set is persisted so a brand-new unlock fires exactly one
 *    celebration, and pre-existing progress is reconciled silently on first run.
 *
 * No new scoring/persistence is duplicated — streaks still live in
 * StreakService; this only records what wasn't recorded before (water goal hit).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

const ACH_KEY = "@welliva_achievements";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export type AchievementCategory =
  | "streak"
  | "workout"
  | "nutrition"
  | "hydration"
  | "body";

export type AchievementTier =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "mythic"; // the multi-year summit — see TIER_META

/**
 * A snapshot of every real signal achievements can check against. Assembled by
 * AppContext from existing persisted state — see the comments per field for the
 * source of truth. Everything here is derived from data the user genuinely
 * produced, so achievements are honest.
 */
export interface AchievementStats {
  // ── Streaks & activity (← StreakService / streakData) ──
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  // ── Workouts (← workoutLog / sessionHistory) ──
  workoutsCompleted: number;
  perfectWorkouts: number; // sessions finished 100%
  totalReps: number; // lifetime reps across guided sessions
  earlyWorkouts: number; // workouts logged before 9am local
  // ── Nutrition (← dietHistory + today's schedule) ──
  mealsLogged: number; // lifetime meals marked consumed
  perfectDays: number; // days every planned meal was eaten
  proteinGoalDays: number; // days protein target was reached
  // ── Hydration (← persisted water-goal counter) ──
  waterGoalDays: number;
  // ── Body (← bodyLogs) ──
  weighIns: number;
}

export const EMPTY_STATS: AchievementStats = {
  currentStreak: 0,
  longestStreak: 0,
  totalActiveDays: 0,
  workoutsCompleted: 0,
  perfectWorkouts: 0,
  totalReps: 0,
  earlyWorkouts: 0,
  mealsLogged: 0,
  perfectDays: 0,
  proteinGoalDays: 0,
  waterGoalDays: 0,
  weighIns: 0,
};

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon: keyof typeof Ionicons.glyphMap;
  /** Pull the current value of the tracked metric out of the stats snapshot. */
  metric: (s: AchievementStats) => number;
  /** Threshold the metric must reach to unlock. */
  target: number;
  /** How to render a metric value (e.g. add a unit). */
  unit?: string;
}

/** Persisted record: which achievements are earned + the water-goal counter. */
export interface AchievementRecord {
  /** achievementId → ISO timestamp first unlocked. */
  earned: Record<string, string>;
  /** Lifetime count of days the hydration goal was reached. */
  waterGoalDays: number;
  /** Last date (YYYY-MM-DD) a water goal was credited (dedupe per day). */
  lastWaterGoalDate: string;
}

export const EMPTY_RECORD: AchievementRecord = {
  earned: {},
  waterGoalDays: 0,
  lastWaterGoalDate: "",
};

/** An achievement resolved against the current stats — ready for the UI. */
export interface EvaluatedAchievement {
  def: AchievementDef;
  value: number; // current metric value (capped at target for display)
  rawValue: number; // uncapped metric value
  target: number;
  progress: number; // 0–1
  unlocked: boolean;
  earnedAt: string | null;
}

// ──────────────────────────────────────────────
// TIER METADATA (shared by Profile + celebration)
// ──────────────────────────────────────────────

export const TIER_META: Record<
  AchievementTier,
  { label: string; color: string; points: number }
> = {
  bronze: { label: "Bronze", color: "#C68A52", points: 10 },
  silver: { label: "Silver", color: "#AEB9C4", points: 25 },
  gold: { label: "Gold", color: "#E9C16B", points: 50 },
  platinum: { label: "Platinum", color: "#5BB8E8", points: 100 },
  // Mythic is the long-haul summit: reserved for 6-month-to-multi-year feats,
  // worth a celebration that never inflates. A luminous orchid sets it apart
  // from gold/platinum on sight.
  mythic: { label: "Mythic", color: "#B57BE0", points: 250 },
};

export const CATEGORY_META: Record<
  AchievementCategory,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  streak: { label: "Consistency", icon: "flame" },
  workout: { label: "Training", icon: "barbell" },
  nutrition: { label: "Nutrition", icon: "restaurant" },
  hydration: { label: "Hydration", icon: "water" },
  body: { label: "Progress", icon: "body" },
};

// ──────────────────────────────────────────────
// ACHIEVEMENT DEFINITIONS
// ──────────────────────────────────────────────

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Consistency / streaks ──
  {
    id: "first_day",
    name: "First Step",
    description: "Log your very first day on the plan.",
    category: "streak",
    tier: "bronze",
    icon: "flag",
    metric: (s) => s.totalActiveDays,
    target: 1,
    unit: "day",
  },
  {
    id: "streak_3",
    name: "On a Roll",
    description: "Stay active 3 days in a row.",
    category: "streak",
    tier: "bronze",
    icon: "flame",
    metric: (s) => s.currentStreak,
    target: 3,
    unit: "days",
  },
  {
    id: "streak_7",
    name: "Week Warrior",
    description: "Keep a 7-day streak alive.",
    category: "streak",
    tier: "silver",
    icon: "flash",
    metric: (s) => s.currentStreak,
    target: 7,
    unit: "days",
  },
  {
    id: "streak_14",
    name: "Unstoppable",
    description: "Two full weeks without missing a beat.",
    category: "streak",
    tier: "silver",
    icon: "bonfire",
    metric: (s) => s.currentStreak,
    target: 14,
    unit: "days",
  },
  {
    id: "streak_30",
    name: "Monthly Master",
    description: "A 30-day streak — this is who you are now.",
    category: "streak",
    tier: "gold",
    icon: "medal",
    metric: (s) => s.currentStreak,
    target: 30,
    unit: "days",
  },
  {
    id: "streak_60",
    name: "Iron Will",
    description: "Sixty straight days of showing up.",
    category: "streak",
    tier: "gold",
    icon: "shield-checkmark",
    metric: (s) => s.currentStreak,
    target: 60,
    unit: "days",
  },
  {
    id: "streak_100",
    name: "Centurion",
    description: "One hundred consecutive days. Legendary.",
    category: "streak",
    tier: "platinum",
    icon: "rocket",
    metric: (s) => s.currentStreak,
    target: 100,
    unit: "days",
  },
  {
    id: "days_10",
    name: "Getting Started",
    description: "Reach 10 total active days.",
    category: "streak",
    tier: "bronze",
    icon: "leaf",
    metric: (s) => s.totalActiveDays,
    target: 10,
    unit: "days",
  },
  {
    id: "days_50",
    name: "Dedicated",
    description: "Reach 50 total active days.",
    category: "streak",
    tier: "silver",
    icon: "trophy",
    metric: (s) => s.totalActiveDays,
    target: 50,
    unit: "days",
  },
  {
    id: "days_100",
    name: "Century Club",
    description: "100 active days logged in all.",
    category: "streak",
    tier: "gold",
    icon: "diamond",
    metric: (s) => s.totalActiveDays,
    target: 100,
    unit: "days",
  },
  {
    id: "days_365",
    name: "Year of You",
    description: "365 active days. A full transformation.",
    category: "streak",
    tier: "platinum",
    icon: "infinite",
    metric: (s) => s.totalActiveDays,
    target: 365,
    unit: "days",
  },

  // ── Training ──
  {
    id: "workout_1",
    name: "First Sweat",
    description: "Finish your first guided workout.",
    category: "workout",
    tier: "bronze",
    icon: "barbell",
    metric: (s) => s.workoutsCompleted,
    target: 1,
  },
  {
    id: "workout_10",
    name: "Gym Habit",
    description: "Complete 10 workouts.",
    category: "workout",
    tier: "silver",
    icon: "fitness",
    metric: (s) => s.workoutsCompleted,
    target: 10,
  },
  {
    id: "workout_50",
    name: "Grinder",
    description: "Complete 50 workouts.",
    category: "workout",
    tier: "gold",
    icon: "trophy",
    metric: (s) => s.workoutsCompleted,
    target: 50,
  },
  {
    id: "perfect_workout",
    name: "Flawless",
    description: "Finish a workout at 100% completion.",
    category: "workout",
    tier: "silver",
    icon: "ribbon",
    metric: (s) => s.perfectWorkouts,
    target: 1,
  },
  {
    id: "early_bird",
    name: "Early Bird",
    description: "Complete a workout before 9am.",
    category: "workout",
    tier: "silver",
    icon: "sunny",
    metric: (s) => s.earlyWorkouts,
    target: 1,
  },
  {
    id: "reps_500",
    name: "500 Club",
    description: "Rack up 500 total reps.",
    category: "workout",
    tier: "silver",
    icon: "repeat",
    metric: (s) => s.totalReps,
    target: 500,
    unit: "reps",
  },
  {
    id: "reps_5000",
    name: "Rep Machine",
    description: "5,000 total reps across all sessions.",
    category: "workout",
    tier: "gold",
    icon: "flash",
    metric: (s) => s.totalReps,
    target: 5000,
    unit: "reps",
  },

  // ── Nutrition ──
  {
    id: "meals_50",
    name: "Meal Prepper",
    description: "Log 50 meals on your plan.",
    category: "nutrition",
    tier: "bronze",
    icon: "restaurant",
    metric: (s) => s.mealsLogged,
    target: 50,
    unit: "meals",
  },
  {
    id: "meals_250",
    name: "Clean Eater",
    description: "Log 250 meals on your plan.",
    category: "nutrition",
    tier: "gold",
    icon: "nutrition",
    metric: (s) => s.mealsLogged,
    target: 250,
    unit: "meals",
  },
  {
    id: "perfect_day",
    name: "Perfect Plate",
    description: "Eat every planned meal in a single day.",
    category: "nutrition",
    tier: "bronze",
    icon: "checkmark-done-circle",
    metric: (s) => s.perfectDays,
    target: 1,
  },
  {
    id: "perfect_7",
    name: "Spotless Week",
    description: "Hit 7 perfect nutrition days.",
    category: "nutrition",
    tier: "gold",
    icon: "star",
    metric: (s) => s.perfectDays,
    target: 7,
    unit: "days",
  },
  {
    id: "protein_7",
    name: "Protein Pro",
    description: "Reach your protein target on 7 days.",
    category: "nutrition",
    tier: "silver",
    icon: "egg",
    metric: (s) => s.proteinGoalDays,
    target: 7,
    unit: "days",
  },

  // ── Hydration ──
  {
    id: "hydrated_1",
    name: "Hydrated",
    description: "Reach your daily water goal once.",
    category: "hydration",
    tier: "bronze",
    icon: "water",
    metric: (s) => s.waterGoalDays,
    target: 1,
  },
  {
    id: "hydrated_14",
    name: "Water Champion",
    description: "Hit your hydration goal on 14 days.",
    category: "hydration",
    tier: "gold",
    icon: "rainy",
    metric: (s) => s.waterGoalDays,
    target: 14,
    unit: "days",
  },

  // ── Body / progress ──
  {
    id: "weigh_1",
    name: "Check-In",
    description: "Record your first weigh-in.",
    category: "body",
    tier: "bronze",
    icon: "body",
    metric: (s) => s.weighIns,
    target: 1,
  },
  {
    id: "weigh_10",
    name: "Tracking Pro",
    description: "Log 10 weigh-ins to watch the trend.",
    category: "body",
    tier: "silver",
    icon: "trending-down",
    metric: (s) => s.weighIns,
    target: 10,
  },

  // ════════════════════════════════════════════════════════════════════════
  // LONG-HAUL BAND — the multi-month → multi-year summit.
  //
  // The original tiers above all top out around ~3 months of committed effort.
  // These extend the curve so a dedicated user always has a far horizon: each
  // category climbs to a platinum mid-haul (≈6 months) and a single mythic
  // summit (≈1–3 years). This is the product's longevity backbone — the trophy
  // case can no longer be emptied in a season.
  // ════════════════════════════════════════════════════════════════════════

  // ── Consistency ──
  {
    id: "streak_180",
    name: "Half-Year Hero",
    description: "180 consecutive days. Six months unbroken.",
    category: "streak",
    tier: "platinum",
    icon: "ribbon",
    metric: (s) => s.currentStreak,
    target: 180,
    unit: "days",
  },
  {
    id: "streak_365",
    name: "Year Unbroken",
    description: "365 days in a row. A full year without missing.",
    category: "streak",
    tier: "mythic",
    icon: "infinite",
    metric: (s) => s.currentStreak,
    target: 365,
    unit: "days",
  },
  {
    id: "best_streak_50",
    name: "Personal Best",
    description: "Set a longest-streak record of 50 days.",
    category: "streak",
    tier: "gold",
    icon: "trophy",
    metric: (s) => s.longestStreak,
    target: 50,
    unit: "days",
  },
  {
    id: "days_730",
    name: "Two-Year Devotee",
    description: "730 active days. This is a way of life now.",
    category: "streak",
    tier: "mythic",
    icon: "planet",
    metric: (s) => s.totalActiveDays,
    target: 730,
    unit: "days",
  },

  // ── Training ──
  {
    id: "workout_100",
    name: "Iron Discipline",
    description: "100 workouts completed.",
    category: "workout",
    tier: "platinum",
    icon: "barbell",
    metric: (s) => s.workoutsCompleted,
    target: 100,
  },
  {
    id: "workout_250",
    name: "Seasoned Athlete",
    description: "250 workouts. Most people never get here.",
    category: "workout",
    tier: "platinum",
    icon: "fitness",
    metric: (s) => s.workoutsCompleted,
    target: 250,
  },
  {
    id: "workout_500",
    name: "Battle-Hardened",
    description: "500 workouts logged. Forged over years.",
    category: "workout",
    tier: "mythic",
    icon: "flame",
    metric: (s) => s.workoutsCompleted,
    target: 500,
  },
  {
    id: "reps_25000",
    name: "Rep Titan",
    description: "25,000 lifetime reps.",
    category: "workout",
    tier: "platinum",
    icon: "repeat",
    metric: (s) => s.totalReps,
    target: 25000,
    unit: "reps",
  },
  {
    id: "reps_100000",
    name: "Six-Figure Reps",
    description: "100,000 reps across every session you've ever done.",
    category: "workout",
    tier: "mythic",
    icon: "flash",
    metric: (s) => s.totalReps,
    target: 100000,
    unit: "reps",
  },
  {
    id: "early_25",
    name: "Dawn Patrol",
    description: "25 workouts finished before 9am.",
    category: "workout",
    tier: "gold",
    icon: "sunny",
    metric: (s) => s.earlyWorkouts,
    target: 25,
  },

  // ── Nutrition ──
  {
    id: "meals_500",
    name: "Nourished",
    description: "500 meals logged on your plan.",
    category: "nutrition",
    tier: "platinum",
    icon: "restaurant",
    metric: (s) => s.mealsLogged,
    target: 500,
    unit: "meals",
  },
  {
    id: "meals_1500",
    name: "Nutrition Master",
    description: "1,500 meals tracked. Eating well is who you are.",
    category: "nutrition",
    tier: "mythic",
    icon: "nutrition",
    metric: (s) => s.mealsLogged,
    target: 1500,
    unit: "meals",
  },
  {
    id: "perfect_30",
    name: "Flawless Month",
    description: "30 perfect nutrition days.",
    category: "nutrition",
    tier: "platinum",
    icon: "star",
    metric: (s) => s.perfectDays,
    target: 30,
    unit: "days",
  },
  {
    id: "protein_30",
    name: "Protein Machine",
    description: "Hit your protein target on 30 days.",
    category: "nutrition",
    tier: "gold",
    icon: "egg",
    metric: (s) => s.proteinGoalDays,
    target: 30,
    unit: "days",
  },
  {
    id: "protein_100",
    name: "Protein Centurion",
    description: "100 days of hitting your protein target.",
    category: "nutrition",
    tier: "platinum",
    icon: "barbell",
    metric: (s) => s.proteinGoalDays,
    target: 100,
    unit: "days",
  },

  // ── Hydration ──
  {
    id: "hydrated_50",
    name: "Hydration Hero",
    description: "Reach your water goal on 50 days.",
    category: "hydration",
    tier: "gold",
    icon: "water",
    metric: (s) => s.waterGoalDays,
    target: 50,
    unit: "days",
  },
  {
    id: "hydrated_100",
    name: "Aqua Master",
    description: "100 days of hitting your hydration goal.",
    category: "hydration",
    tier: "platinum",
    icon: "rainy",
    metric: (s) => s.waterGoalDays,
    target: 100,
    unit: "days",
  },
  {
    id: "hydrated_365",
    name: "Year of Water",
    description: "365 hydration-goal days. Effortless now.",
    category: "hydration",
    tier: "mythic",
    icon: "infinite",
    metric: (s) => s.waterGoalDays,
    target: 365,
    unit: "days",
  },

  // ── Body / progress ──
  {
    id: "weigh_50",
    name: "Trend Tracker",
    description: "50 weigh-ins. The data tells your story.",
    category: "body",
    tier: "gold",
    icon: "stats-chart",
    metric: (s) => s.weighIns,
    target: 50,
  },
  {
    id: "weigh_200",
    name: "Data Devotee",
    description: "200 weigh-ins logged over the long haul.",
    category: "body",
    tier: "mythic",
    icon: "analytics",
    metric: (s) => s.weighIns,
    target: 200,
  },
];

// ──────────────────────────────────────────────
// PERSISTENCE
// ──────────────────────────────────────────────

export async function loadAchievementRecord(): Promise<AchievementRecord> {
  try {
    const raw = await AsyncStorage.getItem(ACH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AchievementRecord>;
      return { ...EMPTY_RECORD, ...parsed, earned: parsed.earned ?? {} };
    }
  } catch (e) {
    console.error("Error loading achievements:", e);
  }
  return { ...EMPTY_RECORD };
}

export async function saveAchievementRecord(
  record: AchievementRecord,
): Promise<void> {
  try {
    await AsyncStorage.setItem(ACH_KEY, JSON.stringify(record));
  } catch (e) {
    console.error("Error saving achievements:", e);
  }
}

/**
 * Credit a water-goal day at most once per local date. Returns the updated
 * record (unchanged reference if today was already credited).
 */
export function creditWaterGoalDay(
  record: AchievementRecord,
  today: string,
): AchievementRecord {
  if (record.lastWaterGoalDate === today) return record;
  return {
    ...record,
    waterGoalDays: record.waterGoalDays + 1,
    lastWaterGoalDate: today,
  };
}

// ──────────────────────────────────────────────
// EVALUATION
// ──────────────────────────────────────────────

/** Resolve every achievement against the current stats + earned record. */
export function evaluateAchievements(
  stats: AchievementStats,
  record: AchievementRecord,
): EvaluatedAchievement[] {
  return ACHIEVEMENTS.map((def) => {
    const rawValue = Math.max(0, Math.round(def.metric(stats)));
    const unlocked = rawValue >= def.target || Boolean(record.earned[def.id]);
    return {
      def,
      rawValue,
      value: Math.min(rawValue, def.target),
      target: def.target,
      progress: def.target > 0 ? Math.min(1, rawValue / def.target) : 0,
      unlocked,
      earnedAt: record.earned[def.id] ?? null,
    };
  });
}

/**
 * Mark every newly-met achievement as earned. Returns the (possibly updated)
 * record plus the list of defs unlocked in this pass. Idempotent — already
 * earned achievements are skipped, so the same stats never re-unlock.
 */
export function reconcileEarned(
  stats: AchievementStats,
  record: AchievementRecord,
): { record: AchievementRecord; newlyUnlocked: AchievementDef[] } {
  const now = new Date().toISOString();
  const newlyUnlocked: AchievementDef[] = [];
  const earned = { ...record.earned };

  for (const def of ACHIEVEMENTS) {
    if (earned[def.id]) continue;
    if (Math.round(def.metric(stats)) >= def.target) {
      earned[def.id] = now;
      newlyUnlocked.push(def);
    }
  }

  if (newlyUnlocked.length === 0) return { record, newlyUnlocked };
  return { record: { ...record, earned }, newlyUnlocked };
}

// ──────────────────────────────────────────────
// SUMMARY / LEVELLING
// ──────────────────────────────────────────────

export interface AchievementSummary {
  earnedCount: number;
  total: number;
  points: number; // points from unlocked achievements
  maxPoints: number;
  level: number;
  levelTitle: string;
  pointsIntoLevel: number; // 0..POINTS_PER_LEVEL
  pointsForLevel: number; // POINTS_PER_LEVEL
}

const POINTS_PER_LEVEL = 100;

const LEVEL_TITLES = [
  "Newcomer",
  "Rookie",
  "Challenger",
  "Achiever",
  "Contender",
  "Veteran",
  "Champion",
  "Elite",
  "Master",
  "Legend",
  // The long-haul ladder — these only become reachable once the mythic band
  // and seasonal challenges start compounding points over many months.
  "Mythic",
  "Titan",
  "Immortal",
  "Ascendant",
  "Transcendent",
  "Welliva Icon",
];

export function getAchievementSummary(
  evaluated: EvaluatedAchievement[],
): AchievementSummary {
  const total = evaluated.length;
  let earnedCount = 0;
  let points = 0;
  let maxPoints = 0;
  for (const a of evaluated) {
    const p = TIER_META[a.def.tier].points;
    maxPoints += p;
    if (a.unlocked) {
      earnedCount += 1;
      points += p;
    }
  }
  const level = Math.floor(points / POINTS_PER_LEVEL) + 1;
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  return {
    earnedCount,
    total,
    points,
    maxPoints,
    level,
    levelTitle: title,
    pointsIntoLevel: points % POINTS_PER_LEVEL,
    pointsForLevel: POINTS_PER_LEVEL,
  };
}

/**
 * The most recently unlocked achievement — the one line worth showing when
 * there's only room for one.
 *
 * Ties are broken by tier value rather than array order: two achievements
 * earned in the same reconcile pass share a timestamp to the millisecond, and
 * "you just hit Hydration Legend" is a better thing to have surfaced than the
 * bronze that came with it.
 */
export function getLatestUnlocked(
  evaluated: EvaluatedAchievement[],
): EvaluatedAchievement | null {
  let best: EvaluatedAchievement | null = null;
  for (const a of evaluated) {
    if (!a.unlocked || !a.earnedAt) continue;
    if (!best) {
      best = a;
      continue;
    }
    if (a.earnedAt > best.earnedAt!) {
      best = a;
    } else if (a.earnedAt === best.earnedAt! &&
      TIER_META[a.def.tier].points > TIER_META[best.def.tier].points) {
      best = a;
    }
  }
  return best;
}

/** Next not-yet-reached streak milestone, for the "X days to …" nudge. */
export function getNextStreakMilestone(
  currentStreak: number,
): { def: AchievementDef; remaining: number } | null {
  const milestones = ACHIEVEMENTS.filter((d) => d.id.startsWith("streak_")).sort(
    (a, b) => a.target - b.target,
  );
  for (const def of milestones) {
    if (currentStreak < def.target) {
      return { def, remaining: def.target - currentStreak };
    }
  }
  return null;
}
