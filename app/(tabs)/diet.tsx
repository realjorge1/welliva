/**
 * DIET — the nutrition home.
 *
 * Today's plan + the premium intelligence layer, all offline:
 *   • Nutrition Progress Rings  — calories + protein/carbs/fat rings
 *   • Protein Alerts            — paced protein status (getProteinStatus)
 *   • Consistency Score         — 0–100 from recent adherence
 *   • Weekly summary            — this week's adherence + macro averages
 *   • Smart Swaps               — meal alternatives ranked to your remaining
 *                                 budget, in the swap sheet + as meal hints
 *
 * All matching/scheduling/persistence logic is unchanged — the engines are
 * pure and compose the existing single-source services.
 */

import {
  AppText,
  Button,
  Card,
  GradientIconButton,
  IconBadge,
  Pill,
  ProgressBar,
  Reveal,
  Ring,
  Screen,
  SectionHeader,
  ThemedIcon,
  useColors,
} from "@/components/ui";
import {
  ConsistencyGraph,
  MacroTrendsCard,
  WeekDonut,
  buildAdherenceTrend,
  buildMacroMatrix,
  fullDate,
  shortDate,
  type MacroDescriptor,
  type MacroRangeData,
} from "@/components/charts";
import {
  DIET_DATABASE,
  DietData,
  DietMealOption,
  DietSnackOption,
  ensureDietLibraryLoaded,
  isConditionDiet,
} from "@/constants/DietDatabase";
import { GozlinButton, GozlinToast, useToast } from "@/components/gozlin";
import { ActionBar, ScreenTopBar } from "@/components/navigation";
import { SyncStatusPill } from "@/components/sync/SyncStatusPill";
import { CrashTrigger, ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { DisclaimerNote } from "@/components/legal";
import { useBilling } from "@/contexts/BillingContext";
import { clampHistoryDays, isHistoryRangeLocked } from "@/services/billing";
import { TargetGuidanceNote } from "@/components/nutrition/TargetGuidanceNote";
import {
  dayProvenance,
  provenanceLine,
} from "@/services/nutrition/dayProvenance";
import { mealsForSlot } from "@/services/nutrition/MealCatalog";
import { TargetsRecalcCard } from "@/components/nutrition/TargetsRecalcCard";
import { Gradients, Radius, Spacing, alpha } from "@/constants/theme";
import { useNutrition, useProfile, useSystem } from "@/contexts/AppContext";
import { useMealPlan } from "@/contexts/MealPlanContext";
import { PlanDurationPicker } from "@/components/diet/PlanDurationPicker";
import { DietMatchScore, ScheduledMeal } from "@/models/diet";
import {
  daysBetween,
  formatDuration,
  parseLocalDate,
  resolveEndDate,
  type PlanDuration,
} from "@/models/mealPlan";
import { router } from "expo-router";
import {
  calculateDietMatches,
  getMedicationAdvisories,
  getRecommendedDiets,
  getSafeOptionDiets,
} from "@/services/DietMatchService";
import {
  buildDietReasons,
  computeConsistency,
  computeWeeklySummary,
  findMealAlternative,
  getProteinStatus,
  hasSmartSwap,
  learnMealTimes,
  rankMealSwaps,
  type ConsistencyScore,
  type LiveDay,
  type ProteinStatus,
  type SmartSwap,
  type WeeklyNutritionSummary,
} from "@/services/intelligence";
import { currentWeekStart } from "@/services/OfflineStorage";
import { Ionicons } from "@expo/vector-icons";
import AILogoIcon from "@/components/gozlin/AILogoIcon";
import { MealsList, type MealListItem } from "@/components/diet";
import * as Haptics from "@/utils/haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Colors = ReturnType<typeof useColors>["colors"];

function toneColor(tone: "positive" | "nudge" | "warning", colors: Colors): string {
  return tone === "positive"
    ? colors.success
    : tone === "warning"
      ? colors.warning
      : colors.primary;
}

const avg = (r?: { min: number; max: number }) =>
  r ? Math.round((r.min + r.max) / 2) : 0;

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

// Default center time (minutes from midnight) for each slot — used when we have
// no real signal yet (e.g. the first meal of the day, nothing logged).
const DEFAULT_CENTER: Record<MealSlot, number> = {
  breakfast: 8 * 60, // 8:00 AM
  lunch: 13 * 60, // 1:00 PM
  dinner: 19 * 60, // 7:00 PM
  snack: 16 * 60, // 4:00 PM
};

// Typical gap (minutes) from the previously eaten meal to this one — lets the
// window track the user's real pace today (ate breakfast late → lunch shifts).
const GAP_AFTER_PREV: Record<MealSlot, number> = {
  breakfast: 0, // first meal, never anchored to a prior one
  lunch: 4 * 60 + 30, // ~4.5h after breakfast
  dinner: 5 * 60 + 30, // ~5.5h after lunch
  snack: 2 * 60 + 30, // ~2.5h after the previous meal
};

const WINDOW_HALF = 45; // ± minutes around the suggested center

function fmtClock(mins: number): string {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  let h = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(mm).padStart(2, "0")} ${ampm}`;
}

// Build the suggested eating window for `type`. Priority, most → least specific:
//   1. `anchorMins` — the time the PREVIOUS meal was actually eaten today, so
//      the window tracks the user's real pace right now.
//   2. `learnedMins` — the user's typical clock time for THIS slot, averaged
//      from history (cross-day learning).
//   3. the slot's default center — when there's no signal yet.
type WindowSource = "anchor" | "learned" | "default";

function mealWindow(
  type: MealSlot,
  anchorMins: number | null,
  learnedMins: number | null,
): { window: string; source: WindowSource } {
  let center: number;
  let source: WindowSource;
  if (anchorMins != null && type !== "breakfast") {
    center = anchorMins + GAP_AFTER_PREV[type];
    source = "anchor";
  } else if (learnedMins != null) {
    center = learnedMins;
    source = "learned";
  } else {
    center = DEFAULT_CENTER[type];
    source = "default";
  }
  center = Math.min(Math.max(center, 5 * 60), 23 * 60 + 30); // keep same-day sane
  return {
    window: `${fmtClock(center - WINDOW_HALF)} – ${fmtClock(center + WINDOW_HALF)}`,
    source,
  };
}

const WINDOW_HINT: Record<WindowSource, string> = {
  anchor: "Timed to your pace today",
  learned: "Learned from your usual times",
  default: "Based on a typical day",
};

// Vivid ring gradients — deeper and far more saturated than the shared
// Gradients tokens so the nutrition rings pop against the white page instead of
// fading into it. Against white, saturation + darker ends = the contrast.
const RING_GRADIENTS = {
  calories: ["#FF9A2E", "#F25C05"] as const,
  protein: ["#14D6AE", "#06937A"] as const,
  carbs: ["#FBBF1A", "#E08600"] as const,
  fat: ["#8B6BFF", "#5B33E6"] as const,
} as const;

// Order of the clinical families in the picker's "Browse all diets" section.
// Diets with no category (the original hand-authored set) fall under "Core &
// Popular"; any unknown family sorts to the end.
const FAMILY_ORDER = [
  "Core & Popular",
  "Lifestyle & Goal-Based Nutrition",
  "Cardiovascular & Metabolic",
  "Digestive & Gastrointestinal",
  "Renal, Hepatic & Endocrine",
  "Hormonal, Reproductive & Life-Stage",
  "Neurological, Cognitive & Mental Health",
  "Immune, Inflammatory & Musculoskeletal",
  "Cancer, Recovery & Clinical Nutrition",
  "Allergy, Intolerance & Elimination",
  "Fitness, Performance & Body Composition",
  "Ethical, Cultural & Plant-Based",
];

type DietBrowseGroup = {
  family: string;
  items: { diet: DietData; match: DietMatchScore }[];
};

export default function DietScreen() {
  const { colors, isDark } = useColors();
  const { tier, openUpgrade } = useBilling();

  const { userBio, nutritionTargets } = useProfile();
  const {
    todayDiet,
    dietHistory,
    toggleMealConsumed,
    swapMeal,
    autoGenerateDietPlan,
    scheduleWeeklyDietPlan,
    consumedNutrition,
  } = useNutrition();
  const { currentDate } = useSystem();
  const {
    activePeriod,
    periodProgress,
    finishedPeriod,
    startPeriod,
    backlogPrompt,
    backlogMeal,
    dismissBacklogPrompt,
    todayFoodLog,
  } = useMealPlan();

  const insets = useSafeAreaInsets();
  const toast = useToast();

  // A period that has run its course takes over the screen: the user asked for
  // a plan of a certain length, it finished, and the result is the payoff. It
  // is shown once (dismissReport marks it seen) and then archived.
  useEffect(() => {
    if (finishedPeriod) {
      router.push(`/diet/report/${finishedPeriod.id}`);
    }
  }, [finishedPeriod]);

  // The alternative meal surfaced for the "next" meal, shown in an interactive
  // toast; null when nothing is offered. Confirming swaps it in for today.
  const [altSuggestion, setAltSuggestion] = useState<{
    option: DietMealOption;
    match: number;
    mealType: MealSlot;
    snackIndex?: number;
  } | null>(null);

  const [showDietModal, setShowDietModal] = useState(false);
  const [selectedDiet, setSelectedDiet] = useState<DietData | null>(null);
  const [selectedMatchScore, setSelectedMatchScore] =
    useState<DietMatchScore | null>(null);
  // Duration of the plan being started. "custom" carries an explicit end date,
  // which is what lets a plan run for months rather than the old day/week only.
  const [scheduleDuration, setScheduleDuration] = useState<PlanDuration>("day");
  const [customEndDate, setCustomEndDate] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapMealType, setSwapMealType] = useState<
    "breakfast" | "lunch" | "dinner" | "snack"
  >("breakfast");
  const [swapSnackIndex, setSwapSnackIndex] = useState<number | undefined>();
  const [showCustomMealForm, setShowCustomMealForm] = useState(false);
  const [customMeal, setCustomMeal] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  // The full clinical diet library is lazy-loaded (Phase D — bundle trim), so
  // DIET_DATABASE holds only the base diets until it arrives. Load it, then flip
  // `dietLibraryReady` so the memos below recompute over the complete catalog.
  const [dietLibraryReady, setDietLibraryReady] = useState(false);
  useEffect(() => {
    let alive = true;
    ensureDietLibraryLoaded().then(() => {
      if (alive) setDietLibraryReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const { recommended, safeOptions } = useMemo(() => {
    if (!userBio) return { recommended: [], safeOptions: [] };
    return {
      recommended: getRecommendedDiets(userBio),
      safeOptions: getSafeOptionDiets(userBio),
    };
    // `dietLibraryReady` recomputes matches once the full library loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userBio, dietLibraryReady]);

  // Every non-blocked diet grouped by clinical family. Powers the "Browse all
  // diets" section so the full 100+ library is reachable without flooding the
  // top of the picker with a hundred cards.
  const dietBrowse = useMemo<DietBrowseGroup[]>(() => {
    if (!userBio) return [];
    const byId = new Map(
      calculateDietMatches(userBio).map((m) => [m.dietId, m]),
    );
    const groups = new Map<string, { diet: DietData; match: DietMatchScore }[]>();
    for (const diet of DIET_DATABASE) {
      const match = byId.get(diet.id);
      if (!match || match.isBlocked) continue;
      const family = diet.category ?? "Core & Popular";
      const bucket = groups.get(family);
      if (bucket) bucket.push({ diet, match });
      else groups.set(family, [{ diet, match }]);
    }
    const rank = (f: string) => {
      const i = FAMILY_ORDER.indexOf(f);
      return i === -1 ? FAMILY_ORDER.length : i;
    };
    return [...groups.entries()]
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([family, items]) => ({
        family,
        items: items.sort((x, y) => y.match.score - x.match.score),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userBio, dietLibraryReady]);

  const browseCount = useMemo(
    () => dietBrowse.reduce((n, g) => n + g.items.length, 0),
    [dietBrowse],
  );

  // Food advisories for the user's medication kinds (empty when none apply).
  const medicationAdvisories = useMemo(
    () => (userBio ? getMedicationAdvisories(userBio) : []),
    [userBio],
  );

  // Open the diet picker fresh on the list step (clears any prior selection so
  // "Change" always lands on the list, never a stale schedule step).
  const openDietModal = useCallback(() => {
    setSelectedDiet(null);
    setSelectedMatchScore(null);
    setShowDietModal(true);
  }, []);

  // Picking a diet advances the SAME modal to its opaque schedule step — no
  // second modal, so there's no transparent overlay and no present/dismiss race.
  //
  // Every diet in the catalog is selectable on every tier — there is no lock and
  // no paywall branch here. See services/billing/tiers.ts ("The diet catalog is
  // FREE") for why that stopped being a tier boundary.
  const handleSelectDiet = useCallback(
    (diet: DietData, matchScore: DietMatchScore) => {
      setSelectedDiet(diet);
      setSelectedMatchScore(matchScore);
      setScheduleDuration("day");
      setCustomEndDate(null);
      Haptics.selectionAsync().catch(() => {});
    },
    [],
  );

  // Back from the schedule step to the diet list (same modal).
  const backToDietList = useCallback(() => {
    setSelectedDiet(null);
    setSelectedMatchScore(null);
  }, []);

  const handleScheduleDiet = useCallback(async () => {
    if (!selectedDiet) return;
    if (!userBio || !nutritionTargets) {
      Alert.alert(
        "Profile needed",
        "Complete your profile so we can build a meal plan that matches your targets.",
      );
      return;
    }

    setIsScheduling(true);
    try {
      // Record the COMMITMENT first. The period is what makes the plan a
      // stretch of time rather than a fact about today — it's what the midnight
      // rollover consults and what the closing report is built from. Generating
      // days without one is how the app used to lose track of "I'm doing this
      // for six weeks".
      const endDate = resolveEndDate(
        currentDate,
        scheduleDuration,
        customEndDate ?? undefined,
      );
      await startPeriod({
        mode: "diet",
        dietId: selectedDiet.id,
        dietName: selectedDiet.name,
        label: selectedDiet.name,
        durationKind: scheduleDuration,
        startDate: currentDate,
        customEndDate: endDate,
      });

      // Then fill the days. A single-day period only needs today; anything
      // longer seeds the current week now and the rollover generates the rest
      // day by day (which keeps a six-month plan from generating 180 days up
      // front).
      if (scheduleDuration === "day") {
        await autoGenerateDietPlan(selectedDiet.id);
      } else {
        await scheduleWeeklyDietPlan(selectedDiet.id);
      }

      setShowDietModal(false);
      setSelectedDiet(null);
      setSelectedMatchScore(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );

      const days = daysBetween(currentDate, endDate) + 1;
      Alert.alert(
        "Plan started",
        `${selectedDiet.name} is set for ${formatDuration(days)}. We'll bring each day's meals up automatically at midnight.`,
      );
    } catch (error) {
      console.error("Error scheduling diet:", error);
      Alert.alert("Error", "Failed to schedule diet. Please try again.");
    } finally {
      setIsScheduling(false);
    }
  }, [
    selectedDiet,
    scheduleDuration,
    customEndDate,
    currentDate,
    userBio,
    nutritionTargets,
    startPeriod,
    autoGenerateDietPlan,
    scheduleWeeklyDietPlan,
  ]);

  const handleToggleMeal = useCallback(
    async (
      mealType: "breakfast" | "lunch" | "dinner" | "snack",
      snackIndex?: number,
    ) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await toggleMealConsumed(mealType, snackIndex);
    },
    [toggleMealConsumed],
  );

  const handleOpenSwapModal = useCallback(
    (
      mealType: "breakfast" | "lunch" | "dinner" | "snack",
      snackIndex?: number,
    ) => {
      setSwapMealType(mealType);
      setSwapSnackIndex(snackIndex);
      setShowCustomMealForm(false);
      setCustomMeal({ name: "", calories: "", protein: "", carbs: "", fat: "" });
      setShowSwapModal(true);
    },
    [],
  );

  const currentDietData = useMemo(() => {
    if (!todayDiet?.schedule?.dietId) return null;
    return DIET_DATABASE.find((d) => d.id === todayDiet.schedule!.dietId) || null;
  }, [todayDiet]);

  /**
   * What "swap this meal" offers.
   *
   * A day the user hand-planned follows NO diet, so there is no diet to draw
   * alternatives from — `currentDietData` is null by design (see
   * services/CustomMenuSchedule). Falling through to `[]` there would leave the
   * sheet saying "0 options · tap to swap", which is a dead end on exactly the
   * days the user is most engaged. The whole meal library is the honest answer:
   * they chose this meal by hand, so they get the same shelf back to change it.
   */
  const swapOptions = useMemo<(DietMealOption | DietSnackOption)[]>(() => {
    if (!currentDietData) return mealsForSlot(swapMealType);
    switch (swapMealType) {
      case "breakfast":
        return currentDietData.breakfastOptions;
      case "lunch":
        return currentDietData.lunchOptions;
      case "dinner":
        return currentDietData.dinnerOptions;
      case "snack":
        return currentDietData.snackOptions;
      default:
        return [];
    }
  }, [currentDietData, swapMealType]);

  const handleSwapMealOption = useCallback(
    async (option: DietMealOption | DietSnackOption) => {
      const isSnackOption = !("protein" in option);
      const newMeal: ScheduledMeal = {
        id: `meal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        mealType: swapMealType,
        name: option.name,
        calories: option.calories,
        proteinG: isSnackOption
          ? (option as DietSnackOption).protein ?? { min: 0, max: 5 }
          : (option as DietMealOption).protein,
        carbsG: isSnackOption
          ? (option as DietSnackOption).carbs ?? { min: 10, max: 20 }
          : (option as DietMealOption).carbs,
        fatG: isSnackOption
          ? (option as DietSnackOption).fat ?? { min: 2, max: 8 }
          : (option as DietMealOption).fat,
        isNigerian: option.isNigerian,
        cuisine: "cuisine" in option ? option.cuisine : undefined,
        isConsumed: false,
      };
      await swapMeal(swapMealType, newMeal, swapSnackIndex);
      Haptics.selectionAsync().catch(() => {});
      setShowSwapModal(false);
    },
    [swapMealType, swapSnackIndex, swapMeal],
  );

  const handleCustomMealSubmit = useCallback(async () => {
    if (!customMeal.name.trim()) {
      Alert.alert("Missing Info", "Please enter a meal name.");
      return;
    }
    const cal = parseInt(customMeal.calories) || 300;
    const prot = parseInt(customMeal.protein) || 15;
    const carb = parseInt(customMeal.carbs) || 30;
    const fat = parseInt(customMeal.fat) || 10;

    const newMeal: ScheduledMeal = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      mealType: swapMealType,
      name: customMeal.name.trim(),
      calories: { min: cal, max: cal },
      proteinG: { min: prot, max: prot },
      carbsG: { min: carb, max: carb },
      fatG: { min: fat, max: fat },
      isConsumed: false,
    };
    await swapMeal(swapMealType, newMeal, swapSnackIndex);
    setShowSwapModal(false);
    setShowCustomMealForm(false);
  }, [customMeal, swapMealType, swapSnackIndex, swapMeal]);

  const getScoreColor = (score: number) => {
    if (score >= 87) return colors.success;
    if (score >= 75) return colors.warning;
    return colors.textTertiary;
  };

  // ── Derived nutrition state (single source: consumed + targets + history) ──

  /* What share of today's calories was actually measured. Derived here
     rather than in the context because only this screen shows the total it
     qualifies — see services/nutrition/dayProvenance.ts for why a day is a
     SHARE and not a weakest-link label. */
  const measuredLabel = useMemo(
    () => provenanceLine(dayProvenance(todayFoodLog)),
    [todayFoodLog],
  );

  const consumed = useMemo(
    () => ({
      calories: consumedNutrition.calories,
      proteinG: consumedNutrition.proteinG,
      carbsG: consumedNutrition.carbsG,
      fatG: consumedNutrition.fatG,
    }),
    [consumedNutrition],
  );

  const liveDay = useMemo<LiveDay | undefined>(() => {
    const s = todayDiet?.schedule;
    if (!s) return undefined;
    let total = 0;
    let done = 0;
    const tally = (m: ScheduledMeal | null) => {
      if (m) {
        total++;
        if (m.isConsumed) done++;
      }
    };
    tally(s.breakfast);
    tally(s.lunch);
    tally(s.dinner);
    s.snacks.forEach(tally);
    return { date: currentDate, mealsConsumed: done, totalMeals: total };
  }, [todayDiet?.schedule, currentDate]);

  const mealsRemaining = liveDay
    ? Math.max(1, liveDay.totalMeals - liveDay.mealsConsumed)
    : 1;

  // Cross-day learned eating times per slot (avg clock time from history).
  const learnedMealTimes = useMemo(
    () => learnMealTimes(dietHistory, currentDate),
    [dietHistory, currentDate],
  );

  // The next meal to eat: first un-consumed slot in the natural day order
  // (breakfast → lunch → dinner → snacks). Drives the "up next" hint + best
  // time window on the active-diet banner. Null once everything is done.
  const nextMeal = useMemo(() => {
    const s = todayDiet?.schedule;
    if (!s) return null;
    const sequence: {
      type: MealSlot;
      label: string;
      meal: ScheduledMeal | null;
      snackIndex?: number;
    }[] = [
      { type: "breakfast", label: "Breakfast", meal: s.breakfast },
      { type: "lunch", label: "Lunch", meal: s.lunch },
      { type: "dinner", label: "Dinner", meal: s.dinner },
      ...s.snacks.map((m, i) => ({
        type: "snack" as const,
        label: s.snacks.length > 1 ? `Snack ${i + 1}` : "Snack",
        meal: m,
        snackIndex: i,
      })),
    ];
    const idx = sequence.findIndex(
      (item) => item.meal && !item.meal.isConsumed,
    );
    if (idx === -1) return null;
    const next = sequence[idx];
    if (!next.meal) return null;

    // Anchor off the most recent meal actually eaten today (its consumedAt),
    // so the suggested window tracks the user's real pace.
    let anchorMins: number | null = null;
    for (let i = idx - 1; i >= 0; i--) {
      const prev = sequence[i].meal;
      if (prev?.isConsumed && prev.consumedAt) {
        const d = new Date(prev.consumedAt);
        if (!Number.isNaN(d.getTime())) {
          anchorMins = d.getHours() * 60 + d.getMinutes();
          break;
        }
      }
    }

    const { window, source } = mealWindow(
      next.type,
      anchorMins,
      learnedMealTimes[next.type] ?? null,
    );
    return {
      type: next.type,
      snackIndex: next.snackIndex,
      label: next.label,
      meal: next.meal,
      window,
      source,
    };
  }, [todayDiet?.schedule, learnedMealTimes]);

  const calorieProgress = useMemo(() => {
    if (!nutritionTargets) return 0;
    return Math.min(
      (consumed.calories / nutritionTargets.calories) * 100,
      100,
    );
  }, [consumed, nutritionTargets]);

  const caloriesLeft = nutritionTargets
    ? Math.max(0, Math.round(nutritionTargets.calories - consumed.calories))
    : 0;

  const macroRings = useMemo(
    () => [
      {
        label: "Protein",
        consumed: Math.round(consumed.proteinG),
        target: Math.round(nutritionTargets?.proteinG ?? 0),
        gradient: RING_GRADIENTS.protein,
      },
      {
        label: "Carbs",
        consumed: Math.round(consumed.carbsG),
        target: Math.round(nutritionTargets?.carbsG ?? 0),
        gradient: RING_GRADIENTS.carbs,
        counterClockwise: true,
      },
      {
        label: "Fat",
        consumed: Math.round(consumed.fatG),
        target: Math.round(nutritionTargets?.fatG ?? 0),
        gradient: RING_GRADIENTS.fat,
        counterClockwise: true,
      },
    ],
    [consumed, nutritionTargets],
  );

  const proteinStatus = useMemo<ProteinStatus>(
    () => getProteinStatus({ consumed, targets: nutritionTargets }),
    [consumed, nutritionTargets],
  );

  const consistency = useMemo<ConsistencyScore>(
    () => computeConsistency(dietHistory, currentDate, liveDay),
    [dietHistory, currentDate, liveDay],
  );

  // Daily adherence timeline for the scrollable consistency graph — today's live
  // day is appended so the newest point tracks real-time progress.
  const adherenceTrend = useMemo(() => {
    // Bounded to the tier's window — free reads back 30 days, a paid tier all 90.
    const pts = buildAdherenceTrend(dietHistory, currentDate, clampHistoryDays(90, tier));
    if (liveDay && liveDay.totalMeals > 0) {
      const v = Math.round((liveDay.mealsConsumed / liveDay.totalMeals) * 100);
      const label = shortDate(currentDate);
      const last = pts[pts.length - 1];
      if (last && last.label === label) {
        pts[pts.length - 1] = { ...last, value: v };
      } else {
        pts.push({ value: v, label, fullLabel: fullDate(currentDate) });
      }
    }
    return pts;
  }, [dietHistory, currentDate, liveDay, tier]);

  const weekly = useMemo<WeeklyNutritionSummary>(
    () => computeWeeklySummary(dietHistory, currentWeekStart(), currentDate, liveDay),
    [dietHistory, currentDate, liveDay],
  );

  // Scrubbable nutrition history — every macro's real per-day intake overlaid
  // on ONE plot. Each range is aligned into shared rows (buildMacroMatrix) so
  // calories/protein/carbs/fat line up sample-for-sample; the card indexes them
  // to a shared starting point so their incomparable units share one axis.
  const macroRanges = useMemo<MacroRangeData[]>(() => {
    const ranges = [
      { key: "1W", label: "1 wk", days: 7 },
      { key: "1M", label: "1 mo", days: 30 },
      { key: "3M", label: "3 mo", days: 90 },
    ];
    return ranges.map((r) => {
      const rows = buildMacroMatrix(dietHistory, currentDate, r.days);
      return {
        key: r.key,
        label: r.label,
        labels: rows.map((p) => p.label),
        fullLabels: rows.map((p) => p.fullLabel),
        values: {
          calories: rows.map((p) => p.calories),
          protein: rows.map((p) => p.proteinG),
          carbs: rows.map((p) => p.carbsG),
          fat: rows.map((p) => p.fatG),
        },
        locked: isHistoryRangeLocked(r.days, tier),
      };
    });
  }, [dietHistory, currentDate, tier]);

  const macroDescriptors = useMemo<MacroDescriptor[]>(
    () => [
      { key: "calories", label: "Calories", unit: "kcal", color: colors.calories, gradient: Gradients.calories },
      { key: "protein", label: "Protein", unit: "g", color: colors.protein, gradient: Gradients.protein },
      { key: "carbs", label: "Carbs", unit: "g", color: colors.carbs, gradient: Gradients.carbs },
      { key: "fat", label: "Fat", unit: "g", color: colors.fat, gradient: Gradients.fat },
    ],
    [colors],
  );

  // Smart-swap hints on the main meals (does a clearly-better option exist?)
  const smartHints = useMemo(() => {
    const s = todayDiet?.schedule;
    if (!currentDietData || !nutritionTargets || !s) {
      return { breakfast: false, lunch: false, dinner: false };
    }
    const check = (
      options: DietMealOption[],
      current: ScheduledMeal | null,
    ) =>
      !!hasSmartSwap({
        options,
        current,
        targets: nutritionTargets,
        consumed,
        slotsRemaining: mealsRemaining,
      });
    return {
      breakfast: check(currentDietData.breakfastOptions, s.breakfast),
      lunch: check(currentDietData.lunchOptions, s.lunch),
      dinner: check(currentDietData.dinnerOptions, s.dinner),
    };
  }, [currentDietData, nutritionTargets, consumed, mealsRemaining, todayDiet?.schedule]);

  // All of today's meal slots in display order — breakfast, lunch, dinner, then
  // snacks — flattened into one list for the single "Today's meals" card. Empty
  // slots are dropped so dividers only appear between real meals.
  const mealRows = useMemo(() => {
    const s = todayDiet?.schedule;
    if (!s) return [];
    const rows: {
      key: string;
      mealType: MealSlot;
      label: string;
      meal: ScheduledMeal | null;
      snackIndex?: number;
      smartSwap?: boolean;
    }[] = [
      { key: "breakfast", mealType: "breakfast", label: "Breakfast", meal: s.breakfast, smartSwap: smartHints.breakfast },
      { key: "lunch", mealType: "lunch", label: "Lunch", meal: s.lunch, smartSwap: smartHints.lunch },
      { key: "dinner", mealType: "dinner", label: "Dinner", meal: s.dinner, smartSwap: smartHints.dinner },
      ...s.snacks.map((snack, idx) => ({
        key: `snack-${idx}`,
        mealType: "snack" as MealSlot,
        label: s.snacks.length > 1 ? `Snack ${idx + 1}` : "Snack",
        meal: snack,
        snackIndex: idx,
      })),
    ];
    return rows.filter((r) => r.meal);
  }, [todayDiet?.schedule, smartHints]);

  // Flatten into the premium meal-list model (one card per meal), then order so
  // active (unchecked) meals sit on top and checked ones drop below in the order
  // they were completed — the list animates each card to its new slot.
  const mealItems = useMemo<MealListItem[]>(() => {
    const items = mealRows
      .filter((r) => r.meal)
      .map((r, i) => ({
        key: r.key,
        id: r.meal!.id,
        mealType: r.mealType,
        snackIndex: r.snackIndex,
        label: r.label,
        name: r.meal!.name,
        calories: avg(r.meal!.calories),
        proteinG: avg(r.meal!.proteinG),
        carbsG: avg(r.meal!.carbsG),
        fatG: avg(r.meal!.fatG),
        completed: !!r.meal!.isConsumed,
        smartSwap: r.smartSwap,
        order: i,
        consumedAt: r.meal!.consumedAt,
      }));
    return items.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (!a.completed) return a.order - b.order;
      // Both done: earliest-checked first, falling back to plan order.
      return (
        (a.consumedAt ?? "").localeCompare(b.consumedAt ?? "") ||
        a.order - b.order
      );
    });
  }, [mealRows]);

  // Current meal in the slot being swapped (for smart-pick deltas).
  const currentSlotMeal = useMemo<ScheduledMeal | null>(() => {
    const s = todayDiet?.schedule;
    if (!s) return null;
    if (swapMealType === "snack") {
      return typeof swapSnackIndex === "number"
        ? s.snacks[swapSnackIndex] ?? null
        : null;
    }
    return s[swapMealType] ?? null;
  }, [todayDiet?.schedule, swapMealType, swapSnackIndex]);

  const smartPicks = useMemo<SmartSwap[]>(() => {
    if (!nutritionTargets || swapOptions.length === 0) return [];
    return rankMealSwaps({
      options: swapOptions,
      current: currentSlotMeal,
      targets: nutritionTargets,
      consumed,
      slotsRemaining: mealsRemaining,
    })
      .filter((s) => s.option.name !== currentSlotMeal?.name)
      .slice(0, 3);
  }, [swapOptions, currentSlotMeal, nutritionTargets, consumed, mealsRemaining]);

  // Options for a given slot in the active diet — the pool an alternative is
  // drawn from.
  const optionsForType = useCallback(
    (type: MealSlot): (DietMealOption | DietSnackOption)[] => {
      if (!currentDietData) return [];
      switch (type) {
        case "breakfast":
          return currentDietData.breakfastOptions;
        case "lunch":
          return currentDietData.lunchOptions;
        case "dinner":
          return currentDietData.dinnerOptions;
        case "snack":
          return currentDietData.snackOptions;
        default:
          return [];
      }
    },
    [currentDietData],
  );

  // Offer a same-cuisine, nutrition-matched alternative for the next meal. Never
  // a random pick — findMealAlternative enforces a ≥90% nutrition match and
  // returns nothing if no option is close enough.
  const handleSuggestAlternative = useCallback(() => {
    if (!nextMeal) return;
    Haptics.selectionAsync().catch(() => {});
    const alt = findMealAlternative({
      options: optionsForType(nextMeal.type),
      current: nextMeal.meal,
    });
    if (!alt) {
      setAltSuggestion(null);
      toast.show("No close nutrition match — tap the meal to see every option.", {
        icon: "search",
        tone: "default",
      });
      return;
    }
    setAltSuggestion({
      option: alt.option,
      match: alt.match,
      mealType: nextMeal.type,
      snackIndex: nextMeal.snackIndex,
    });
  }, [nextMeal, optionsForType, toast]);

  // Confirm the alternative: swap it into today's schedule (this day only) and
  // confirm with a toast. The next-meal card animates to the new meal.
  const handleConfirmAlternative = useCallback(async () => {
    if (!altSuggestion) return;
    const { option, mealType, snackIndex } = altSuggestion;
    const newMeal: ScheduledMeal = {
      id: `alt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      mealType,
      name: option.name,
      calories: option.calories,
      proteinG: option.protein,
      carbsG: option.carbs,
      fatG: option.fat,
      isNigerian: option.isNigerian,
      cuisine: option.cuisine,
      isConsumed: false,
    };
    setAltSuggestion(null);
    await swapMeal(mealType, newMeal, snackIndex);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    toast.show(`Swapped to ${option.name}`, {
      icon: "swap-horizontal",
      tone: "success",
    });
  }, [altSuggestion, swapMeal, toast]);

  const hasDiet = !!todayDiet?.hasScheduledDiet && !!todayDiet.schedule;
  const showProteinAlert =
    proteinStatus.state === "behind" ||
    proteinStatus.state === "low" ||
    proteinStatus.state === "ahead";

  const header = (
    <Reveal index={0}>
      <ScreenTopBar
        style={styles.header}
        title={
          <>
            <AppText variant="title">Diet</AppText>
            {/* Only ever visible when something hasn't reached the cloud. */}
            <SyncStatusPill style={styles.syncPill} />
          </>
        }
        // The caption sits opposite the name, under the coach — so the header
        // reads as two balanced columns rather than one left-hand stack.
        titleRight={
          <AppText
            variant="subhead"
            color="secondary"
            align="right"
            numberOfLines={1}
          >
            {hasDiet ? "Your plan for today" : "Build your nutrition plan"}
          </AppText>
        }
        trailing={<GozlinButton />}
        right={
          hasDiet ? (
            <GradientIconButton
              icon="swap-horizontal"
              onPress={openDietModal}
              accessibilityLabel="Change diet plan"
            />
          ) : undefined
        }
      />
    </Reveal>
  );

  return (
    <>
      {/* Dev-only: open with ?crash=1 or ?crash=tab:diet — see AppErrorBoundary. */}
      {__DEV__ && <CrashTrigger surface="tab:diet" />}
      <Screen header={header} footer={<ActionBar />}>
        {/* Active plan period — what you committed to and how far through it
            you are. Without this the app can show today's meals but never says
            what they're part of. */}
        {activePeriod && periodProgress && (
          <Reveal index={0}>
            <Card style={styles.block}>
              <View style={styles.periodHead}>
                <IconBadge
                  name={activePeriod.mode === "custom" ? "create" : "restaurant"}
                  tone={colors.primary}
                  size={40}
                />
                <View style={styles.flex}>
                  <AppText variant="callout">{activePeriod.label}</AppText>
                  <AppText variant="footnote" color="tertiary">
                    Day {periodProgress.day} of {periodProgress.total} ·{" "}
                    {periodProgress.remaining === 0
                      ? "last day"
                      : `${periodProgress.remaining} to go`}
                  </AppText>
                </View>
                <Pressable
                  onPress={() => router.push("/diet/history")}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Meal history"
                >
                  <Ionicons name="calendar-outline" size={22} color={colors.textTertiary} />
                </Pressable>
              </View>
              <View style={[styles.periodTrack, { backgroundColor: colors.surfaceMuted }]}>
                <View
                  style={[
                    styles.periodFill,
                    {
                      width: `${(periodProgress.day / periodProgress.total) * 100}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>
              <AppText variant="caption" color="tertiary" style={styles.periodEnds}>
                Ends {parseLocalDate(activePeriod.endDate).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
                {activePeriod.mode === "custom" ? " · you're planning this one yourself" : ""}
              </AppText>
            </Card>
          </Reveal>
        )}

        {/* Yesterday's unticked meals — the one-day grace window. */}
        {backlogPrompt && (
          <Reveal index={0}>
            <Card
              style={[
                styles.block,
                { borderColor: alpha(colors.warning, 0.45), borderWidth: 1 },
              ]}
            >
              <View style={styles.medHead}>
                <IconBadge name="time" tone={colors.warning} size={40} />
                <View style={styles.flex}>
                  <AppText variant="callout">Did you have these and forget to log?</AppText>
                  <AppText variant="footnote" color="tertiary" style={styles.medSub}>
                    Yesterday · you can still tick them today, then the day closes
                  </AppText>
                </View>
                <Pressable
                  onPress={dismissBacklogPrompt}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss"
                >
                  <Ionicons name="close" size={18} color={colors.textTertiary} />
                </Pressable>
              </View>
              {backlogPrompt.unloggedMeals.slice(0, 4).map((m) => (
                <Pressable
                  key={`${m.mealType}-${m.snackIndex ?? 0}-${m.name}`}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    void backlogMeal(backlogPrompt.date, m.mealType, m.snackIndex);
                  }}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`Log ${m.name} for ${m.mealType}`}
                  accessibilityHint="Marks this meal as eaten"
                  style={[styles.backlogRow, { borderTopColor: colors.border }]}
                >
                  <Ionicons name="ellipse-outline" size={20} color={colors.textTertiary} />
                  <View style={styles.flex}>
                    <AppText variant="subhead">{m.name}</AppText>
                    <AppText variant="caption" color="tertiary">
                      {m.mealType}
                    </AppText>
                  </View>
                  <AppText variant="caption" color="brand">
                    I had this
                  </AppText>
                </Pressable>
              ))}
              <Pressable
                onPress={() => router.push("/diet/history")}
                accessibilityRole="button"
                accessibilityLabel="See the full day"
                style={styles.backlogAll}
              >
                <AppText variant="caption" color="brand">
                  See the full day
                </AppText>
              </Pressable>
            </Card>
          </Reveal>
        )}

        {/* Medication food advisories — gentle, non-drug-specific heads-up */}
        {medicationAdvisories.length > 0 && (
          <Reveal index={0}>
            <Card style={[styles.block, { borderColor: alpha(colors.warning, 0.4), borderWidth: 1 }]}>
              <View style={styles.medHead}>
                <IconBadge name="medkit" tone={colors.warning} size={40} />
                <View style={styles.flex}>
                  <AppText variant="callout">Heads up for your meds</AppText>
                  <AppText variant="footnote" color="tertiary" style={styles.medSub}>
                    Small things that help your meals work with you
                  </AppText>
                </View>
              </View>
              {medicationAdvisories.map((advice, i) => (
                <View key={i} style={styles.medRow}>
                  <Ionicons name="ellipse" size={6} color={colors.warning} />
                  <AppText variant="footnote" color="secondary" style={styles.flex}>
                    {advice}
                  </AppText>
                </View>
              ))}
            </Card>
          </Reveal>
        )}

        {hasDiet ? (
          <>
            {/* Active diet banner */}
            <Reveal index={1}>
              <Card
                style={[
                  styles.block,
                  styles.banner,
                  // Light mode: a crisp black outline; dark mode unchanged.
                  { borderColor: isDark ? alpha(colors.primary, 0.25) : "#000000" },
                ]}
                bordered
                padding="lg"
              >
                <View style={styles.bannerRow}>
                  <IconBadge
                    name={(currentDietData?.icon as any) || "restaurant"}
                    tone={colors.primary}
                    size={54}
                  />
                  <View style={styles.flex}>
                    <View style={styles.bannerTag}>
                      <Ionicons
                        name={todayDiet!.source === "weekly" ? "calendar" : "today"}
                        size={12}
                        color={colors.primary}
                      />
                      <AppText variant="caption" color="brand" uppercase style={styles.bold}>
                        {todayDiet!.source === "weekly" ? "Weekly plan" : "Today's plan"}
                      </AppText>
                    </View>
                    <AppText variant="headline" numberOfLines={2} style={styles.bannerName}>
                      {todayDiet!.schedule!.dietName}
                    </AppText>
                    {currentDietData?.description && (
                      <AppText
                        variant="footnote"
                        color="tertiary"
                        numberOfLines={2}
                        style={styles.bannerDesc}
                      >
                        {currentDietData.description}
                      </AppText>
                    )}
                  </View>
                </View>

                {/* Up next — the next meal to eat + its best time window */}
                <View style={[styles.nextMeal, { borderTopColor: colors.divider }]}>
                  {nextMeal ? (
                    <>
                      <View style={styles.nextMealHead}>
                        <Ionicons name="time-outline" size={14} color={colors.primary} />
                        <AppText
                          variant="caption"
                          color="brand"
                          uppercase
                          style={[styles.bold, styles.flex]}
                        >
                          Up next · {nextMeal.label}
                        </AppText>
                        <Pressable
                          onPress={handleSuggestAlternative}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel="Suggest an alternative meal"
                          style={[styles.altBtn, { backgroundColor: colors.primarySoft }]}
                        >
                          {/* High-contrast label: white on dark, black on light. */}
                          <Ionicons
                            name="shuffle"
                            size={13}
                            color={isDark ? "#FFFFFF" : "#000000"}
                          />
                          <AppText
                            variant="caption"
                            color={isDark ? "#FFFFFF" : "#000000"}
                            style={styles.bold}
                          >
                            Alternative
                          </AppText>
                        </Pressable>
                      </View>
                      <FadeSwap triggerKey={nextMeal.meal.id}>
                        <AppText
                          variant="callout"
                          numberOfLines={2}
                          style={styles.nextMealName}
                        >
                          {nextMeal.meal.name || "Not set"}
                        </AppText>
                        <View style={styles.nextMealMeta}>
                          <Pill
                            label={`Best ${nextMeal.window}`}
                            tone={colors.primary}
                            size="sm"
                            icon="time"
                          />
                          <AppText variant="footnote" color="tertiary">
                            {avg(nextMeal.meal.calories)} kcal · P{" "}
                            {avg(nextMeal.meal.proteinG)}g
                          </AppText>
                        </View>
                        <AppText
                          variant="caption"
                          color="tertiary"
                          style={styles.nextMealHint}
                        >
                          {WINDOW_HINT[nextMeal.source]}
                        </AppText>
                      </FadeSwap>
                    </>
                  ) : (
                    <View style={styles.nextMealHead}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={colors.success}
                      />
                      <AppText variant="callout" color="secondary">
                        All meals complete for today 🎉
                      </AppText>
                    </View>
                  )}
                </View>
              </Card>
            </Reveal>

            {/* Nutrition progress rings — daily summary */}
            {nutritionTargets && (
              <>
                <View style={styles.heroRow}>
                  <Ring
                    progress={calorieProgress / 100}
                    size={132}
                    strokeWidth={12}
                    gradient={RING_GRADIENTS.calories}
                  >
                    <AppText variant="metric" style={styles.ringPct}>
                      {Math.round(calorieProgress)}
                      <AppText variant="headline" color="tertiary">
                        %
                      </AppText>
                    </AppText>
                    <AppText variant="caption" color="tertiary" uppercase>
                      of goal
                    </AppText>
                  </Ring>
                  <View style={styles.heroInfo}>
                    <AppText variant="caption" color="tertiary" uppercase>
                      Calories
                    </AppText>
                    <AppText variant="display">
                      {Math.round(consumed.calories)}
                    </AppText>
                    <AppText variant="subhead" color="secondary">
                      of {Math.round(nutritionTargets.calories)} kcal
                    </AppText>
                    <View style={styles.heroChips}>
                      <Pill
                        label={`${caloriesLeft} kcal left`}
                        tone={colors.calories}
                        size="sm"
                      />
                      {liveDay && (
                        <Pill
                          label={`${liveDay.mealsConsumed}/${liveDay.totalMeals} meals`}
                          tone={colors.primary}
                          size="sm"
                        />
                      )}
                      {/* How much of the number above was READ from a food
                          composition table rather than estimated. Silent on a
                          fully-measured day, so the label stays worth reading
                          on the days it appears. See dayProvenance.ts.

                          Tappable now: the chip states the caveat, /diet/receipts
                          shows the evidence behind it. A chip that raises a doubt
                          and offers no way to check it is the worse half of an
                          honest design. */}
                      {measuredLabel && (
                        <Pressable
                          onPress={() => router.push("/diet/receipts")}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`${measuredLabel}. See where today's numbers came from`}
                        >
                          <Pill
                            label={measuredLabel}
                            tone={colors.textSecondary}
                            size="sm"
                          />
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.divider }]} />

                <View style={styles.macroRingGrid}>
                  {macroRings.map((m) => (
                    <MacroRing key={m.label} {...m} colors={colors} />
                  ))}
                </View>

                {/* One-time: if the numbers above MOVED because we fixed how
                    they're computed, say so where they're shown. Self-dismissing
                    and silent for everyone else. */}
                <TargetsRecalcCard style={styles.disclaimer} />

                {/* When a condition CONSTRAINED these numbers (a renal protein
                    cap, a diabetic carb cap), the reason and the referral ride
                    with them — a capped number shown bare reads as a
                    prescription. Renders nothing when nothing was constrained. */}
                <TargetGuidanceNote
                  guidance={nutritionTargets.guidance}
                  style={styles.disclaimer}
                />

                {/* These targets are estimates from population formulas — the
                    disclaimer sits with the numbers, not three screens away. */}
                <DisclaimerNote compact style={styles.disclaimer} />

                {/*
                  THE RECEIPT DOOR.

                  Present on every day with something logged, including a
                  perfectly measured one — unlike the caveat chip above, which
                  hides itself at 100% so that it stays worth reading when it
                  does appear. Both rules are right: the chip is a warning and
                  earns attention by being rare; this is an invitation to check
                  our work, and an invitation that only appears on our bad days
                  would be a strange thing to offer.

                  It is the most defensible thing this app does and it was
                  invisible. See app/diet/receipts.tsx. */}
                {todayFoodLog.length > 0 && (
                  <Pressable
                    onPress={() => router.push("/diet/receipts")}
                    style={({ pressed }) => [
                      styles.receiptRow,
                      { borderTopColor: colors.divider, opacity: pressed ? 0.6 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="See where today's numbers came from"
                    accessibilityHint="Opens a per-item list of the reference table behind every figure"
                  >
                    <Ionicons name="receipt-outline" size={16} color={colors.textSecondary} />
                    <AppText variant="footnote" color="secondary" style={styles.receiptRowText}>
                      Where these numbers came from
                    </AppText>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </Pressable>
                )}
              </>
            )}

            {/* Protein alert */}
            {nutritionTargets && showProteinAlert && (
              <Reveal index={3}>
                <Card
                  style={styles.block}
                  padding="lg"
                  bordered
                  elevation="xs"
                >
                  <View style={styles.alertRow}>
                    <IconBadge
                      name={proteinStatus.tone === "positive" ? "checkmark-circle" : "barbell"}
                      tone={toneColor(proteinStatus.tone, colors)}
                      size={44}
                    />
                    <View style={styles.flex}>
                      <AppText variant="callout">{proteinStatus.title}</AppText>
                      <AppText
                        variant="subhead"
                        color="secondary"
                        style={styles.alertMsg}
                      >
                        {proteinStatus.message}
                      </AppText>
                      <ProgressBar
                        progress={proteinStatus.pct}
                        tone={colors.protein}
                        height={6}
                        style={styles.alertBar}
                      />
                    </View>
                  </View>
                </Card>
              </Reveal>
            )}

            {/* Consistency score — bare on the page, no card */}
            <Reveal index={5}>
              <View style={styles.section}>
                <SectionHeader title="Consistency" weight="700" />
                <View style={styles.consistRow}>
                  <Ring
                    progress={consistency.score / 100}
                    size={96}
                    strokeWidth={10}
                    gradient={colors.brandGradient}
                  >
                    <AppText variant="title" style={styles.bold}>
                      {consistency.score}
                    </AppText>
                  </Ring>
                  <View style={styles.flex}>
                    <View style={styles.consistHead}>
                      <AppText variant="headline">{consistency.label}</AppText>
                      <TrendIcon trend={consistency.trend} colors={colors} />
                    </View>
                    <AppText variant="subhead" color="secondary" style={styles.consistSub}>
                      {consistency.daysTracked > 0
                        ? `Tracked ${consistency.daysTracked} of the last 7 days. Keep meals logged to grow your score.`
                        : "Log meals to start building your consistency score."}
                    </AppText>
                  </View>
                </View>
                <View style={styles.consistGraph}>
                  <ConsistencyGraph points={adherenceTrend} />
                </View>
              </View>
            </Reveal>

            {/* Meals — each an individual premium swipeable card */}
            {mealItems.length > 0 && (
              <Reveal index={6}>
                <View style={styles.section}>
                  <SectionHeader title="Today's meals" weight="700" />
                  <MealsList
                    meals={mealItems}
                    onToggle={handleToggleMeal}
                    onSwap={handleOpenSwapModal}
                  />
                </View>
              </Reveal>
            )}

            {/* Ate something off-plan? Describe it and get the real label.
                Sits alongside the plan rather than inside it — logging a banana
                isn't evidence you ate the planned lunch. */}
            <Reveal index={6}>
              <View style={styles.section}>
                <SectionHeader title="Anything else today?" weight="700" />
                <Card onPress={() => router.push("/diet/log-food")}>
                  <View style={styles.logRow}>
                    <IconBadge name="sparkles" tone={colors.primary} size={40} />
                    <View style={styles.flex}>
                      <AppText variant="callout">Tell Gozlin what you ate</AppText>
                      <AppText variant="footnote" color="tertiary" style={styles.medSub}>
                        {`Describe it or photograph it — full nutrition, sourced from USDA data, not guessed`}
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </View>
                  {todayFoodLog.length > 0 && (
                    <View style={[styles.logged, { borderTopColor: colors.border }]}>
                      {todayFoodLog.slice(0, 3).map((entry) => (
                        <View key={entry.id} style={styles.loggedRow}>
                          <AppText variant="subhead" style={styles.flex} numberOfLines={1}>
                            {entry.label}
                          </AppText>
                          <AppText variant="subhead" color="secondary">
                            {entry.totals.calories !== undefined
                              ? `${Math.round(entry.totals.calories)} kcal`
                              : "—"}
                          </AppText>
                        </View>
                      ))}
                      {todayFoodLog.length > 3 && (
                        <AppText variant="caption" color="tertiary">
                          +{todayFoodLog.length - 3} more logged today
                        </AppText>
                      )}
                    </View>
                  )}
                </Card>

                {/* The other way in: browse rather than describe. Both land in
                    the same food log, so this is a second door on one room —
                    not a second system. Foods used to be reachable only from
                    the menu's secondary list, which left the whole catalog
                    stranded away from the screen it feeds. */}
                <Card
                  onPress={() => router.push("/foods")}
                  style={styles.medTop}
                  accessibilityLabel="Browse the whole-foods catalog"
                >
                  <View style={styles.logRow}>
                    <IconBadge name="nutrition" tone={colors.success} size={40} />
                    <View style={styles.flex}>
                      <AppText variant="callout">Browse whole foods</AppText>
                      <AppText variant="footnote" color="tertiary" style={styles.medSub}>
                        Search the catalog, pick a portion, see the full label
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </View>
                </Card>
              </View>
            </Reveal>

            {/* Plan it yourself — the no-diet path. */}
            <Reveal index={7}>
              <View style={styles.section}>
                <Card onPress={() => router.push("/diet/plan-menu")}>
                  <View style={styles.logRow}>
                    <IconBadge name="create-outline" tone={colors.textSecondary} size={40} />
                    <View style={styles.flex}>
                      <AppText variant="callout">Plan your own menu</AppText>
                      <AppText variant="footnote" color="tertiary" style={styles.medSub}>
                        Pick specific meals for specific days — no diet required
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </View>
                </Card>
              </View>
            </Reveal>

            {/* Weekly summary */}
            <Reveal index={7}>
              <View style={styles.section}>
                <SectionHeader title="This week" weight="700" />
                <WeeklyCard summary={weekly} colors={colors} />
              </View>
            </Reveal>

            {/* Nutrition trends — every macro overlaid on one scrubbable plot */}
            <Reveal index={8}>
              <View style={styles.section}>
                <SectionHeader title="Nutrition trends" weight="700" />
                <MacroTrendsCard
                  macros={macroDescriptors}
                  ranges={macroRanges}
                  initialRangeKey="1W"
                  emptyHint="Log a few days of meals and your macro trends appear here."
                  onLockedRangePress={() => openUpgrade("history")}
                />
              </View>
            </Reveal>
          </>
        ) : (
          /* Empty state */
          <Reveal index={1}>
            <Card style={styles.block} padding="xxxl">
              <View style={styles.emptyInner}>
                <IconBadge name="restaurant" tone={colors.primary} size={72} />
                <AppText variant="title" style={styles.emptyTitle}>
                  No diet scheduled
                </AppText>
                <AppText
                  variant="body"
                  color="secondary"
                  align="center"
                  style={styles.emptySub}
                >
                  Create a personalized plan matched to your health profile and goals.
                </AppText>
                <Button
                  label="Auto-generate plan"
                  icon="flash"
                  onPress={() => autoGenerateDietPlan()}
                  style={styles.emptyBtn}
                />
                <Button
                  label="Choose a diet"
                  icon="options-outline"
                  variant="tonal"
                  onPress={openDietModal}
                />
              </View>
            </Card>

            {todayDiet?.reminder && todayDiet.reminder.type !== "none" && (
              <Card
                style={styles.block}
                bordered={false}
                elevation="none"
                padding="lg"
              >
                <View style={styles.reminderRow}>
                  <Ionicons
                    name={
                      todayDiet.reminder.type === "expired"
                        ? "time"
                        : "checkmark-circle"
                    }
                    size={20}
                    color={
                      todayDiet.reminder.type === "expired"
                        ? colors.warning
                        : colors.success
                    }
                  />
                  <AppText variant="subhead" color="secondary" style={styles.flex}>
                    {todayDiet.reminder.message}
                  </AppText>
                </View>
              </Card>
            )}
          </Reveal>
        )}
      </Screen>

      {/* ── Diet picker + schedule (one opaque sheet, two steps) ── */}
      <Modal
        visible={showDietModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() =>
          selectedDiet ? backToDietList() : setShowDietModal(false)
        }
      >
        <SafeAreaView style={[styles.modal, { backgroundColor: colors.background }]}>
          {selectedDiet ? (
            /* Step 2 — schedule the chosen diet (opaque, in-flow) */
            <>
              <ModalHeader
                title="Schedule diet"
                onBack={backToDietList}
                onClose={() => setShowDietModal(false)}
                colors={colors}
              />
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalBody}
              >
                <Card
                  padding="xl"
                  bordered
                  elevation="none"
                  style={styles.scheduleSummary}
                >
                  <View style={styles.bannerRow}>
                    <IconBadge
                      name={(selectedDiet.icon as any) || "restaurant"}
                      tone={colors.primary}
                      size={48}
                    />
                    <View style={styles.flex}>
                      <AppText variant="headline" numberOfLines={1}>
                        {selectedDiet.name}
                      </AppText>
                      {selectedMatchScore && (
                        <View style={styles.scheduleMatch}>
                          <Pill
                            label={`${Math.round(selectedMatchScore.score)}% match`}
                            tone={getScoreColor(selectedMatchScore.score)}
                            size="sm"
                          />
                        </View>
                      )}
                    </View>
                  </View>
                  <AppText
                    variant="subhead"
                    color="secondary"
                    numberOfLines={3}
                    style={styles.scheduleDesc}
                  >
                    {selectedDiet.description}
                  </AppText>
                </Card>

                <AppText variant="headline" style={styles.modalSection}>
                  How long would you like to follow this diet?
                </AppText>
                <AppText
                  variant="subhead"
                  color="tertiary"
                  style={styles.modalSectionSub}
                >
                  You can swap meals or change diets anytime.
                </AppText>

                <PlanDurationPicker
                  startDate={currentDate}
                  value={scheduleDuration}
                  customEndDate={customEndDate}
                  onChange={(duration, end) => {
                    setScheduleDuration(duration);
                    setCustomEndDate(end);
                  }}
                />

                <Button
                  label={
                    isScheduling
                      ? "Starting…"
                      : scheduleDuration === "day"
                        ? "Start today's plan"
                        : scheduleDuration === "week"
                          ? "Start this week's plan"
                          : `Start ${formatDuration(
                              daysBetween(
                                currentDate,
                                resolveEndDate(
                                  currentDate,
                                  scheduleDuration,
                                  customEndDate ?? undefined,
                                ),
                              ) + 1,
                            )} plan`
                  }
                  icon={isScheduling ? undefined : "flash"}
                  onPress={handleScheduleDiet}
                  disabled={isScheduling}
                  loading={isScheduling}
                  style={styles.scheduleStart}
                />
                <Button
                  label="Back to diets"
                  variant="ghost"
                  onPress={backToDietList}
                  disabled={isScheduling}
                />
              </ScrollView>
            </>
          ) : (
            /* Step 1 — choose a diet */
            <>
              <ModalHeader
                title="Choose a diet"
                onClose={() => setShowDietModal(false)}
                colors={colors}
              />
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
            {recommended.length > 0 && (
              <>
                <AppText variant="headline" style={styles.modalSection}>
                  Recommended for you
                </AppText>
                <AppText variant="subhead" color="tertiary" style={styles.modalSectionSub}>
                  87–96% match based on your profile
                </AppText>
                {recommended.map((match) => {
                  const diet = DIET_DATABASE.find((d) => d.id === match.dietId);
                  if (!diet) return null;
                  return (
                    <DietCard
                      key={match.dietId}
                      match={match}
                      diet={diet}
                      isRecommended
                      colors={colors}
                      isDark={isDark}
                      userBio={userBio}
                      nutritionTargets={nutritionTargets}
                      scoreColor={getScoreColor(match.score)}
                      onSelect={handleSelectDiet}
                    />
                  );
                })}
              </>
            )}

            {safeOptions.length > 0 && (
              <>
                <AppText variant="headline" style={[styles.modalSection, styles.modalSectionGap]}>
                  Other safe options
                </AppText>
                <AppText variant="subhead" color="tertiary" style={styles.modalSectionSub}>
                  75–86% match — compatible with your profile
                </AppText>
                {safeOptions.slice(0, 6).map((match) => {
                  const diet = DIET_DATABASE.find((d) => d.id === match.dietId);
                  if (!diet) return null;
                  return (
                    <DietCard
                      key={match.dietId}
                      match={match}
                      diet={diet}
                      isRecommended={false}
                      colors={colors}
                      isDark={isDark}
                      userBio={userBio}
                      nutritionTargets={nutritionTargets}
                      scoreColor={getScoreColor(match.score)}
                      onSelect={handleSelectDiet}
                    />
                  );
                })}
              </>
            )}

            {dietBrowse.length > 0 && (
              <>
                <AppText
                  variant="headline"
                  style={[styles.modalSection, styles.modalSectionGap]}
                >
                  Browse all diets
                </AppText>
                <AppText variant="subhead" color="tertiary" style={styles.modalSectionSub}>
                  {browseCount} diets across {dietBrowse.length} health areas · tap a
                  category to explore
                </AppText>
                <CategoryBrowser
                  groups={dietBrowse}
                  colors={colors}
                  onSelect={handleSelectDiet}
                  getScoreColor={getScoreColor}
                />
              </>
            )}

            {recommended.length === 0 && safeOptions.length === 0 && (
              <View style={styles.modalEmpty}>
                <IconBadge name="alert-circle" tone={colors.warning} size={56} />
                <AppText variant="body" color="secondary" align="center" style={styles.modalEmptyText}>
                  Complete your profile to get diet recommendations.
                </AppText>
              </View>
            )}
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* ── Meal swap modal ── */}
      <Modal
        visible={showSwapModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSwapModal(false)}
      >
        <SafeAreaView style={[styles.modal, { backgroundColor: colors.background }]}>
          <ModalHeader
            title={
              showCustomMealForm
                ? "Add custom meal"
                : `Choose ${swapMealType.charAt(0).toUpperCase()}${swapMealType.slice(1)}`
            }
            onClose={() => setShowSwapModal(false)}
            colors={colors}
          />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
            {showCustomMealForm ? (
              <View>
                <Field
                  label="Meal name *"
                  placeholder="e.g. Grilled chicken salad"
                  value={customMeal.name}
                  onChangeText={(t) => setCustomMeal((p) => ({ ...p, name: t }))}
                  colors={colors}
                />
                <View style={styles.fieldRow}>
                  <Field
                    label="Calories"
                    placeholder="300"
                    numeric
                    value={customMeal.calories}
                    onChangeText={(t) => setCustomMeal((p) => ({ ...p, calories: t }))}
                    colors={colors}
                    style={styles.flex}
                  />
                  <Field
                    label="Protein (g)"
                    placeholder="15"
                    numeric
                    value={customMeal.protein}
                    onChangeText={(t) => setCustomMeal((p) => ({ ...p, protein: t }))}
                    colors={colors}
                    style={styles.flex}
                  />
                </View>
                <View style={styles.fieldRow}>
                  <Field
                    label="Carbs (g)"
                    placeholder="30"
                    numeric
                    value={customMeal.carbs}
                    onChangeText={(t) => setCustomMeal((p) => ({ ...p, carbs: t }))}
                    colors={colors}
                    style={styles.flex}
                  />
                  <Field
                    label="Fat (g)"
                    placeholder="10"
                    numeric
                    value={customMeal.fat}
                    onChangeText={(t) => setCustomMeal((p) => ({ ...p, fat: t }))}
                    colors={colors}
                    style={styles.flex}
                  />
                </View>
                <Button
                  label="Add meal"
                  icon="checkmark"
                  onPress={handleCustomMealSubmit}
                  style={styles.customSubmit}
                />
              </View>
            ) : (
              <View>
                <Pressable
                  onPress={() => setShowCustomMealForm(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Add custom meal"
                  style={[styles.dashedBtn, { borderColor: alpha(colors.primary, 0.5) }]}
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                  <AppText variant="callout" color="brand">
                    Add custom meal
                  </AppText>
                </Pressable>

                {/* Smart picks */}
                {smartPicks.length > 0 && (
                  <View style={styles.smartBlock}>
                    <View style={styles.smartHead}>
                      <AILogoIcon size={16} color={colors.primary} />
                      <AppText variant="headline">Smart picks</AppText>
                    </View>
                    <AppText variant="subhead" color="tertiary" style={styles.modalSectionSub}>
                      Ranked for the calories & protein you have left today
                    </AppText>
                    {smartPicks.map((pick, idx) => (
                      <SmartPickCard
                        key={idx}
                        pick={pick}
                        colors={colors}
                        onPress={() => handleSwapMealOption(pick.option)}
                      />
                    ))}
                  </View>
                )}

                <AppText variant="headline" style={styles.modalSection}>
                  {currentDietData
                    ? `All ${currentDietData.name} options`
                    : "The whole meal library"}
                </AppText>
                <AppText variant="subhead" color="tertiary" style={styles.modalSectionSub}>
                  {swapOptions.length} options · tap to swap
                </AppText>

                {swapOptions.map((option, idx) => {
                  const isMealOption = "protein" in option;
                  return (
                    <Card
                      key={idx}
                      onPress={() => handleSwapMealOption(option)}
                      style={styles.swapCard}
                      padding="lg"
                      elevation="xs"
                    >
                      <View style={styles.swapRow}>
                        <View style={styles.flex}>
                          <AppText variant="callout" numberOfLines={2}>
                            {option.name}
                          </AppText>
                          <AppText variant="footnote" color="tertiary" style={styles.swapMacros}>
                            {avg(option.calories)} kcal
                            {isMealOption &&
                              `  ·  P ${avg((option as DietMealOption).protein)}g  ·  C ${avg((option as DietMealOption).carbs)}g`}
                          </AppText>
                        </View>
                        {option.isNigerian && (
                          <Pill label="Nigerian" tone={colors.success} size="sm" />
                        )}
                        <ThemedIcon name="swap-horizontal" size={18} role="textTertiary" />
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Alternative-meal suggestion — an interactive toast; OK swaps it in */}
      <AlternativeToast
        suggestion={altSuggestion}
        colors={colors}
        isDark={isDark}
        bottomOffset={Math.max(insets.bottom, Spacing.md) + 96}
        onConfirm={handleConfirmAlternative}
        onDismiss={() => setAltSuggestion(null)}
      />

      {/* Confirmations ("Swapped to…", "No close match") */}
      <GozlinToast controller={toast} topOffset={insets.top} />
    </>
  );
}

/* ───────────────────────────── Sub-components ──────────────────────────── */

/**
 * FadeSwap — fades + lifts its children into place whenever `triggerKey`
 * changes. Wraps the next-meal details so a swap reads as a smooth update
 * rather than a hard content jump. No animation on first mount.
 */
function FadeSwap({
  triggerKey,
  children,
}: {
  triggerKey: string;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    opacity.setValue(0);
    translateY.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 70,
      }),
    ]).start();
  }, [triggerKey, opacity, translateY]);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

/**
 * AlternativeToast — an interactive bottom snackbar offering a nutrition-matched
 * alternative for the next meal. Slides up when a suggestion appears; "OK — swap
 * it" confirms, "Keep" dismisses.
 */
function AlternativeToast({
  suggestion,
  colors,
  isDark,
  bottomOffset,
  onConfirm,
  onDismiss,
}: {
  suggestion: { option: DietMealOption; match: number } | null;
  colors: Colors;
  isDark: boolean;
  bottomOffset: number;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!suggestion) return;
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    }).start();
  }, [suggestion, anim]);

  if (!suggestion) return null;
  const o = suggestion.option;

  return (
    <Animated.View
      style={[
        styles.altToastWrap,
        {
          bottom: bottomOffset,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [28, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.altToast,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: isDark ? colors.borderStrong : "#000000",
          },
        ]}
      >
        <View style={styles.altToastHead}>
          <AILogoIcon size={15} color={colors.primary} />
          <AppText
            variant="caption"
            color="brand"
            uppercase
            style={[styles.bold, styles.flex]}
          >
            Alternative · {Math.round(suggestion.match * 100)}% nutrition match
          </AppText>
          <Pressable
            onPress={onDismiss}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss suggestion"
          >
            <Ionicons name="close" size={18} color={colors.textTertiary} />
          </Pressable>
        </View>
        <AppText variant="callout" numberOfLines={2} style={styles.altToastName}>
          {o.name}
        </AppText>
        <AppText variant="footnote" color="tertiary" style={styles.altToastMacros}>
          {avg(o.calories)} kcal · P {avg(o.protein)}g · C {avg(o.carbs)}g · F{" "}
          {avg(o.fat)}g
        </AppText>
        <View style={styles.altToastActions}>
          <View style={styles.flex}>
            <Button
              label="OK — swap it"
              icon="swap-horizontal"
              size="sm"
              onPress={onConfirm}
            />
          </View>
          <Button
            label="Keep"
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={onDismiss}
          />
        </View>
      </View>
    </Animated.View>
  );
}

function MacroRing({
  label,
  consumed,
  target,
  gradient,
  counterClockwise,
  colors,
}: {
  label: string;
  consumed: number;
  target: number;
  gradient: readonly [string, string, ...string[]];
  counterClockwise?: boolean;
  colors: Colors;
}) {
  const pct = target > 0 ? consumed / target : 0;
  return (
    <View style={styles.macroRingItem}>
      <Ring
        progress={pct}
        size={86}
        strokeWidth={8}
        gradient={gradient}
        counterClockwise={counterClockwise}
      >
        <AppText variant="callout">{consumed}</AppText>
        <AppText variant="caption" color="tertiary">
          /{target}g
        </AppText>
      </Ring>
      <AppText variant="footnote" color="secondary" style={styles.macroRingLabel}>
        {label}
      </AppText>
    </View>
  );
}

function TrendIcon({
  trend,
  colors,
}: {
  trend: ConsistencyScore["trend"];
  colors: Colors;
}) {
  if (trend === "flat") return null;
  const up = trend === "up";
  return (
    <Ionicons
      name={up ? "trending-up" : "trending-down"}
      size={18}
      color={up ? colors.success : colors.warning}
    />
  );
}

function WeeklyCard({
  summary,
  colors,
}: {
  summary: WeeklyNutritionSummary;
  colors: Colors;
}) {
  const adherencePct = Math.round(summary.avgAdherence * 100);
  // No card: this renders straight on the page (like the nutrition rings above),
  // so it picks up the light page palette instead of the deep-cyan card surface.
  return (
    <View style={styles.weeklySummary}>
      <View style={styles.weeklyStats}>
        <WeeklyStat
          value={`${adherencePct}%`}
          label="Avg adherence"
          colors={colors}
        />
        <WeeklyStat
          value={`${summary.daysLogged}`}
          label="Days logged"
          colors={colors}
        />
        <WeeklyStat
          value={`${summary.daysCompleted}`}
          label="Days completed"
          colors={colors}
        />
      </View>

      {summary.daysLogged > 0 && (
        <View style={styles.weeklyPie}>
          <WeekDonut days={summary.perDay} />
        </View>
      )}

      {(summary.avgCalories != null || summary.avgProteinG != null) && (
        <View style={[styles.weeklyAvgRow, { borderTopColor: colors.divider }]}>
          {summary.avgCalories != null && (
            <View style={styles.weeklyAvgItem}>
              <View style={[styles.macroDot, { backgroundColor: colors.calories }]} />
              <AppText variant="footnote" color="secondary">
                Avg {summary.avgCalories} kcal eaten/day
              </AppText>
            </View>
          )}
          {summary.avgProteinG != null && (
            <View style={styles.weeklyAvgItem}>
              <View style={[styles.macroDot, { backgroundColor: colors.protein }]} />
              <AppText variant="footnote" color="secondary">
                Avg {summary.avgProteinG}g protein/day
              </AppText>
            </View>
          )}
        </View>
      )}

      {summary.daysLogged === 0 && (
        <AppText variant="subhead" color="tertiary" style={styles.weeklyEmpty}>
          Log meals through the week to see your trends here.
        </AppText>
      )}
    </View>
  );
}

function WeeklyStat({
  value,
  label,
  colors,
}: {
  value: string;
  label: string;
  colors: Colors;
}) {
  return (
    <View style={styles.weeklyStat}>
      <AppText variant="title" style={styles.bold}>
        {value}
      </AppText>
      <AppText variant="caption" color="tertiary" uppercase style={styles.weeklyStatLabel}>
        {label}
      </AppText>
    </View>
  );
}

function SmartPickCard({
  pick,
  colors,
  onPress,
}: {
  pick: SmartSwap;
  colors: Colors;
  onPress: () => void;
}) {
  const tagColor = (tone: SmartSwap["tags"][number]["tone"]) =>
    tone === "protein"
      ? colors.protein
      : tone === "calories"
        ? colors.calories
        : colors.success;
  const isMeal = "protein" in pick.option;
  return (
    <Card
      onPress={onPress}
      style={[
        styles.smartCard,
        pick.isBest && { borderColor: colors.primary, borderWidth: 1.5 },
      ]}
      padding="lg"
      elevation="xs"
    >
      <View style={styles.smartRow}>
        <View style={styles.flex}>
          <View style={styles.smartTitleRow}>
            <AppText variant="callout" numberOfLines={2} style={styles.flex}>
              {pick.option.name}
            </AppText>
            {pick.isBest && (
              <Pill label="Best fit" tone={colors.primary} size="sm" iconNode={<AILogoIcon size={11} color={colors.primary} />} />
            )}
          </View>
          <AppText variant="footnote" color="tertiary" style={styles.swapMacros}>
            {avg(pick.option.calories)} kcal
            {isMeal &&
              `  ·  P ${avg((pick.option as DietMealOption).protein)}g  ·  C ${avg((pick.option as DietMealOption).carbs)}g`}
          </AppText>
          <AppText variant="footnote" color="secondary" style={styles.smartReason}>
            {pick.reason}
          </AppText>
          {pick.tags.length > 0 && (
            <View style={styles.smartTags}>
              {pick.tags.map((t, i) => (
                <Pill key={i} label={t.label} tone={tagColor(t.tone)} size="sm" />
              ))}
            </View>
          )}
        </View>
        <Ionicons name="add-circle" size={26} color={colors.primary} />
      </View>
    </Card>
  );
}

function DietCard({
  match,
  diet,
  isRecommended,
  colors,
  isDark,
  userBio,
  nutritionTargets,
  scoreColor,
  onSelect,
}: {
  match: DietMatchScore;
  diet: DietData;
  isRecommended: boolean;
  colors: Colors;
  isDark: boolean;
  userBio: any;
  nutritionTargets: any;
  scoreColor: string;
  onSelect: (d: DietData, m: DietMatchScore) => void;
}) {
  const reasons = buildDietReasons(diet, userBio, nutritionTargets, match.reasons);
  return (
    <Card
      onPress={() => (match.isBlocked ? undefined : onSelect(diet, match))}
      style={styles.dietCard}
      padding="lg"
    >
      <View style={styles.dietHead}>
        <IconBadge
          name={(diet.icon as any) || "nutrition"}
          tone={match.isBlocked ? colors.textTertiary : colors.primary}
          size={44}
        />
        <View style={styles.flex}>
          <AppText variant="callout">{diet.name}</AppText>
          <View style={styles.dietBadges}>
            <Pill label={`${Math.round(match.score)}% match`} tone={scoreColor} size="sm" />
            {/* Names what the plan IS: a protocol authored around a diagnosis
                rather than a goal. Not a tier marker — the whole catalog is
                free — but the label is what tells someone managing a condition
                that this plan was built for it. */}
            {isConditionDiet(diet.id) && (
              <Pill label="CONDITION MODE" tone={colors.gold} size="sm" icon="medkit" />
            )}
            {isRecommended && (
              <Pill label="Recommended" tone={colors.success} size="sm" icon="checkmark-circle" />
            )}
          </View>
        </View>
      </View>

      <AppText variant="subhead" color="secondary" numberOfLines={2} style={styles.dietDesc}>
        {diet.description}
      </AppText>

      <View style={styles.dietTags}>
        <Tag label={diet.difficulty} />
        {diet.principles.emphasis.slice(0, 2).map((item, i) => (
          <Tag key={i} label={item} />
        ))}
      </View>

      {reasons.length > 0 && (
        <View style={[styles.reasons, { borderTopColor: colors.divider }]}>
          {reasons.slice(0, 3).map((r, i) => (
            <View key={i} style={styles.reasonRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <AppText variant="footnote" color="secondary" numberOfLines={1} style={styles.flex}>
                {r}
              </AppText>
            </View>
          ))}
        </View>
      )}

      {match.warnings && match.warnings.length > 0 && (
        <View style={[styles.warning, { borderTopColor: colors.divider }]}>
          <Ionicons name="warning" size={14} color={colors.warning} />
          <AppText variant="footnote" color="warning" style={styles.flex}>
            {match.warnings[0]}
          </AppText>
        </View>
      )}

      {match.isBlocked && (
        <View
          style={[
            styles.blocked,
            { backgroundColor: isDark ? "rgba(0,0,0,0.78)" : "rgba(255,255,255,0.82)" },
          ]}
        >
          <Pill label="Not suitable for your profile" tone={colors.textTertiary} />
        </View>
      )}
    </Card>
  );
}

function Tag({ label }: { label: string }) {
  const { colors } = useColors();
  return (
    <View style={[styles.tag, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
      <AppText variant="caption" color="secondary">
        {label}
      </AppText>
    </View>
  );
}

/**
 * CategoryBrowser — the full diet library grouped into collapsible clinical
 * families. Keeps the top of the picker concise (recommended + a few safe
 * options) while making every diet reachable. One family expands at a time.
 */
function CategoryBrowser({
  groups,
  colors,
  onSelect,
  getScoreColor,
}: {
  groups: DietBrowseGroup[];
  colors: Colors;
  onSelect: (d: DietData, m: DietMatchScore) => void;
  getScoreColor: (score: number) => string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <View style={styles.browse}>
      {groups.map(({ family, items }) => {
        const open = expanded === family;
        return (
          <View key={family} style={[styles.browseGroup, { borderColor: colors.border }]}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setExpanded(open ? null : family);
              }}
              accessible
              accessibilityRole="button"
              accessibilityLabel={family}
              accessibilityState={{ expanded: open }}
              style={styles.browseHead}
            >
              <View style={styles.flex}>
                <AppText variant="callout" numberOfLines={1}>
                  {family}
                </AppText>
                <AppText variant="caption" color="tertiary">
                  {items.length} {items.length === 1 ? "diet" : "diets"}
                </AppText>
              </View>
              <Ionicons
                name={open ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.textTertiary}
              />
            </Pressable>
            {open &&
              items.map(({ diet, match }) => {
                return (
                  <Pressable
                    key={diet.id}
                    onPress={() => onSelect(diet, match)}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={diet.name}
                    accessibilityHint="Selects this diet plan"
                    style={[styles.browseRow, { borderTopColor: colors.divider }]}
                  >
                    <IconBadge name={(diet.icon as any) || "nutrition"} tone={colors.primary} size={34} />
                    <View style={styles.flex}>
                      <AppText variant="subhead" numberOfLines={1}>
                        {diet.name}
                      </AppText>
                      <AppText variant="caption" color="tertiary" numberOfLines={1}>
                        {diet.difficulty}
                      </AppText>
                    </View>
                    <Pill
                      label={`${Math.round(match.score)}%`}
                      tone={getScoreColor(match.score)}
                      size="sm"
                    />
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </Pressable>
                );
              })}
          </View>
        );
      })}
    </View>
  );
}

function ModalHeader({
  title,
  onClose,
  onBack,
  colors,
}: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  colors: Colors;
}) {
  return (
    <View style={[styles.modalHeader, { borderBottomColor: colors.divider }]}>
      <View style={styles.modalHeaderLeft}>
        {onBack && (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[styles.closeBtn, { backgroundColor: colors.surfaceMuted }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        )}
        <AppText variant="title">{title}</AppText>
      </View>
      <Pressable
        onPress={onClose}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={[styles.closeBtn, { backgroundColor: colors.surfaceMuted }]}
      >
        <Ionicons name="close" size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  numeric,
  colors,
  style,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  numeric?: boolean;
  colors: Colors;
  style?: any;
}) {
  return (
    <View style={[styles.field, style]}>
      <AppText variant="footnote" color="secondary" style={styles.fieldLabel}>
        {label}
      </AppText>
      <TextInput
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={numeric ? "numeric" : "default"}
        value={value}
        onChangeText={onChangeText}
        maxFontSizeMultiplier={1.3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  browse: { marginTop: Spacing.sm, gap: Spacing.sm },
  browseGroup: { borderWidth: 1, borderRadius: Radius.lg, overflow: "hidden" },
  browseHead: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  browseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bold: { fontWeight: "700" },
  block: { marginBottom: Spacing.xl },
  section: { marginTop: Spacing.xxl },

  // Header
  header: { paddingTop: Spacing.sm, marginBottom: Spacing.xl },
  syncPill: { marginTop: Spacing.sm },

  // Medication advisories
  medHead: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.md },
  medSub: { marginTop: 2 },
  medTop: { marginTop: Spacing.md },

  // --- Plan period banner ---
  periodHead: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  periodTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: Spacing.md,
  },
  periodFill: { height: "100%", borderRadius: 3 },
  periodEnds: { marginTop: Spacing.sm },

  // --- Back-log prompt ---
  backlogRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  backlogAll: { alignItems: "center", paddingTop: Spacing.sm },

  // --- Free-form food logging ---
  logRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  logged: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  loggedRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  medRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.sm },

  // Banner
  banner: { borderWidth: 1 },
  bannerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  bannerTag: { flexDirection: "row", alignItems: "center", gap: 4 },
  bannerName: { marginTop: 4 },
  bannerDesc: { marginTop: 4 },

  // Up next (next-meal hint on the active-diet banner)
  nextMeal: { marginTop: Spacing.lg, paddingTop: Spacing.lg, borderTopWidth: 1 },
  nextMealHead: { flexDirection: "row", alignItems: "center", gap: 4 },
  altBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  nextMealName: { marginTop: 6 },
  nextMealMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  nextMealHint: { marginTop: 6 },

  // Alternative-meal toast (interactive bottom snackbar)
  altToastWrap: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 60,
  },
  altToast: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  altToastHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  altToastName: { marginTop: Spacing.sm },
  altToastMacros: { marginTop: 2 },
  altToastActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },

  // Hero
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xl,
    paddingLeft: Spacing.xl,
  },
  heroInfo: { flexShrink: 1, gap: 2 },
  heroChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm },
  ringPct: { fontWeight: "800" },
  divider: { height: 1, marginVertical: Spacing.xl },
  macroRingGrid: { flexDirection: "row", justifyContent: "space-around", marginBottom: Spacing.lg },
  receiptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  receiptRowText: { flex: 1 },
  disclaimer: { marginBottom: Spacing.xxl },
  macroRingItem: { alignItems: "center", gap: Spacing.sm },
  macroRingLabel: { marginTop: 2 },

  // Protein alert rows
  alertRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  alertMsg: { marginTop: 2 },
  alertBar: { marginTop: Spacing.sm },

  // Consistency
  consistRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xl },
  consistHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  consistSub: { marginTop: 4 },
  consistGraph: { marginTop: Spacing.lg, marginHorizontal: -Spacing.xs },

  // Weekly
  weeklySummary: { marginTop: Spacing.sm },
  weeklyStats: { flexDirection: "row", justifyContent: "space-between" },
  weeklyStat: { alignItems: "center", flex: 1 },
  weeklyStatLabel: { marginTop: 4, textAlign: "center" },
  weeklyPie: { marginTop: Spacing.xxl, marginBottom: Spacing.sm, paddingHorizontal: Spacing.xs },
  weeklyAvgRow: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  weeklyAvgItem: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  weeklyEmpty: { marginTop: Spacing.md, textAlign: "center" },
  macroDot: { width: 8, height: 8, borderRadius: 4 },

  // Smart picks
  smartBlock: { marginBottom: Spacing.lg },
  smartHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.sm },
  smartCard: { marginBottom: Spacing.sm },
  smartRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  smartTitleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  smartReason: { marginTop: 4 },
  smartTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm },

  // Empty
  emptyInner: { alignItems: "center" },
  emptyTitle: { marginTop: Spacing.lg },
  emptySub: { marginTop: Spacing.sm, marginBottom: Spacing.xl },
  emptyBtn: { marginBottom: Spacing.md },
  reminderRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },

  // Modals
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flexShrink: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: { padding: Spacing.screen, paddingBottom: Spacing.huge },
  modalSection: { marginTop: Spacing.lg },
  modalSectionGap: { marginTop: Spacing.xxxl },
  modalSectionSub: { marginTop: 2, marginBottom: Spacing.lg },
  modalEmpty: { alignItems: "center", paddingVertical: Spacing.huge },
  modalEmptyText: { marginTop: Spacing.lg },

  // Diet card
  dietCard: { marginBottom: Spacing.md, overflow: "hidden" },
  dietHead: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  dietBadges: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  dietDesc: { marginTop: Spacing.md },
  dietTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.md },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  reasons: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, gap: 6 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  blocked: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
  },

  // Schedule step (in-modal, fully opaque — no overlay)
  scheduleSummary: { marginTop: Spacing.lg, marginBottom: Spacing.sm },
  scheduleMatch: { flexDirection: "row", marginTop: 6 },
  scheduleDesc: { marginTop: Spacing.md },
  scheduleOptions: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.xl },
  scheduleOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  scheduleOptIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleOptText: { marginTop: 2 },
  scheduleStart: { marginBottom: Spacing.md },

  // Swap
  swapCard: { marginBottom: Spacing.sm },
  swapRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  swapMacros: { marginTop: 4 },
  dashedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginBottom: Spacing.lg,
  },

  // Fields
  field: { marginBottom: Spacing.md },
  fieldRow: { flexDirection: "row", gap: Spacing.md },
  fieldLabel: { marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 15,
  },
  customSubmit: { marginTop: Spacing.lg },
});

/**
 * LEVEL 3 — route-level boundary. Expo Router honours this named export, so a
 * throw inside this screen is contained here: the tab bar stays live and every
 * other tab stays usable. Only what this file couldn't render is lost.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="tab:diet" />;
}
