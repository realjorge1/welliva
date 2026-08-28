/**
 * FITNESS MODULE — public barrel.
 *
 * Import from here (or the deep paths below for tree-shaking clarity):
 *
 *   import { getAllWorkouts, recommendToday } from "@/fitness";
 *
 * Layering (see docs/fitness/architecture.md):
 *   data/      — authored content (workouts, coaches)
 *   services/  — pure logic + module-owned storage
 *   hooks/     — React bindings (profile, audio, voice)
 *   components — presentational building blocks
 *
 * The module reads app state (UserBio, workoutPlan, workoutLog,
 * sessionHistory) through AppContext at the screen level and never mutates
 * it; completed sessions keep flowing through the existing
 * guided-session → session-summary → logWorkout pipeline.
 */

// Types
export * from "./types";

// Data
export { COACHES, getCoach, type CoachPersona } from "./data/coaches";
export { WORKOUTS, WORKOUT_BY_ID } from "./data/workouts";

// Services (pure)
export {
  estimateWorkoutMinutes,
  filterWorkouts,
  flattenWorkout,
  getAllWorkouts,
  getWorkout,
  isLibrarySessionId,
  resolveWorkout,
  workoutFitsEquipment,
  workoutFromSessionId,
  workoutMatchesQuery,
  workoutSuitability,
  workoutToPlayerParams,
} from "./services/WorkoutCatalog";
export {
  planFatigue,
  recentRegionLoad,
  recommendToday,
  type RecommendationInput,
  type RecoveryLevel,
} from "./services/RecommendationEngine";
export {
  buildProgressSnapshot,
  longestStreakDays,
  personalBests,
  weeklyHistory,
  weekStartOf,
  workoutStreakDays,
} from "./services/ProgressService";
export { buildCalendarMonth, shiftMonth } from "./services/CalendarService";

// Services (storage-backed)
export {
  buildFitnessExport,
  clearFitnessProfile,
  createDefaultProfile,
  loadFitnessProfile,
  rememberRecommendation,
  resetRecommendationMemory,
  saveFitnessProfile,
  subscribeFitnessProfile,
  toggleFavorite,
  updateFitnessProfile,
} from "./services/FitnessProfileStore";
export {
  cancelFitnessReminders,
  hasNotificationPermission,
  refreshFitnessReminders,
  requestNotificationPermission,
  syncFitnessReminders,
  toExpoWeekday,
  type FitnessReminderStatus,
  type FitnessReminderSync,
} from "./services/FitnessNotifications";

// Hooks
export { useFitnessProfile } from "./hooks/useFitnessProfile";

// Components
export { ArtTile } from "./components/ArtTile";
export { CoachBadge } from "./components/CoachBadge";
export { WeekBars } from "./components/WeekBars";
export { WorkoutCard } from "./components/WorkoutCard";
