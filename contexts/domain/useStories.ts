/**
 * useStories — long-horizon storytelling (P6).
 *
 * Two idempotent, deterministic side effects, run once the app's logs are
 * loaded:
 *
 *   1. Stamp the next journey anniversary as a FORWARD Life Context entry, so
 *      the anticipation engine can see it coming and the notification
 *      orchestrator can deliver it. One memory, several features.
 *   2. Generate and archive any story that has come due — the calendar year,
 *      an anniversary, a five-year arc, the documentary.
 *
 * WHY IT'S ITS OWN HOOK. This used to ride along inside `useMonthlyRecap`,
 * because both features read the same shelf of logs. When the monthly recap was
 * retired, that made storytelling a passenger on a deleted feature. It isn't
 * one: the recap was a monthly novelty, whereas a story fires on horizons long
 * enough that the user has genuinely forgotten what the beginning looked like —
 * which is the only reason it lands.
 *
 * Both calls are fire-and-forget and safe to re-run on every load; the services
 * behind them de-dupe on their own persisted archive.
 */
import { useEffect, useMemo } from "react";

import { lifeContext } from "../../health-os";
import type { DietHistoryEntry } from "../../models/diet";
import type { NutritionTargets } from "../../models/nutrition";
import type { SessionSummaryData } from "../../models/session";
import type { UserGoals } from "../../models/user";
import type { BodyLogEntry, WorkoutLogEntry } from "../../models/workout";
import type { AchievementRecord } from "../../services/AchievementService";
import type { StreakData } from "../../services/StreakService";
import {
  ensureJourneyAnniversary,
  generateDueStories,
  type StoryInput,
} from "../../services/StoryService";

interface Params {
  isLoading: boolean;
  userGoals: UserGoals;
  workoutLog: WorkoutLogEntry[];
  sessionHistory: SessionSummaryData[];
  dietHistory: DietHistoryEntry[];
  bodyLogs: BodyLogEntry[];
  streakData: StreakData;
  achievementRecord: AchievementRecord;
  nutritionTargets: NutritionTargets | null;
}

export function useStories({
  isLoading,
  userGoals,
  workoutLog,
  sessionHistory,
  dietHistory,
  bodyLogs,
  streakData,
  achievementRecord,
  nutritionTargets,
}: Params) {
  const storyInput = useMemo<StoryInput>(
    () => ({
      workoutLog,
      sessionHistory,
      dietHistory,
      bodyLogs,
      streak: streakData,
      earnedAchievements: achievementRecord.earned,
      proteinTargetG: nutritionTargets?.proteinG ?? null,
      // The app keeps only a lifetime hydration counter + the last hit date,
      // not a per-day water log — so this is the one real dated hydration
      // signal available, and a clean extension point for a future day log.
      waterGoalDates: achievementRecord.lastWaterGoalDate
        ? [achievementRecord.lastWaterGoalDate]
        : [],
    }),
    [
      workoutLog,
      sessionHistory,
      dietHistory,
      bodyLogs,
      streakData,
      achievementRecord.earned,
      achievementRecord.lastWaterGoalDate,
      nutritionTargets?.proteinG,
    ],
  );

  useEffect(() => {
    if (isLoading) return;
    const journeyStartedAt = userGoals?.journeyStartedAt;
    void ensureJourneyAnniversary(lifeContext, journeyStartedAt);
    void generateDueStories(storyInput, journeyStartedAt);
  }, [isLoading, storyInput, userGoals?.journeyStartedAt]);
}
