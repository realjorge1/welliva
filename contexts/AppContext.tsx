/**
 * APP CONTEXT — Offline-First Unified State
 *
 * Single source of truth for:
 * - User bio/profile (persisted to AsyncStorage)
 * - Nutrition targets (derived from bio, never stored separately)
 * - Today's diet schedule + consumed status (persisted immediately)
 * - Workout plan (persisted, deterministic)
 * - Plan state (tracks active plans, regen flags)
 * - Today's consumed nutrition (derived from schedule, not stored separately)
 * - Goals & water tracking
 *
 * KEY DESIGN DECISIONS:
 * 1. Local-first: AsyncStorage is the working copy. When signed in, the profile
 *    (bio/goals) also syncs to Supabase so it follows the user across devices.
 * 2. All local persistence via AsyncStorage through OfflineStorage service.
 * 3. Nutrition consumed totals are DERIVED from the schedule's isConsumed flags,
 *    never stored separately (single source of truth).
 * 4. Plan regeneration only on: new day, preference change, or explicit action.
 * 5. Meal consumed state persists across navigation and app restarts.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { DietHistoryEntry, TodayDiet } from "../models/diet";
import { NutritionTargets } from "../models/nutrition";
import { DEFAULT_PLAN_STATE, PlanState } from "../models/planState";
import { SessionSummaryData } from "../models/session";
import { CuisinePreference, UserBio, UserGoals } from "../models/user";
import {
  BodyLogEntry,
  GeneratedWorkoutPlan,
  WorkoutLogEntry,
  WorkoutSession,
} from "../models/workout";

import { migrate, memory, lifeContext, signalsCoordinator } from "../health-os";
import { useAuth } from "../components/SupabaseAuthProvider";
import { loadBodyLogs } from "../services/BodyLogService";
import { useProfileSync } from "./domain/useProfileSync";
import { useDayChange } from "./domain/useDayChange";
import { useWorkoutState } from "./domain/useWorkoutState";
import { useNutritionState } from "./domain/useNutritionState";
import { useProfileState } from "./domain/useProfileState";
import { useGamificationState } from "./domain/useGamificationState";
import { useMonthlyRecap } from "./domain/useMonthlyRecap";
import {
  CoachInsight,
  generateCoachInsights,
} from "../services/intelligence";

import { calculateNutritionTargets } from "../services/NutritionService";
import {
  archiveWaterDay,
  KEYS,
  readJSON,
  readString,
  todayDate,
  writeJSON,
  writeString,
} from "../services/OfflineStorage";
import { sweepClosedDays } from "../services/ScheduleService";
import { SessionService } from "../services/SessionService";
import { resetWeekIfNeeded, StreakData } from "../services/StreakService";
import {
  AchievementRecord,
  AchievementStats,
  EMPTY_RECORD,
  EvaluatedAchievement,
  loadAchievementRecord,
} from "../services/AchievementService";
import {
  ChallengeRecord,
  EMPTY_CHALLENGE_RECORD,
  EvaluatedChallenge,
  loadChallengeRecord,
  type ChallengeSummary,
} from "../services/ChallengeService";
import { Celebration } from "../services/CelebrationService";
import {
  EMPTY_TOURNAMENT_RECORD,
  loadTournamentRecord,
  type ScoreBreakdownRow,
  type Standings,
  type TournamentRecord,
  type Trophy,
} from "../services/TournamentService";
import {
  JourneyRecord,
  EMPTY_JOURNEY,
  loadJourney,
} from "../services/JourneyService";
import {
  loadRecapSeen,
  type MonthlyRecap,
  type RecapPeriod,
} from "../services/MonthlyRecapService";
import { ensureDietBuffer, ensureDietForDate } from "../services/PlanSync";
import type { PrimaryGoal } from "../models/user";
import { type WorkoutAdaptation } from "../services/gozlin";

// ============================================================================
// TYPES
// ============================================================================

export interface ConsumedNutrition {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  waterMl: number;
}

/**
 * Human-readable summary of how a profile edit re-fit the plan — shown back to
 * the user so a change never feels silent ("here's what I changed for you").
 */
export interface BioChangeSummary {
  headline: string;
  lines: string[];
}

interface AppContextType {
  // User
  userBio: UserBio | null;
  isOnboardingComplete: boolean;
  /**
   * Apply a profile/lifestyle change and immediately re-fit the entire plan to
   * it: recomputes nutrition targets, rebuilds today's meals (switching diet if
   * a new condition/allergy makes the current one unsafe), and regenerates the
   * workout plan honoring new injuries/conditions/equipment/level/goal.
   * Returns a human summary of everything it changed.
   */
  updateUserBio: (bio: Partial<UserBio>) => Promise<BioChangeSummary>;
  completeOnboarding: (bio: UserBio) => Promise<void>;
  /** Change the cuisine preference and regenerate today's meals from it. */
  setCuisinePreference: (pref: CuisinePreference) => Promise<void>;
  /**
   * Record a learned/declared food preference to avoid (e.g. "dairy") and
   * regenerate today's meals to honor it. Powers Adaptive Nutrition's
   * "prioritize dairy-free options" capability — the generator filters meals by
   * these tags (with graceful fallback so a diet never starves).
   */
  setFoodPreference: (tag: string) => Promise<void>;

  // Nutrition (derived from consumed meals — single source of truth)
  nutritionTargets: NutritionTargets | null;
  consumedNutrition: ConsumedNutrition;
  addWater: (ml: number) => void;

  // Intelligence layer — adaptive coaching insights (derived)
  coachInsights: CoachInsight[];

  // Diet
  todayDiet: TodayDiet | null;
  dietHistory: DietHistoryEntry[];
  refreshDietHistory: () => Promise<void>;
  refreshTodayDiet: () => Promise<void>;
  autoGenerateDietPlan: (dietId?: string) => Promise<void>;
  scheduleWeeklyDietPlan: (dietId?: string) => Promise<void>;
  markMealAsConsumed: (
    mealType: "breakfast" | "lunch" | "dinner" | "snack",
    snackIndex?: number,
  ) => Promise<void>;
  toggleMealConsumed: (
    mealType: "breakfast" | "lunch" | "dinner" | "snack",
    snackIndex?: number,
  ) => Promise<void>;
  swapMeal: (
    mealType: "breakfast" | "lunch" | "dinner" | "snack",
    newMeal: import("../models/diet").ScheduledMeal,
    snackIndex?: number,
  ) => Promise<void>;
  /**
   * Log a single whole food (from the Foods catalog) as an already-consumed
   * snack on today's plan. Resolves to false if no diet is scheduled for today
   * (nothing to attach it to); the caller should prompt to start a plan.
   */
  addFoodAsSnack: (
    food: import("../constants/FoodDictionary").FoodItem,
  ) => Promise<boolean>;

  // Workout
  workoutPlan: GeneratedWorkoutPlan | null;
  regenerateWorkoutPlan: () => Promise<void>;
  logWorkout: (entry: WorkoutLogEntry) => Promise<void>;
  workoutLog: WorkoutLogEntry[];
  /** Per-exercise session results (reps/skips) — feeds Adaptive Workout Intelligence. */
  sessionHistory: SessionSummaryData[];
  /** Persist a completed guided-session summary (per-exercise performance). */
  recordSessionSummary: (summary: SessionSummaryData) => Promise<void>;
  /**
   * Apply a Gozlin workout adaptation to the live plan (replace/volume/intensity/
   * rest). Mutates the persisted plan in place; the inputHash is preserved so the
   * weekly regen won't clobber the change within the current week.
   */
  applyWorkoutAdaptation: (adaptation: WorkoutAdaptation) => Promise<void>;

  // Goals
  userGoals: UserGoals;
  updateGoals: (goals: Partial<UserGoals>) => Promise<void>;

  // Body data (weigh-ins / measurements — feeds the Transformation Forecast)
  bodyLogs: BodyLogEntry[];
  logBodyMeasurement: (entry: BodyLogEntry) => Promise<void>;
  setTargetWeight: (kg: number) => Promise<void>;

  // Plan state
  planState: PlanState;

  // Streaks & badges
  streakData: StreakData;
  refreshStreak: () => Promise<void>;

  // Achievements (wired to real app data — see AchievementService)
  /** Every achievement resolved against live stats (progress, unlocked, date). */
  achievements: EvaluatedAchievement[];
  /** Aggregated stats snapshot the achievements are evaluated against. */
  achievementStats: AchievementStats;

  // Seasonal challenges (monthly, delta-measured — see ChallengeService)
  /** This month's challenges resolved against the period baseline. */
  challenges: EvaluatedChallenge[];
  /** Period label, season name, points, days-left for the challenges header. */
  challengeSummary: ChallengeSummary;

  // Consistency League (monthly AI-pacer tournament — see TournamentService)
  /**
   * The active league, or null until initialized. Opt-in and off by default:
   * `enrolled` is false until the user joins; everything else is the live
   * head-to-head against this month's calibrated AI pacer.
   */
  league: {
    enrolled: boolean;
    standings: Standings;
    rival: {
      archetype: import("../services/RivalEngine").RivalArchetype;
      name: string;
      blurb: string;
      label: string;
    };
    daysLeft: number;
    /** "June 2026" — the active league month. */
    periodLabel: string;
    /** Per-metric discipline-score breakdown (for the league screen). */
    breakdown: ScoreBreakdownRow[];
  } | null;
  /** The permanent trophy case (newest month first). Upside-only — only ever adds. */
  trophies: Trophy[];
  /** Opt in to this month's league (re-baselines so only post-join activity counts). */
  joinLeague: () => Promise<void>;

  // Unified celebration queue (achievements + challenges + chapters + trophies)
  /** Queue of just-earned moments awaiting their celebration. */
  celebrations: Celebration[];
  /** Dismiss the front celebration (call after showing it). */
  dismissCelebration: () => void;

  // Journey chapters (goal reached → re-consult — see JourneyService)
  /** Current chapter number (1-based) of the user's journey. */
  journeyChapter: number;
  /** True when a goal was reached and the user hasn't started the next chapter. */
  goalAchievedPending: boolean;
  /** Re-consult: set a new goal/target, increment the chapter, restart the curve. */
  startNewChapter: (input: {
    primaryGoal: import("../models/user").PrimaryGoal;
    targetWeightKg?: number;
    motivation?: string;
  }) => Promise<void>;

  // Monthly "Welliva Wrapped" recap (see MonthlyRecapService)
  /**
   * The just-completed prior month, when it has real activity and its recap
   * hasn't been seen yet. Calm delivery: surfaced as a dismissible Profile
   * banner, never auto-pushed. Null when nothing is waiting.
   */
  recapAvailable: { periodKey: string; label: string } | null;
  /** Past months with data, newest first — the permanent recap archive. */
  availableRecapPeriods: RecapPeriod[];
  /** Build the full, data-driven recap for a period (deterministic). */
  buildRecap: (periodKey: string) => MonthlyRecap;
  /** Mark a period's recap seen (dismiss the banner / on open). */
  markRecapSeen: (periodKey: string) => void;

  // State
  isLoading: boolean;
  /**
   * True once the login-time cloud profile pull+reconcile has finished for the
   * signed-in user (or immediately, when signed out). Routing waits on this so a
   * returning user on a fresh device isn't shown onboarding before their cloud
   * profile arrives.
   */
  isProfileReconciled: boolean;
  currentDate: string;
}

const defaultGoals: UserGoals = {
  weeklyWorkoutsTarget: 3,
  // dailyWaterMl intentionally unset: the hydration goal is derived from the
  // user's bio (nutritionTargets.waterMl, weight-based) unless they explicitly
  // override it here. Hard-coding 2500 here was a competing source of truth.
};

// ============================================================================
// CONTEXT
// ============================================================================
//
// The app state is split into FIVE domain contexts rather than one. With a
// single context, any state change (a water tap, a meal toggle) gives every
// consumer a new value reference and re-renders all of them — the active screen,
// the always-mounted celebration host, the auth gate, every card. Splitting by
// domain means a change in one domain only re-renders that domain's consumers.
//
// The provider computes everything exactly as before; it just hands each domain
// its own memoized slice. Components subscribe via the narrow hooks
// (useProfile / useNutrition / useWorkout / useGamification / useSystem). The
// legacy useApp() still returns the full shape (it composes all five) for the
// few consumers that genuinely span every domain.

/** Profile, bio-derived targets, goals & body data — changes rarely. */
type ProfileSlice = Pick<
  AppContextType,
  | "userBio"
  | "isOnboardingComplete"
  | "updateUserBio"
  | "completeOnboarding"
  | "setCuisinePreference"
  | "setFoodPreference"
  | "nutritionTargets"
  | "userGoals"
  | "updateGoals"
  | "bodyLogs"
  | "logBodyMeasurement"
  | "setTargetWeight"
>;

/** Today's diet, consumed totals, hydration & coaching — the hot path. */
type NutritionSlice = Pick<
  AppContextType,
  | "consumedNutrition"
  | "addWater"
  | "coachInsights"
  | "todayDiet"
  | "dietHistory"
  | "refreshDietHistory"
  | "refreshTodayDiet"
  | "autoGenerateDietPlan"
  | "scheduleWeeklyDietPlan"
  | "markMealAsConsumed"
  | "toggleMealConsumed"
  | "swapMeal"
  | "addFoodAsSnack"
>;

/** Workout plan, logs & session history. */
type WorkoutSlice = Pick<
  AppContextType,
  | "workoutPlan"
  | "regenerateWorkoutPlan"
  | "logWorkout"
  | "workoutLog"
  | "sessionHistory"
  | "recordSessionSummary"
  | "applyWorkoutAdaptation"
>;

/** Streaks, achievements, challenges, league & journey chapters. */
type GamificationSlice = Pick<
  AppContextType,
  | "streakData"
  | "refreshStreak"
  | "achievements"
  | "achievementStats"
  | "challenges"
  | "challengeSummary"
  | "league"
  | "trophies"
  | "joinLeague"
  | "journeyChapter"
  | "goalAchievedPending"
  | "startNewChapter"
>;

/** Cross-cutting app/system: celebrations, loading, date, recap, plan state. */
type SystemSlice = Pick<
  AppContextType,
  | "celebrations"
  | "dismissCelebration"
  | "isLoading"
  | "isProfileReconciled"
  | "currentDate"
  | "recapAvailable"
  | "availableRecapPeriods"
  | "buildRecap"
  | "markRecapSeen"
  | "planState"
>;

const ProfileContext = createContext<ProfileSlice | undefined>(undefined);
const NutritionContext = createContext<NutritionSlice | undefined>(undefined);
const WorkoutContext = createContext<WorkoutSlice | undefined>(undefined);
const GamificationContext = createContext<GamificationSlice | undefined>(
  undefined,
);
const SystemContext = createContext<SystemSlice | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // The signed-in user (from SupabaseAuthProvider, which wraps this provider in
  // app/_layout.tsx). Null when signed out — all cloud sync is gated on it.
  const { user } = useAuth();

  // State
  const [userBio, setUserBio] = useState<UserBio | null>(null);
  const [nutritionTargets, setNutritionTargets] =
    useState<NutritionTargets | null>(null);
  const [todayDiet, setTodayDiet] = useState<TodayDiet | null>(null);
  const [dietHistory, setDietHistory] = useState<DietHistoryEntry[]>([]);
  const [workoutPlan, setWorkoutPlan] = useState<GeneratedWorkoutPlan | null>(
    null,
  );
  const [workoutLog, setWorkoutLog] = useState<WorkoutLogEntry[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionSummaryData[]>([]);
  const [userGoals, setUserGoals] = useState<UserGoals>(defaultGoals);
  const [bodyLogs, setBodyLogs] = useState<BodyLogEntry[]>([]);
  const [planState, setPlanState] = useState<PlanState>(DEFAULT_PLAN_STATE);
  const [waterMl, setWaterMl] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => todayDate());
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: "",
    totalActiveDays: 0,
    badges: [],
    weekActivity: [false, false, false, false, false, false, false],
  });
  const [achievementRecord, setAchievementRecord] =
    useState<AchievementRecord>(EMPTY_RECORD);
  const [challengeRecord, setChallengeRecord] = useState<ChallengeRecord>(
    EMPTY_CHALLENGE_RECORD,
  );
  const [tournamentRecord, setTournamentRecord] = useState<TournamentRecord>(
    EMPTY_TOURNAMENT_RECORD,
  );
  const [journey, setJourney] = useState<JourneyRecord>(EMPTY_JOURNEY);
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  // Monthly recap delivery gate: the last period whose recap was presented, and
  // the prior month currently waiting (calm banner, never auto-pushed).
  const [recapSeen, setRecapSeenState] = useState<string | null>(null);
  const [recapAvailable, setRecapAvailable] = useState<
    { periodKey: string; label: string } | null
  >(null);
  // The gamification "latest record" refs + silent-first-pass guards and the
  // pushCelebrations writer now live in useGamificationState; the recap
  // once-per-session guard lives in useMonthlyRecap (M4).

  // ============================================================================
  // NUTRITION — consumed total + diet/water handlers
  // (contexts/domain/useNutritionState — M4). Called early: consumedNutrition
  // feeds coachInsights + achievementStats, and refreshTodayDiet is needed by
  // loadData / updateUserBio / useDayChange below.
  // ============================================================================

  const {
    consumedNutrition,
    refreshTodayDiet,
    refreshDietHistory,
    autoGenerateDietPlan,
    scheduleWeeklyDietPlan,
    markMealAsConsumed,
    handleToggleMealConsumed,
    handleSwapMeal,
    addFoodAsSnack,
    addWater,
  } = useNutritionState({
    userBio,
    nutritionTargets,
    planState,
    currentDate,
    userGoals,
    todayDiet,
    waterMl,
    setTodayDiet,
    setDietHistory,
    setPlanState,
    setWaterMl,
    setStreakData,
    setAchievementRecord,
  });

  // ============================================================================
  // PROFILE — bio/goals/body handlers (contexts/domain/useProfileState — M4).
  // Needs refreshTodayDiet from the nutrition hook above.
  // ============================================================================

  const {
    isOnboardingComplete,
    updateUserBio,
    completeOnboarding,
    setCuisinePreference,
    setFoodPreference,
    updateGoals,
    logBodyMeasurement,
    setTargetWeight,
  } = useProfileState({
    userBio,
    nutritionTargets,
    planState,
    workoutPlan,
    userGoals,
    setUserBio,
    setNutritionTargets,
    setUserGoals,
    setWorkoutPlan,
    setPlanState,
    setBodyLogs,
    refreshTodayDiet,
  });

  // ============================================================================
  // DERIVED: coaching insights (intelligence layer — single source)
  // ============================================================================

  const todayWorkoutSession = useMemo<WorkoutSession | null>(() => {
    if (!workoutPlan) return null;
    const d = new Date().getDay();
    const idx = d === 0 ? 6 : d - 1; // 0=Mon … 6=Sun
    return workoutPlan.sessions.find((s) => s.dayOfWeek === idx) ?? null;
  }, [workoutPlan, currentDate]);

  const workoutDoneToday = useMemo(
    () => workoutLog.some((l) => l.date === currentDate),
    [workoutLog, currentDate],
  );

  const coachInsights = useMemo<CoachInsight[]>(
    () =>
      generateCoachInsights({
        bio: userBio,
        targets: nutritionTargets,
        consumed: consumedNutrition,
        waterGoalMl:
          userGoals?.dailyWaterMl ?? nutritionTargets?.waterMl ?? 2500,
        todayDiet,
        workoutSession: todayWorkoutSession,
        workoutDoneToday,
        streak: streakData,
      }),
    [
      userBio,
      nutritionTargets,
      consumedNutrition,
      userGoals,
      todayDiet,
      todayWorkoutSession,
      workoutDoneToday,
      streakData,
    ],
  );

  // ============================================================================
  // DERIVED: achievement stats (assembled from real, persisted app data)
  // ============================================================================

  // ============================================================================
  // GAMIFICATION — stats/achievements/challenges/league + reconcile effects
  // (contexts/domain/useGamificationState — M4). Consumes achievementStats
  // inputs from every domain; owns the celebration writer + record refs.
  // ============================================================================

  const {
    achievementStats,
    achievements,
    challenges,
    challengeSummary,
    league,
    trophies,
    dismissCelebration,
    joinLeague,
    startNewChapter,
    refreshStreak,
  } = useGamificationState({
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
  });

  // ============================================================================
  // MONTHLY RECAP ("Welliva Wrapped") — contexts/domain/useMonthlyRecap (M4).
  // Needs trophies from the gamification hook above.
  // ============================================================================

  const { availableRecapPeriods, buildRecap, markRecapSeen } = useMonthlyRecap({
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
  });

  // The gamification reconcile effects (achievements / challenges / league /
  // goal-reached), the recap-availability + long-horizon storytelling effects,
  // and the dismissCelebration / joinLeague / startNewChapter handlers now live
  // in useGamificationState + useMonthlyRecap (M4), wired above.

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    loadData();
  }, []);

  // Cloud profile sync (bio/goals ↔ Supabase `users` row) lives in its own
  // module now — the login reconcile, debounced push and auto-sync teardown.
  // It's wired below, after loadData is defined (the reconcile calls it).

  // The midnight rollover sweep (day-change) lives in its own module now
  // (useDayChange). It's wired below in the render-prep section, once the
  // refreshers + regenerateWorkoutPlan it calls have been defined.

  // Keep a rolling offline buffer of AI meal plans for the days ahead. Runs when
  // bio/targets become available (e.g. each app open). No-ops when the backend
  // isn't configured and skips days already cached, so it stays cheap.
  useEffect(() => {
    if (!userBio || !nutritionTargets) return;
    void ensureDietBuffer(
      userBio,
      nutritionTargets,
      todayDate(),
      planState.activeDietId ?? undefined,
    );
    // Buffer fills are idempotent; intentionally not depending on planState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userBio, nutritionTargets]);

  // ============================================================================
  // DATA LOADING (offline only)
  // ============================================================================

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Bring on-device storage to the current schema BEFORE any read: idempotent,
      // version-gated, and additive (backfills the unified Timeline from the existing
      // silos on first run, originals retained). See docs/architecture/04.
      await migrate();

      // Auto-expire any life events whose grace day has passed while the app was closed.
      await lifeContext.expireDue();
      // Pull from any connected senses on boot (consent + permission gated, never throws).
      void signalsCoordinator.syncDue();

      const [bio, goals, plan, workout, log, water, lastDate] =
        await Promise.all([
          readJSON<UserBio | null>(KEYS.USER_BIO, null),
          readJSON<UserGoals | null>(KEYS.USER_GOALS, null),
          readJSON<PlanState | null>(KEYS.PLAN_STATE, null),
          readJSON<GeneratedWorkoutPlan | null>(KEYS.WORKOUT_PLAN, null),
          readJSON<WorkoutLogEntry[]>(KEYS.WORKOUT_LOG, []),
          readJSON<number>(KEYS.WATER_TODAY, 0),
          readString(KEYS.LAST_ACTIVE_DATE),
        ]);

      if (bio) {
        setUserBio(bio);
        setNutritionTargets(calculateNutritionTargets(bio));
      }
      if (goals) setUserGoals(goals);
      if (plan) setPlanState(plan);
      if (workout) setWorkoutPlan(workout);
      setWorkoutLog(log);
      setBodyLogs(await loadBodyLogs());
      setSessionHistory(await SessionService.getInstance().loadHistory());

      // Handle day change
      const today = todayDate();
      if (lastDate && lastDate !== today) {
        // Sweep rather than close a single day — the app may have been shut for
        // a week, and every intervening day still needs its history row.
        await sweepClosedDays(today);
        // Compact the just-closed day into the L2 summaries (see checkDayChange above).
        await memory.compactDayIfPresent(lastDate);
        // Archive the day that just ended, then reset today's counter — and
        // PERSIST the reset. Without writing WATER_TODAY=0 here, reopening the
        // app on a new day (before any water is logged) would reload the stale
        // total and the log would appear frozen at yesterday's value.
        const waterGoal =
          goals?.dailyWaterMl ??
          (bio ? calculateNutritionTargets(bio).waterMl : undefined) ??
          2500;
        await archiveWaterDay(lastDate, water || 0, waterGoal);
        setWaterMl(0);
        await writeJSON(KEYS.WATER_TODAY, 0);
        // Generate diet for the new day, preserving the previously chosen diet.
        if (bio) {
          const targets = calculateNutritionTargets(bio);
          // Prefer a cached day (offline); else generate AI-first with local
          // fallback. Never clobbers an already-scheduled day.
          const result = await ensureDietForDate(
            bio,
            targets,
            today,
            plan?.activeDietId ?? undefined,
          );
          if (result && plan) {
            const updatedPlan: PlanState = {
              ...plan,
              activeDietId: result.dietId,
              dateStamp: today,
            };
            setPlanState(updatedPlan);
            await writeJSON(KEYS.PLAN_STATE, updatedPlan);
          }
        }
      } else {
        setWaterMl(water || 0);
      }

      await writeString(KEYS.LAST_ACTIVE_DATE, today);
      await refreshTodayDiet();
      await refreshDietHistory();

      // Load streaks
      const streak = await resetWeekIfNeeded(today);
      setStreakData(streak);

      // Load achievement record (earned set + hydration counter), the active
      // challenge season, and the journey/chapter record.
      setAchievementRecord(await loadAchievementRecord());
      setChallengeRecord(await loadChallengeRecord());
      setTournamentRecord(await loadTournamentRecord());
      setJourney(await loadJourney());
      setRecapSeenState(await loadRecapSeen());
    } catch (error) {
      console.error("Error loading app data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Cloud profile sync — bio/goals ↔ Supabase, plus the document-mirror
  // auto-sync loop. Extracted to its own module (M4); wired here because the
  // login reconcile re-hydrates via loadData once it lands. Pure move — same
  // behavior, same fail-soft guarantees.
  const { isProfileReconciled } = useProfileSync({
    user,
    isLoading,
    userBio,
    userGoals,
    setUserBio,
    setNutritionTargets,
    setUserGoals,
    loadData,
  });

  // Profile handlers — updateUserBio (the big cross-cutting plan re-fit),
  // completeOnboarding, setCuisinePreference, setFoodPreference — now live in
  // contexts/domain/useProfileState (M4), wired above. Diet/water handlers live
  // in contexts/domain/useNutritionState (also wired above).

  // ============================================================================
  // WORKOUT (handlers extracted to contexts/domain/useWorkoutState — M4)
  // ============================================================================

  const {
    regenerateWorkoutPlan,
    logWorkout,
    recordSessionSummary,
    applyWorkoutAdaptation,
  } = useWorkoutState({
    userBio,
    workoutPlan,
    planState,
    currentDate,
    setWorkoutPlan,
    setWorkoutLog,
    setSessionHistory,
    setPlanState,
    setStreakData,
  });

  // Goals + body-measurement handlers (updateGoals / logBodyMeasurement /
  // setTargetWeight) now live in contexts/domain/useProfileState (M4), wired above.

  // ============================================================================
  // RENDER
  // ============================================================================

  // Midnight rollover sweep (extracted to useDayChange in M4). Wired here —
  // rather than up with the other effects — because it calls refreshTodayDiet,
  // refreshDietHistory and regenerateWorkoutPlan, which are defined above this
  // point; passing them any earlier would hit the temporal dead zone.
  useDayChange({
    currentDate,
    userBio,
    nutritionTargets,
    workoutPlan,
    planState,
    userGoals,
    setCurrentDate,
    setWaterMl,
    setPlanState,
    refreshTodayDiet,
    refreshDietHistory,
    regenerateWorkoutPlan,
  });

  // Each domain gets its own memoized value so a change in one domain doesn't
  // hand a new reference to the others' consumers. Deps are exactly the slice's
  // fields (all already stable state / useCallback / useMemo references).
  const profileValue = useMemo<ProfileSlice>(
    () => ({
      userBio,
      isOnboardingComplete,
      updateUserBio,
      completeOnboarding,
      setCuisinePreference,
      setFoodPreference,
      nutritionTargets,
      userGoals,
      updateGoals,
      bodyLogs,
      logBodyMeasurement,
      setTargetWeight,
    }),
    [
      userBio,
      isOnboardingComplete,
      updateUserBio,
      completeOnboarding,
      setCuisinePreference,
      setFoodPreference,
      nutritionTargets,
      userGoals,
      updateGoals,
      bodyLogs,
      logBodyMeasurement,
      setTargetWeight,
    ],
  );

  const nutritionValue = useMemo<NutritionSlice>(
    () => ({
      consumedNutrition,
      addWater,
      coachInsights,
      todayDiet,
      dietHistory,
      refreshDietHistory,
      refreshTodayDiet,
      autoGenerateDietPlan,
      scheduleWeeklyDietPlan,
      markMealAsConsumed,
      toggleMealConsumed: handleToggleMealConsumed,
      swapMeal: handleSwapMeal,
      addFoodAsSnack,
    }),
    [
      consumedNutrition,
      addWater,
      coachInsights,
      todayDiet,
      dietHistory,
      refreshDietHistory,
      refreshTodayDiet,
      autoGenerateDietPlan,
      scheduleWeeklyDietPlan,
      markMealAsConsumed,
      handleToggleMealConsumed,
      handleSwapMeal,
      addFoodAsSnack,
    ],
  );

  const workoutValue = useMemo<WorkoutSlice>(
    () => ({
      workoutPlan,
      regenerateWorkoutPlan,
      logWorkout,
      workoutLog,
      sessionHistory,
      recordSessionSummary,
      applyWorkoutAdaptation,
    }),
    [
      workoutPlan,
      regenerateWorkoutPlan,
      logWorkout,
      workoutLog,
      sessionHistory,
      recordSessionSummary,
      applyWorkoutAdaptation,
    ],
  );

  const gamificationValue = useMemo<GamificationSlice>(
    () => ({
      streakData,
      refreshStreak,
      achievements,
      achievementStats,
      challenges,
      challengeSummary,
      league,
      trophies,
      joinLeague,
      journeyChapter: journey.chapter,
      goalAchievedPending: journey.goalAchievedPending,
      startNewChapter,
    }),
    [
      streakData,
      refreshStreak,
      achievements,
      achievementStats,
      challenges,
      challengeSummary,
      league,
      trophies,
      joinLeague,
      journey.chapter,
      journey.goalAchievedPending,
      startNewChapter,
    ],
  );

  const systemValue = useMemo<SystemSlice>(
    () => ({
      celebrations,
      dismissCelebration,
      isLoading,
      isProfileReconciled,
      currentDate,
      recapAvailable,
      availableRecapPeriods,
      buildRecap,
      markRecapSeen,
      planState,
    }),
    [
      celebrations,
      dismissCelebration,
      isLoading,
      isProfileReconciled,
      currentDate,
      recapAvailable,
      availableRecapPeriods,
      buildRecap,
      markRecapSeen,
      planState,
    ],
  );

  return (
    <ProfileContext.Provider value={profileValue}>
      <WorkoutContext.Provider value={workoutValue}>
        <GamificationContext.Provider value={gamificationValue}>
          <NutritionContext.Provider value={nutritionValue}>
            <SystemContext.Provider value={systemValue}>
              {children}
            </SystemContext.Provider>
          </NutritionContext.Provider>
        </GamificationContext.Provider>
      </WorkoutContext.Provider>
    </ProfileContext.Provider>
  );
}

// ============================================================================
// HOOKS
// ============================================================================
//
// Subscribe to the narrowest domain a component actually needs — that's what
// keeps an unrelated update from re-rendering it.

function useDomain<T>(ctx: React.Context<T | undefined>, name: string): T {
  const value = useContext(ctx);
  if (value === undefined) {
    throw new Error(`${name} must be used within an AppProvider`);
  }
  return value;
}

/** Profile, bio-derived targets, goals & body data. */
export function useProfile(): ProfileSlice {
  return useDomain(ProfileContext, "useProfile");
}

/** Today's diet, consumed totals, hydration & coaching (the hot path). */
export function useNutrition(): NutritionSlice {
  return useDomain(NutritionContext, "useNutrition");
}

/** Workout plan, logs & session history. */
export function useWorkout(): WorkoutSlice {
  return useDomain(WorkoutContext, "useWorkout");
}

/** Streaks, achievements, challenges, league & journey chapters. */
export function useGamification(): GamificationSlice {
  return useDomain(GamificationContext, "useGamification");
}

/** Cross-cutting app/system: celebrations, loading, date, recap, plan state. */
export function useSystem(): SystemSlice {
  return useDomain(SystemContext, "useSystem");
}

/**
 * Full-state hook (every domain). Prefer the narrow domain hooks above — this
 * re-renders on ANY state change. Kept for the handful of consumers that
 * genuinely span every domain (e.g. the Gozlin snapshot bridge).
 */
export function useApp(): AppContextType {
  const profile = useProfile();
  const nutrition = useNutrition();
  const workout = useWorkout();
  const gamification = useGamification();
  const system = useSystem();
  return useMemo(
    () => ({ ...profile, ...nutrition, ...workout, ...gamification, ...system }),
    [profile, nutrition, workout, gamification, system],
  );
}
