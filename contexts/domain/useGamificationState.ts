/**
 * useGamificationState — streaks, achievements and journey chapters, extracted
 * from AppContext (M4).
 *
 * Owns the achievementStats hub derivation, the achievement evaluation, the two
 * reconcile effects (which unlock + celebrate), the celebration queue writer,
 * and the startNewChapter / refreshStreak handlers. State + records stay owned by the provider and flow in via props +
 * setters; the "latest record" refs and silent-first-pass guards live here since
 * only these effects use them. Pure move — identical bodies + dependency arrays.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { Palette } from "../../constants/theme";
import type { DietHistoryEntry, TodayDiet } from "../../models/diet";
import type { NutritionTargets } from "../../models/nutrition";
import type { PlanState } from "../../models/planState";
import type { SessionSummaryData } from "../../models/session";
import type { PrimaryGoal, UserBio, UserGoals } from "../../models/user";
import type { BodyLogEntry, WorkoutLogEntry } from "../../models/workout";
import type { ConsumedNutrition } from "../AppContext";
import {
  AchievementRecord,
  AchievementStats,
  deriveActivityCalendar,
  EvaluatedAchievement,
  evaluateAchievements,
  getAchievementSummary,
  reconcileEarned,
  saveAchievementRecord,
} from "../../services/AchievementService";
import {
  Celebration,
  celebrationForChapter,
  celebrationFromAchievement,
  celebrationFromMoment,
} from "../../services/CelebrationService";
import {
  goalSignature,
  isGoalReached,
  JourneyRecord,
  saveJourney,
} from "../../services/JourneyService";
import {
  detectMoments,
  detectNudge,
  loadMomentRecord,
  saveMomentRecord,
  EMPTY_MOMENT_RECORD,
  type MomentInput,
  type MomentRecord,
  type Nudge,
} from "../../services/MomentEngine";
import { addEpisode, rememberMotivation } from "../../services/gozlin";
import { calculateNutritionTargets } from "../../services/NutritionService";
import {
  KEYS,
  todayDate,
  writeJSON,
} from "../../services/OfflineStorage";
import { StreakData, loadStreakData } from "../../services/StreakService";

/** Human label per goal — used in chapter celebrations + Gozlin memory. */
const GOAL_LABEL: Record<PrimaryGoal, string> = {
  lose_weight: "weight loss",
  build_muscle: "muscle building",
  improve_fitness: "fitness",
  increase_energy: "energy",
  better_health: "health",
  athletic_performance: "performance",
};

interface Params {
  isLoading: boolean;
  currentDate: string;
  userBio: UserBio | null;
  userGoals: UserGoals;
  planState: PlanState;
  todayDiet: TodayDiet | null;
  nutritionTargets: NutritionTargets | null;
  consumedNutrition: ConsumedNutrition;
  dietHistory: DietHistoryEntry[];
  workoutLog: WorkoutLogEntry[];
  sessionHistory: SessionSummaryData[];
  bodyLogs: BodyLogEntry[];
  streakData: StreakData;
  achievementRecord: AchievementRecord;
  journey: JourneyRecord;
  setAchievementRecord: Dispatch<SetStateAction<AchievementRecord>>;
  setJourney: Dispatch<SetStateAction<JourneyRecord>>;
  setCelebrations: Dispatch<SetStateAction<Celebration[]>>;
  setStreakData: Dispatch<SetStateAction<StreakData>>;
  setUserBio: Dispatch<SetStateAction<UserBio | null>>;
  setNutritionTargets: Dispatch<SetStateAction<NutritionTargets | null>>;
  setUserGoals: Dispatch<SetStateAction<UserGoals>>;
  setPlanState: Dispatch<SetStateAction<PlanState>>;
}

export function useGamificationState({
  isLoading,
  currentDate,
  userBio,
  userGoals,
  planState,
  todayDiet,
  nutritionTargets,
  consumedNutrition,
  dietHistory,
  workoutLog,
  sessionHistory,
  bodyLogs,
  streakData,
  achievementRecord,
  journey,
  setAchievementRecord,
  setJourney,
  setCelebrations,
  setStreakData,
  setUserBio,
  setNutritionTargets,
  setUserGoals,
  setPlanState,
}: Params) {
  // Latest records, readable inside effects without re-subscribing (avoids loops).
  const achievementRecordRef = useRef(achievementRecord);
  achievementRecordRef.current = achievementRecord;
  const journeyRef = useRef(journey);
  journeyRef.current = journey;
  // First reconcile after load is silent — pre-existing progress shouldn't
  // trigger a flood of celebrations; only genuinely new unlocks celebrate.
  const achievementsReconciledRef = useRef(false);

  /**
   * Queue celebrations + record each as a lasting Gozlin memory, so the coach
   * remembers every win and milestone and can bring them up later. De-duped by
   * id inside the memory store, so the same moment is never stored twice.
   */
  const pushCelebrations = useCallback(
    (items: Celebration[]) => {
      if (items.length === 0) return;
      setCelebrations((prev) => [...prev, ...items]);
      for (const c of items) {
        // Chapters and the rare mythic tier are milestones; everything else a win.
        const isMilestone =
          c.kind === "chapter" || c.eyebrow.startsWith("MYTHIC");
        addEpisode({
          id: c.id,
          date: todayDate(),
          summary: `${c.eyebrow.toLowerCase()}: ${c.title}`,
          kind: isMilestone ? "milestone" : "win",
        }).catch(() => {});
      }
    },
    [setCelebrations],
  );

  /**
   * Every day that carries a real record — a finished workout, a weigh-in, or a
   * day of eating that wasn't skipped. This is what the calendar achievements
   * (months, weeks, comebacks) are measured against.
   *
   * The three logs are unioned rather than read off streakData because a streak
   * is a COUNT: it can tell you 40 days happened, never WHICH days, and every
   * calendar metric here is a question about which.
   */
  const activityCalendar = useMemo(() => {
    const days: string[] = [];
    for (const w of workoutLog) if (w.date) days.push(w.date);
    for (const b of bodyLogs) if (b.date) days.push(b.date);
    for (const d of dietHistory) {
      if (d.date && d.status !== "skipped") days.push(d.date);
    }
    return deriveActivityCalendar(days, currentDate);
  }, [workoutLog, bodyLogs, dietHistory, currentDate]);

  const achievementStats = useMemo<AchievementStats>(() => {
    // Today's nutrition signals (live, before day-end writes them to history).
    const sched = todayDiet?.schedule;
    const todayMeals = sched
      ? [sched.breakfast, sched.lunch, sched.dinner, ...sched.snacks].filter(
          (m): m is NonNullable<typeof m> => m != null,
        )
      : [];
    const todayConsumedCount = todayMeals.filter((m) => m.isConsumed).length;
    const coreMeals = sched
      ? [sched.breakfast, sched.lunch, sched.dinner].filter((m) => m != null)
      : [];
    const todayAllConsumed =
      todayMeals.length > 0 &&
      coreMeals.length >= 3 &&
      todayMeals.every((m) => m.isConsumed);
    const proteinTarget = nutritionTargets
      ? nutritionTargets.proteinG * 0.9
      : Infinity;
    const todayProteinHit = consumedNutrition.proteinG >= proteinTarget;

    // History-derived lifetime totals (locked once a day ends — non-gameable).
    const historyMeals = dietHistory.reduce(
      (sum, d) => sum + (d.mealsConsumed || 0),
      0,
    );
    const historyPerfect = dietHistory.filter(
      (d) => d.status === "completed",
    ).length;
    const historyProtein = dietHistory.filter(
      (d) =>
        d.consumedProteinG != null && d.consumedProteinG >= proteinTarget,
    ).length;

    return {
      currentStreak: streakData.currentStreak,
      longestStreak: streakData.longestStreak,
      totalActiveDays: streakData.totalActiveDays,
      workoutsCompleted: workoutLog.length,
      perfectWorkouts: workoutLog.filter((l) => l.completionPercent >= 100)
        .length,
      totalReps: sessionHistory.reduce((sum, s) => sum + (s.totalReps || 0), 0),
      earlyWorkouts: workoutLog.filter((l) => {
        const h = new Date(l.completedAt).getHours();
        return h >= 0 && h < 9;
      }).length,
      mealsLogged: historyMeals + todayConsumedCount,
      perfectDays: historyPerfect + (todayAllConsumed ? 1 : 0),
      proteinGoalDays: historyProtein + (todayProteinHit ? 1 : 0),
      waterGoalDays: achievementRecord.waterGoalDays,
      weighIns: bodyLogs.length,
      // First dot to last, not "days since you started": the span IS the graph,
      // and a graph with one point on it spans nothing.
      weighInSpanDays: (() => {
        if (bodyLogs.length < 2) return 0;
        let first = bodyLogs[0].date;
        let last = bodyLogs[0].date;
        for (const b of bodyLogs) {
          if (b.date < first) first = b.date;
          if (b.date > last) last = b.date;
        }
        return Math.max(
          0,
          Math.round(
            (Date.parse(last + "T00:00:00Z") - Date.parse(first + "T00:00:00Z")) /
              86400000,
          ),
        );
      })(),
      ...activityCalendar,
      trainingMinutes: workoutLog.reduce(
        (sum, l) => sum + (l.durationMinutes || 0),
        0,
      ),
      // Weekend/weekday come off the session's DATE (a Saturday session is a
      // Saturday session wherever it was logged from); early/night come off the
      // clock time it finished at, which is the thing those two are about.
      weekendWorkouts: workoutLog.filter((l) => {
        const d = new Date(l.date + "T00:00:00Z").getUTCDay();
        return d === 0 || d === 6;
      }).length,
      weekdaysTrained: new Set(
        workoutLog.map((l) => new Date(l.date + "T00:00:00Z").getUTCDay()),
      ).size,
      nightWorkouts: workoutLog.filter(
        (l) => new Date(l.completedAt).getHours() >= 20,
      ).length,
    };
  }, [
    activityCalendar,
    todayDiet?.schedule,
    nutritionTargets,
    consumedNutrition.proteinG,
    dietHistory,
    workoutLog,
    sessionHistory,
    bodyLogs,
    streakData,
    achievementRecord.waterGoalDays,
  ]);

  const achievements = useMemo<EvaluatedAchievement[]>(
    () => evaluateAchievements(achievementStats, achievementRecord),
    [achievementStats, achievementRecord],
  );

  // Reactively unlock & celebrate achievements. The first pass after load is
  // silent so a user's pre-existing progress is reconciled without a pop flood.
  useEffect(() => {
    if (isLoading) return;
    const { record, newlyUnlocked } = reconcileEarned(
      achievementStats,
      achievementRecordRef.current,
    );
    if (newlyUnlocked.length > 0) {
      setAchievementRecord(record);
      saveAchievementRecord(record);
      if (achievementsReconciledRef.current) {
        // Maturity (the celebration dial) reads from the post-unlock summary.
        const summary = getAchievementSummary(
          evaluateAchievements(achievementStats, record),
        );
        pushCelebrations(
          newlyUnlocked.map((def) => celebrationFromAchievement(def, summary)),
        );
      }
    }
    achievementsReconciledRef.current = true;
  }, [achievementStats, isLoading, pushCelebrations]);

  // ── Coach-noticed moments (services/MomentEngine) ────────────────────────
  //
  // Runs alongside the achievement reconcile rather than inside it, because the
  // two answer different questions: achievements ask "did you cross a number",
  // moments ask "has this ever happened to you before". Same silent-first-pass
  // guard, for the same reason — a returning user must not be told they broke
  // four records the instant the app finishes loading.
  const momentRecordRef = useRef<MomentRecord>(EMPTY_MOMENT_RECORD);
  const momentsHydratedRef = useRef(false);
  const momentsReconciledRef = useRef(false);
  const [nudge, setNudge] = useState<Nudge | null>(null);

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;

    (async () => {
      if (!momentsHydratedRef.current) {
        momentRecordRef.current = await loadMomentRecord();
        momentsHydratedRef.current = true;
      }
      if (cancelled) return;

      const input: MomentInput = {
        today: currentDate,
        streak: streakData,
        workoutLog,
        sessionHistory,
        dietHistory,
      };

      const { record, newly } = detectMoments(input, momentRecordRef.current);
      // The record advances even on the silent pass — that is what stops the
      // first post-install check from reporting a lifetime of "records".
      momentRecordRef.current = record;
      void saveMomentRecord(record);

      if (newly.length > 0 && momentsReconciledRef.current) {
        pushCelebrations(newly.map(celebrationFromMoment));
      }

      // Pure derivation off the freshly-advanced record, so a nudge can never
      // advertise a record the moment detector just consumed.
      setNudge(detectNudge(input, record));
      momentsReconciledRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isLoading,
    currentDate,
    streakData,
    workoutLog,
    sessionHistory,
    dietHistory,
    pushCelebrations,
  ]);

  // Goal reached → mark the chapter complete and invite the next one. Fires
  // exactly once per goal (signature-guarded across restarts).
  useEffect(() => {
    if (isLoading) return;
    const goal = userBio?.primaryGoal;
    const target = userGoals.targetWeightKg;
    if (target == null || !goal) return;
    const j = journeyRef.current;
    const sig = goalSignature(goal, target);
    if (j.goalAchievedPending || j.lastGoalSignature === sig) return;

    const sorted = [...bodyLogs].sort((a, b) => a.date.localeCompare(b.date));
    const startWeightKg =
      j.chapterStartWeightKg ?? sorted[0]?.weightKg ?? userBio?.weightKg ?? null;
    const currentWeightKg =
      sorted[sorted.length - 1]?.weightKg ?? userBio?.weightKg ?? null;

    if (isGoalReached({ goal, targetWeightKg: target, startWeightKg, currentWeightKg })) {
      const next: JourneyRecord = {
        ...j,
        goalAchievedPending: true,
        lastGoalSignature: sig,
      };
      journeyRef.current = next;
      setJourney(next);
      saveJourney(next);
      if (achievementsReconciledRef.current) {
        pushCelebrations([
          celebrationForChapter({
            chapter: j.chapter,
            goalLabel: GOAL_LABEL[goal],
            accent: Palette.gold,
          }),
        ]);
      }
    }
  }, [
    isLoading,
    bodyLogs,
    userGoals.targetWeightKg,
    userBio?.primaryGoal,
    userBio?.weightKg,
    pushCelebrations,
  ]);

  const dismissCelebration = useCallback(() => {
    setCelebrations((prev) => prev.slice(1));
  }, [setCelebrations]);

  /**
   * Re-consult: the user reached a goal and chose what's next. Updates the goal
   * on their bio (regenerating plans), sets a new target + a fresh journey
   * start, opens a new chapter, and writes the pivot into Gozlin's memory.
   */
  const startNewChapter = useCallback(
    async (input: {
      primaryGoal: PrimaryGoal;
      targetWeightKg?: number;
      motivation?: string;
    }) => {
      const today = todayDate();
      const currentWeight =
        [...bodyLogs].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0]
          ?.weightKg ?? userBio?.weightKg;

      if (userBio) {
        const newBio: UserBio = { ...userBio, primaryGoal: input.primaryGoal };
        setUserBio(newBio);
        const targets = calculateNutritionTargets(newBio);
        setNutritionTargets(targets);
        await writeJSON(KEYS.USER_BIO, newBio);
        const ps: PlanState = {
          ...planState,
          needsRegen: true,
          regenReason: "bio_changed",
        };
        setPlanState(ps);
        await writeJSON(KEYS.PLAN_STATE, ps);
      }

      const nextTarget = input.targetWeightKg ?? userGoals.targetWeightKg;
      setUserGoals((prev) => {
        const next: UserGoals = {
          ...prev,
          targetWeightKg: nextTarget,
          journeyStartedAt: today,
        };
        writeJSON(KEYS.USER_GOALS, next);
        return next;
      });

      const nextChapter = journeyRef.current.chapter + 1;
      const nextJourney: JourneyRecord = {
        chapter: nextChapter,
        goalAchievedPending: false,
        // Keep the previously-celebrated signature so the NEW goal can still be
        // detected as reached later (its signature differs).
        lastGoalSignature: journeyRef.current.lastGoalSignature,
        chapterStartWeightKg: currentWeight,
      };
      journeyRef.current = nextJourney;
      setJourney(nextJourney);
      await saveJourney(nextJourney);

      if (input.motivation?.trim()) {
        rememberMotivation(input.motivation.trim()).catch(() => {});
      }
      addEpisode({
        id: `chapter-start:${nextChapter}`,
        date: today,
        summary: `Started chapter ${nextChapter}: ${GOAL_LABEL[input.primaryGoal]} goal`,
        kind: "milestone",
      }).catch(() => {});
    },
    [userBio, planState, userGoals.targetWeightKg, bodyLogs],
  );

  // Stable streak refresher (was an inline arrow recreated every render, which
  // alone forced the whole context value to change identity each render).
  const refreshStreak = useCallback(async () => {
    const s = await loadStreakData();
    setStreakData(s);
  }, []);

  return {
    achievementStats,
    achievements,
    nudge,
    pushCelebrations,
    dismissCelebration,
    startNewChapter,
    refreshStreak,
  };
}
