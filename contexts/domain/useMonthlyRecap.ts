/**
 * useMonthlyRecap — the "Welliva Wrapped" month-end recap, extracted from
 * AppContext (M4). Assembles the deterministic RecapInput from the persisted
 * logs, exposes the archive list + a per-period builder, and runs the two
 * calm-delivery effects: surfacing the prior-month banner and stamping the
 * long-horizon storytelling (anniversaries + due stories).
 *
 * State (recapSeen / recapAvailable) stays owned by the provider and flows in
 * via props + setters; the once-per-session "recorded this recap" guard lives
 * here since only buildRecap uses it. Pure move — identical bodies + deps.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import { lifeContext } from "../../health-os";
import type { DietHistoryEntry } from "../../models/diet";
import type { NutritionTargets } from "../../models/nutrition";
import type { SessionSummaryData } from "../../models/session";
import type { UserGoals } from "../../models/user";
import type { BodyLogEntry, WorkoutLogEntry } from "../../models/workout";
import type { AchievementRecord } from "../../services/AchievementService";
import type { ChallengeRecord } from "../../services/ChallengeService";
import { currentPeriodKey, periodLabel } from "../../services/ChallengeService";
import { addEpisode } from "../../services/gozlin";
import {
  buildMonthlyRecap,
  listRecapPeriods,
  monthHasActivity,
  priorPeriodKey,
  recapEpisodeSummary,
  setRecapSeen,
  type MonthlyRecap,
  type RecapInput,
  type RecapPeriod,
} from "../../services/MonthlyRecapService";
import { parseLocalDate, todayDate } from "../../services/OfflineStorage";
import {
  ensureJourneyAnniversary,
  generateDueStories,
} from "../../services/StoryService";
import type { StreakData } from "../../services/StreakService";
import type { Trophy } from "../../services/TournamentService";

interface Params {
  isLoading: boolean;
  currentDate: string;
  userGoals: UserGoals;
  workoutLog: WorkoutLogEntry[];
  sessionHistory: SessionSummaryData[];
  dietHistory: DietHistoryEntry[];
  bodyLogs: BodyLogEntry[];
  streakData: StreakData;
  achievementRecord: AchievementRecord;
  challengeRecord: ChallengeRecord;
  trophies: Trophy[];
  nutritionTargets: NutritionTargets | null;
  recapSeen: string | null;
  setRecapSeenState: Dispatch<SetStateAction<string | null>>;
  setRecapAvailable: Dispatch<
    SetStateAction<{ periodKey: string; label: string } | null>
  >;
}

export function useMonthlyRecap({
  isLoading,
  currentDate,
  userGoals,
  workoutLog,
  sessionHistory,
  dietHistory,
  bodyLogs,
  streakData,
  achievementRecord,
  challengeRecord,
  trophies,
  nutritionTargets,
  recapSeen,
  setRecapSeenState,
  setRecapAvailable,
}: Params) {
  // Periods whose recap milestone we've already written this session — combined
  // with addEpisode's persistent id de-dupe, the memory is recorded once ever.
  const recapEpisodesRef = useRef<Set<string>>(new Set());

  const recapInput = useMemo<RecapInput>(
    () => ({
      workoutLog,
      sessionHistory,
      dietHistory,
      bodyLogs,
      streak: streakData,
      earnedAchievements: achievementRecord.earned,
      completedChallenges: challengeRecord.completed,
      trophies,
      proteinTargetG: nutritionTargets?.proteinG ?? null,
      // The app keeps only a lifetime hydration counter + the last hit date, not
      // a per-day water log — so this is the one real dated hydration signal we
      // can pass today, and a clean extension point for a future per-day log.
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
      challengeRecord.completed,
      trophies,
      nutritionTargets?.proteinG,
    ],
  );

  const availableRecapPeriods = useMemo<RecapPeriod[]>(
    () =>
      listRecapPeriods(recapInput, currentPeriodKey(parseLocalDate(currentDate))),
    [recapInput, currentDate],
  );

  const buildRecap = useCallback(
    (periodKey: string): MonthlyRecap => {
      const recap = buildMonthlyRecap(recapInput, periodKey);
      // On the first build of a month's recap, write a milestone memory so Gozlin
      // can reference the monthly arc later. De-duped by id inside the memory
      // store + a session guard so it's recorded once, ever.
      if (recap.hasActivity && !recapEpisodesRef.current.has(periodKey)) {
        recapEpisodesRef.current.add(periodKey);
        addEpisode({
          id: `recap:${periodKey}`,
          date: todayDate(),
          summary: recapEpisodeSummary(recap),
          kind: "milestone",
        }).catch(() => {});
      }
      return recap;
    },
    [recapInput],
  );

  const markRecapSeen = useCallback((periodKey: string) => {
    // Track the LATEST period seen — opening an older archived recap must not
    // re-surface a newer month's banner (YYYY-MM compares lexically).
    setRecapSeenState((prev) => {
      const next = prev && prev >= periodKey ? prev : periodKey;
      if (next !== prev) setRecapSeen(next).catch(() => {});
      return next;
    });
    setRecapAvailable((prev) =>
      prev && prev.periodKey === periodKey ? null : prev,
    );
  }, []);

  // Monthly recap availability: when a new month has rolled, the just-completed
  // prior month has real activity, and its recap hasn't been seen, surface the
  // calm banner. Never auto-navigates (RECAP_AUTO_PRESENT is OFF by default).
  // Mirrors the reconcile-effect discipline — gated on isLoading, no loops.
  useEffect(() => {
    if (isLoading) return;
    const prior = priorPeriodKey(currentPeriodKey(parseLocalDate(currentDate)));
    if (recapSeen === prior || !monthHasActivity(recapInput, prior)) {
      setRecapAvailable((prev) => (prev ? null : prev));
      return;
    }
    setRecapAvailable((prev) =>
      prev?.periodKey === prior ? prev : { periodKey: prior, label: periodLabel(prior) },
    );
  }, [isLoading, currentDate, recapSeen, recapInput]);

  // LONG-HORIZON STORYTELLING (P6) — once data is loaded, stamp the next journey
  // anniversary as a forward Life Context entry (so it flows through anticipation +
  // notifications) and generate/archive any ready year / anniversary / documentary story.
  // Idempotent + deterministic; safe to run on every load.
  useEffect(() => {
    if (isLoading) return;
    const journeyStartedAt = userGoals?.journeyStartedAt;
    void ensureJourneyAnniversary(lifeContext, journeyStartedAt);
    void generateDueStories(recapInput, journeyStartedAt);
  }, [isLoading, recapInput, userGoals?.journeyStartedAt]);

  return { availableRecapPeriods, buildRecap, markRecapSeen };
}
