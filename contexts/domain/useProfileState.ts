/**
 * useProfileState — bio / goals / body handlers, extracted from AppContext (M4).
 *
 * This is the "apply a profile change and re-fit the plan" domain: updateUserBio
 * (the big cross-cutting regen), onboarding completion, cuisine/food-preference
 * changes, goals, and body measurements. State stays owned by the provider and
 * flows in via setters; the diet refresher comes from useNutritionState. Pure
 * move — identical bodies, identical dependency arrays.
 */
import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { NutritionTargets } from "../../models/nutrition";
import type { PlanState } from "../../models/planState";
import type { CuisinePreference, UserBio, UserGoals } from "../../models/user";
import type { BodyLogEntry, GeneratedWorkoutPlan } from "../../models/workout";
import type { BioChangeSummary } from "../AppContext";
import { ensureDietLibraryLoaded } from "../../constants/DietDatabase";
import { addBodyLog } from "../../services/BodyLogService";
import { generateDietPlan } from "../../services/DietPlanGenerator";
import {
  getAllAvailableDiets,
  getMedicationAdvisories,
} from "../../services/DietMatchService";
import { calculateNutritionTargets } from "../../services/NutritionService";
import { reconcileTargetsVersion } from "../../services/nutrition/TargetsVersion";
import {
  KEYS,
  currentWeekStart,
  todayDate,
  writeJSON,
  writeString,
} from "../../services/OfflineStorage";
import {
  applyDietPreferenceChange,
  ensureDietBuffer,
  generateWorkoutWeek,
  invalidateDietBuffer,
  regenerateDietForDate,
} from "../../services/PlanSync";
import {
  clearScheduledDietsAfter,
  saveDaySchedule,
} from "../../services/ScheduleService";
import {
  describeAdaptations,
  ensureWorkoutExercisesLoaded,
  generateWorkoutPlan,
} from "../../services/WorkoutGenerator";

interface Params {
  userBio: UserBio | null;
  nutritionTargets: NutritionTargets | null;
  planState: PlanState;
  workoutPlan: GeneratedWorkoutPlan | null;
  userGoals: UserGoals;
  setUserBio: Dispatch<SetStateAction<UserBio | null>>;
  setNutritionTargets: Dispatch<SetStateAction<NutritionTargets | null>>;
  setUserGoals: Dispatch<SetStateAction<UserGoals>>;
  setWorkoutPlan: Dispatch<SetStateAction<GeneratedWorkoutPlan | null>>;
  setPlanState: Dispatch<SetStateAction<PlanState>>;
  setBodyLogs: Dispatch<SetStateAction<BodyLogEntry[]>>;
  refreshTodayDiet: () => Promise<void>;
}

export function useProfileState({
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
}: Params) {
  // Check if onboarding is complete
  const isOnboardingComplete = Boolean(
    userBio &&
    userBio.age > 0 &&
    userBio.heightCm > 0 &&
    userBio.weightKg > 0 &&
    userBio.sex &&
    userBio.activityLevel,
  );

  /**
   * Apply a profile/lifestyle change and IMMEDIATELY re-fit the whole plan to
   * it — not just store it. A new injury, pregnancy, condition, allergy, goal,
   * equipment change, etc. all flow straight into regenerated nutrition targets,
   * today's meals, and the workout plan. The new bio is built locally and passed
   * into every generator so nothing reads a stale value from a closure (the race
   * the old deferred-regen version had).
   */
  const updateUserBio = useCallback(
    async (updates: Partial<UserBio>): Promise<BioChangeSummary> => {
      // Snapshot the "before" so we can tell the user exactly what changed.
      const oldTargets = userBio ? calculateNutritionTargets(userBio) : null;
      const oldDietId = planState.activeDietId;
      const oldWorkoutHash = workoutPlan?.inputHash ?? null;

      const newBio = { ...userBio, ...updates } as UserBio;
      setUserBio(newBio);
      const targets = calculateNutritionTargets(newBio);
      setNutritionTargets(targets);
      await writeJSON(KEYS.USER_BIO, newBio);

      const today = todayDate();
      const weekStart = currentWeekStart();
      const lines: string[] = [];

      try {
        // ── Diet ──────────────────────────────────────────────────────────
        // Keep the user's chosen diet if it's still SAFE under the new bio
        // (DietMatchService blocks diets contraindicated by a condition/allergy/
        // restriction); otherwise auto-select a safe one. Either way rebuild
        // today's meals so new allergies, dislikes, restriction, cuisine and
        // calorie targets are honored right away.
        await ensureDietLibraryLoaded(); // match + regen over the full library
        const activeId = oldDietId ?? undefined;
        const activeStillSafe =
          activeId != null &&
          getAllAvailableDiets(newBio).some((m) => m.dietId === activeId);
        const dp = generateDietPlan(
          newBio,
          targets,
          today,
          activeStillSafe ? activeId : undefined,
        );
        if (dp) await saveDaySchedule(dp.schedule);

        // ── Workout ───────────────────────────────────────────────────────
        // Regenerate honoring new equipment / training days / level / goal AND
        // new injuries / medical conditions (the generator's safety filter drops
        // contraindicated movements; intensity is capped where needed).
        await ensureWorkoutExercisesLoaded(); // generator reads the exercise pool
        const wp = generateWorkoutPlan(newBio, weekStart, {
          equipment: newBio.equipment,
          daysPerWeek: newBio.workoutDaysPerWeek,
        });
        setWorkoutPlan(wp);
        await writeJSON(KEYS.WORKOUT_PLAN, wp);

        const newPlanState: PlanState = {
          ...planState,
          activeDietId: dp?.diet.id ?? planState.activeDietId,
          activeWorkoutPlanId: wp.id,
          dateStamp: today,
          weekStartDate: weekStart,
          lastGeneratedAt: new Date().toISOString(),
          needsRegen: false,
          regenReason: null,
        };
        setPlanState(newPlanState);
        await writeJSON(KEYS.PLAN_STATE, newPlanState);
        await refreshTodayDiet();

        // The bio changed — cached upcoming days are now stale. Drop them and
        // refill the offline buffer in the new style (online; offline days
        // refill lazily on rollover).
        invalidateDietBuffer();
        await clearScheduledDietsAfter(today);
        void ensureDietBuffer(newBio, targets, today, dp?.diet.id ?? undefined);

        // ── Build the "here's what I changed" summary ──────────────────────
        const calDelta = oldTargets ? targets.calories - oldTargets.calories : 0;
        if (calDelta !== 0) {
          lines.push(
            `Your daily target is now ${targets.calories.toLocaleString()} kcal (${calDelta > 0 ? "+" : ""}${calDelta} kcal).`,
          );
        }
        if (oldTargets && targets.proteinG !== oldTargets.proteinG) {
          lines.push(`Protein goal moved to ${targets.proteinG} g.`);
        }
        if (oldTargets && targets.sodiumMg < oldTargets.sodiumMg) {
          lines.push(
            `Capped sodium at ${targets.sodiumMg} mg to protect your heart & kidneys.`,
          );
        }
        if (dp && dp.diet.id !== oldDietId) {
          lines.push(`Moved you to ${dp.diet.name} — a safer fit for you now.`);
        } else if (dp) {
          lines.push("Refreshed today's meals to match your changes.");
        }

        const adaptNotes = describeAdaptations(newBio);
        const workoutChanged = oldWorkoutHash !== wp.inputHash;
        if (workoutChanged) {
          lines.push(
            adaptNotes.length > 0
              ? `Reworked your training — ${adaptNotes.join("; ").toLowerCase()}.`
              : "Refreshed your workout plan to fit you.",
          );
        } else if (adaptNotes.length > 0) {
          lines.push(`Your training already ${adaptNotes.join("; ").toLowerCase()}.`);
        }

        for (const advisory of getMedicationAdvisories(newBio)) {
          lines.push(advisory);
        }

        const injuries = (newBio.injuries ?? []).filter((s) => s.trim());
        const headline =
          injuries.length > 0
            ? "Got it — I've adjusted things to keep you safe."
            : "All set — I've retuned your plan to fit you.";

        return {
          headline,
          lines: lines.length > 0 ? lines : ["Your profile is up to date."],
        };
      } catch (error) {
        // Bio + targets are already persisted; if a generator failed, flag a
        // regen so the next day-change reconciles the plans.
        console.error("updateUserBio: plan regeneration failed", error);
        const fallback: PlanState = {
          ...planState,
          needsRegen: true,
          regenReason: "bio_changed",
        };
        setPlanState(fallback);
        await writeJSON(KEYS.PLAN_STATE, fallback);
        return {
          headline: "Saved your profile.",
          lines: ["I'll fine-tune your plan in the background."],
        };
      }
    },
    [userBio, planState, workoutPlan, refreshTodayDiet],
  );

  const completeOnboarding = useCallback(async (bio: UserBio) => {
    setUserBio(bio);
    const targets = calculateNutritionTargets(bio);
    setNutritionTargets(targets);
    await writeJSON(KEYS.USER_BIO, bio);

    // Stamp the targets-algorithm version NOW, silently. This user has never
    // seen an older number, so the correction notice must never fire for them —
    // recording the version here is what makes the boot-time check a no-op.
    await reconcileTargetsVersion(bio, targets, /* hasHistory */ false);

    // Stamp the journey start so the Daily Briefing can count "Day N".
    const startDay = todayDate();
    setUserGoals((prev) => {
      const next: UserGoals = { ...prev, journeyStartedAt: prev.journeyStartedAt ?? startDay };
      writeJSON(KEYS.USER_GOALS, next);
      return next;
    });

    // Auto-generate the workout plan — AI-first (honors equipment + training
    // days), local deterministic fallback when offline/unconfigured.
    const weekStart = currentWeekStart();
    const wp = await generateWorkoutWeek(bio, weekStart);
    setWorkoutPlan(wp);
    await writeJSON(KEYS.WORKOUT_PLAN, wp);

    // Auto-generate today's diet (AI-first), then fill the rest of the week's
    // offline buffer in the background so the plan works without a connection.
    const today = todayDate();
    const diet = await regenerateDietForDate(bio, targets, today);
    void ensureDietBuffer(bio, targets, today, diet?.dietId);

    // Save plan state
    const newPlanState: PlanState = {
      activeDietId: diet?.dietId || null,
      activeWorkoutPlanId: wp.id,
      dateStamp: today,
      weekStartDate: weekStart,
      lastGeneratedAt: new Date().toISOString(),
      needsRegen: false,
      regenReason: null,
    };
    setPlanState(newPlanState);
    await writeJSON(KEYS.PLAN_STATE, newPlanState);

    await writeString(KEYS.LAST_ACTIVE_DATE, today);
    await refreshTodayDiet();
  }, []);

  /**
   * Change cuisine preference and immediately regenerate today's meals to
   * reflect it (preserving the active diet). Builds the new bio locally so the
   * regen never reads a stale userBio from a closure.
   */
  const setCuisinePreference = useCallback(
    async (pref: CuisinePreference) => {
      if (!userBio) return;
      const newBio: UserBio = { ...userBio, cuisinePreference: pref };
      setUserBio(newBio);
      const targets = calculateNutritionTargets(newBio);
      setNutritionTargets(targets);
      await writeJSON(KEYS.USER_BIO, newBio);

      // Refresh the WHOLE plan (today + the cached week ahead) so the new
      // cuisine is felt across every upcoming day, not just today.
      const today = todayDate();
      const result = await applyDietPreferenceChange(
        newBio,
        targets,
        today,
        planState.activeDietId ?? undefined,
      );
      if (result) {
        const newPlanState: PlanState = {
          ...planState,
          activeDietId: result.dietId,
          dateStamp: today,
          lastGeneratedAt: new Date().toISOString(),
        };
        setPlanState(newPlanState);
        await writeJSON(KEYS.PLAN_STATE, newPlanState);
        await refreshTodayDiet();
      }
    },
    [userBio, planState, refreshTodayDiet],
  );

  /**
   * Record a food preference to avoid (dedup) and refresh the whole plan so the
   * change is felt immediately — across the entire cached week, not just today.
   */
  const setFoodPreference = useCallback(
    async (tag: string) => {
      if (!userBio) return;
      const clean = tag.trim().toLowerCase();
      if (!clean) return;
      const existing = userBio.foodDislikes ?? [];
      if (existing.some((d) => d.toLowerCase() === clean)) return; // already set
      const newBio: UserBio = { ...userBio, foodDislikes: [...existing, clean] };
      setUserBio(newBio);
      const targets = calculateNutritionTargets(newBio);
      setNutritionTargets(targets);
      await writeJSON(KEYS.USER_BIO, newBio);

      const today = todayDate();
      const result = await applyDietPreferenceChange(
        newBio,
        targets,
        today,
        planState.activeDietId ?? undefined,
      );
      if (result) {
        const newPlanState: PlanState = {
          ...planState,
          activeDietId: result.dietId,
          dateStamp: today,
          lastGeneratedAt: new Date().toISOString(),
        };
        setPlanState(newPlanState);
        await writeJSON(KEYS.PLAN_STATE, newPlanState);
        await refreshTodayDiet();
      }
    },
    [userBio, planState, refreshTodayDiet],
  );

  /**
   * Merge a partial goal update in.
   *
   * Functional, like `setTargetWeight` below, and for a reason the settings
   * steppers made visible: reading `userGoals` from the closure meant two taps
   * inside one render frame both merged onto the SAME pre-tap snapshot, so a
   * quick double-tap on "+" moved the water goal one step instead of two. The
   * updater always sees the latest value, so every tap lands.
   */
  const updateGoals = useCallback(async (goals: Partial<UserGoals>) => {
    setUserGoals((prev) => {
      const next: UserGoals = { ...prev, ...goals };
      writeJSON(KEYS.USER_GOALS, next);
      return next;
    });
  }, []);

  /** Record a weigh-in (one entry per day; re-logging today overwrites). */
  const logBodyMeasurement = useCallback(async (entry: BodyLogEntry) => {
    const next = await addBodyLog(entry);
    setBodyLogs(next);
  }, []);

  /** Set the target body weight the Transformation Forecast aims at. */
  const setTargetWeight = useCallback(
    async (kg: number) => {
      setUserGoals((prev) => {
        const next: UserGoals = { ...prev, targetWeightKg: kg };
        writeJSON(KEYS.USER_GOALS, next);
        return next;
      });
    },
    [],
  );

  return {
    isOnboardingComplete,
    updateUserBio,
    completeOnboarding,
    setCuisinePreference,
    setFoodPreference,
    updateGoals,
    logBodyMeasurement,
    setTargetWeight,
  };
}
