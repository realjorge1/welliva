/**
 * useGamificationState — streaks, achievements, challenges, the Consistency
 * League and journey chapters, extracted from AppContext (M4).
 *
 * Owns the achievementStats hub derivation, the achievement/challenge/league
 * evaluations, the four reconcile effects (which unlock + celebrate), the
 * celebration queue writer, and the joinLeague / startNewChapter / refreshStreak
 * handlers. State + records stay owned by the provider and flow in via props +
 * setters; the "latest record" refs and silent-first-pass guards live here since
 * only these effects use them. Pure move — identical bodies + dependency arrays.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
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
  EvaluatedAchievement,
  evaluateAchievements,
  getAchievementSummary,
  reconcileEarned,
  saveAchievementRecord,
} from "../../services/AchievementService";
import {
  ChallengeRecord,
  EvaluatedChallenge,
  currentPeriodKey,
  ensurePeriod,
  evaluateChallenges,
  getChallengeSummary,
  periodLabel,
  reconcileChallengeCompletions,
  saveChallengeRecord,
  type ChallengeSummary,
} from "../../services/ChallengeService";
import {
  Celebration,
  celebrationForChapter,
  celebrationForTrophy,
  celebrationFromAchievement,
} from "../../services/CelebrationService";
import {
  computeBreakdown,
  computeStandings,
  enroll as enrollInLeague,
  ensureLeaguePeriod,
  computeUserScore,
  getTrophies,
  leaguePeriodLabel,
  monthHasEnded,
  resolveIfMonthEnded,
  saveTournamentRecord,
  type TournamentRecord,
  type Trophy,
} from "../../services/TournamentService";
import { rivalBlurb, rivalLabel } from "../../services/RivalEngine";
import {
  goalSignature,
  isGoalReached,
  JourneyRecord,
  saveJourney,
} from "../../services/JourneyService";
import { addEpisode, rememberMotivation } from "../../services/gozlin";
import { calculateNutritionTargets } from "../../services/NutritionService";
import {
  KEYS,
  parseLocalDate,
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
  challengeRecord: ChallengeRecord;
  tournamentRecord: TournamentRecord;
  journey: JourneyRecord;
  setAchievementRecord: Dispatch<SetStateAction<AchievementRecord>>;
  setChallengeRecord: Dispatch<SetStateAction<ChallengeRecord>>;
  setTournamentRecord: Dispatch<SetStateAction<TournamentRecord>>;
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
  challengeRecord,
  tournamentRecord,
  journey,
  setAchievementRecord,
  setChallengeRecord,
  setTournamentRecord,
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
  const challengeRecordRef = useRef(challengeRecord);
  challengeRecordRef.current = challengeRecord;
  const tournamentRecordRef = useRef(tournamentRecord);
  tournamentRecordRef.current = tournamentRecord;
  const journeyRef = useRef(journey);
  journeyRef.current = journey;
  // First reconcile after load is silent — pre-existing progress shouldn't
  // trigger a flood of celebrations; only genuinely new unlocks celebrate.
  const achievementsReconciledRef = useRef(false);
  // Same silent-first-pass guard for the league's soft beats (lead change,
  // final stretch). Trophy wins are guarded instead by the persisted `resolved`
  // flag, so a real win still pops on a cold start in a new month.
  const leagueReconciledRef = useRef(false);

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
    };
  }, [
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

  const challenges = useMemo<EvaluatedChallenge[]>(
    () => evaluateChallenges(achievementStats, challengeRecord),
    [achievementStats, challengeRecord],
  );

  const challengeSummary = useMemo<ChallengeSummary>(
    () =>
      getChallengeSummary(
        challenges,
        challengeRecord.periodKey || currentPeriodKey(),
      ),
    [challenges, challengeRecord.periodKey],
  );

  // Consistency League — live head-to-head against this month's AI pacer. Pure
  // presentation derived from the persisted record + the same delta-measured
  // stats the rest of the app uses, anchored to "today" so days-left and pacing
  // re-derive on a day change.
  const league = useMemo(() => {
    if (!tournamentRecord.periodKey) return null;
    const now = parseLocalDate(currentDate);
    const standings = computeStandings(achievementStats, tournamentRecord, now);
    const { archetype, name } = tournamentRecord.rival;
    return {
      enrolled: tournamentRecord.enrolled,
      standings,
      rival: { archetype, name, blurb: rivalBlurb(archetype), label: rivalLabel(archetype) },
      daysLeft: standings.daysLeft,
      periodLabel: leaguePeriodLabel(tournamentRecord, now),
      breakdown: computeBreakdown(achievementStats, tournamentRecord, now),
    };
  }, [tournamentRecord, achievementStats, currentDate]);

  const trophies = useMemo<Trophy[]>(
    () => getTrophies(tournamentRecord),
    [tournamentRecord],
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

  // Seasonal challenges: roll the period (re-baselines on a new month) and
  // celebrate any newly-completed challenge. Same delta-from-baseline engine.
  useEffect(() => {
    if (isLoading) return;
    const rolled = ensurePeriod(challengeRecordRef.current, achievementStats);
    if (rolled !== challengeRecordRef.current) {
      challengeRecordRef.current = rolled;
      setChallengeRecord(rolled);
      saveChallengeRecord(rolled);
    }
    const { record, newlyCompleted } = reconcileChallengeCompletions(
      achievementStats,
      rolled,
    );
    if (newlyCompleted.length > 0) {
      // Challenge records still roll forward (the monthly recap/story narrative
      // reads them), but the challenge SURFACE was retired, so no celebration is
      // popped for an achievement the user can no longer see.
      setChallengeRecord(record);
      saveChallengeRecord(record);
    }
  }, [achievementStats, isLoading, pushCelebrations]);

  // Consistency League: settle a finished month (award a Trophy on a win — never
  // a penalty), then roll into the new month (re-baseline + fresh rival), then
  // record the soft Gozlin beats. Mirrors the challenge effect's delta engine.
  useEffect(() => {
    if (isLoading) return;
    const now = parseLocalDate(currentDate);
    let rec = tournamentRecordRef.current;

    // 1. Settle the prior month FIRST (before re-baselining loses the baseline).
    //    A trophy win pops even on a cold start — it's guarded by `resolved`,
    //    not the silent-first-pass, so the user always sees a real win.
    const wasResolvable =
      rec.enrolled && !rec.resolved && monthHasEnded(rec.periodKey, now);
    const finishedPeriodKey = rec.periodKey;
    const finalScore = wasResolvable ? computeUserScore(achievementStats, rec, now) : 0;
    const { record: resolved, awardedTrophy } = resolveIfMonthEnded(
      achievementStats,
      rec,
      now,
    );
    if (resolved !== rec) {
      rec = resolved;
      tournamentRecordRef.current = rec;
      setTournamentRecord(rec);
      saveTournamentRecord(rec);
      if (wasResolvable) {
        if (awardedTrophy) {
          // pushCelebrations also writes the win into Gozlin's memory.
          pushCelebrations([celebrationForTrophy(awardedTrophy)]);
        } else {
          // No loss state — a warm "how far you moved" memory, never a red X.
          addEpisode({
            id: `league-result:${finishedPeriodKey}`,
            date: todayDate(),
            summary: `Wrapped the ${periodLabel(finishedPeriodKey)} league — moved ${finalScore} discipline points`,
            kind: "note",
          }).catch(() => {});
        }
      }
    }

    // 2. Roll into the current month (re-baseline + new rival; trophies kept).
    const rolled = ensureLeaguePeriod(rec, achievementStats, now);
    if (rolled !== rec) {
      rec = rolled;
      tournamentRecordRef.current = rec;
      setTournamentRecord(rec);
      saveTournamentRecord(rec);
    }

    // 3. Soft beats — only while enrolled, and never on the silent first pass.
    //    addEpisode de-dupes by id, so each fires at most once per period.
    if (rec.enrolled && leagueReconciledRef.current && !monthHasEnded(rec.periodKey, now)) {
      const standings = computeStandings(achievementStats, rec, now);
      if (standings.leader === "user" && standings.userScore > 0) {
        addEpisode({
          id: `league-lead:${rec.periodKey}`,
          date: todayDate(),
          summary: `Took the lead over ${rec.rival.name} in the ${periodLabel(rec.periodKey)} league`,
          kind: "win",
        }).catch(() => {});
      }
      if (standings.daysLeft > 0 && standings.daysLeft <= 3) {
        addEpisode({
          id: `league-final:${rec.periodKey}`,
          date: todayDate(),
          summary: `Final stretch of the ${periodLabel(rec.periodKey)} league — ${standings.daysLeft} days left`,
          kind: "note",
        }).catch(() => {});
      }
    }

    leagueReconciledRef.current = true;
  }, [achievementStats, isLoading, currentDate, pushCelebrations]);

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
   * Opt in to this month's league. Ensures the period is current, re-baselines
   * to the live stats (so only post-join activity counts — no retroactive
   * credit), persists, and writes the join into Gozlin's memory.
   */
  const joinLeague = useCallback(async () => {
    const now = new Date();
    const current = ensureLeaguePeriod(tournamentRecordRef.current, achievementStats, now);
    const enrolled = enrollInLeague(current, achievementStats, now);
    tournamentRecordRef.current = enrolled;
    setTournamentRecord(enrolled);
    await saveTournamentRecord(enrolled);
    addEpisode({
      id: `league-join:${enrolled.periodKey}`,
      date: todayDate(),
      summary: `Joined the ${leaguePeriodLabel(enrolled, now)} Consistency League — pacing with ${enrolled.rival.name}`,
      kind: "milestone",
    }).catch(() => {});
  }, [achievementStats]);

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
    challenges,
    challengeSummary,
    league,
    trophies,
    pushCelebrations,
    dismissCelebration,
    joinLeague,
    startNewChapter,
    refreshStreak,
  };
}
