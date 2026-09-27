/**
 * ONBOARDING — a guided ritual, not a questionnaire.
 *
 * A first-person coach captures only what the engines truly need, in as few
 * beats as possible: goals → you → daily activity → (training, only if wanted)
 * → food → safety, then *builds and reveals* a personalized plan before Home so
 * the user arrives already invested.
 *
 * ── WHAT THIS FILE IS ─────────────────────────────────────────────────────
 * This file is the STEP MACHINE and the DATA. It owns every piece of state, the
 * branching, the validation bounds, `buildBio()`, the engine calls and the
 * save. It renders almost no layout of its own: the presentation lives in
 * `components/onboarding/flow`, which knows nothing about bios, targets or
 * persistence. That split is deliberate and load-bearing — the visual language
 * can be re-cut entirely without touching a single rule about what gets stored.
 *
 * ── DESIGN RULES THAT KEEP IT FROM FEELING LIKE AN EXAM ───────────────────
 *  • Multi-select goals; the choices BRANCH the flow. Pick a movement goal and
 *    we ask about training; pick only diet/health goals and we skip it entirely
 *    (workouts stay available in-app, and we offer to set them up later —
 *    see `trainingEnabled`).
 *  • Merged steps: age+sex+body on one screen, diet+cuisine+meals on one
 *    screen, experience+equipment+days on one screen.
 *  • Region is DETECTED silently from the device time-zone (no "what world are
 *    you in?" screen, no permission) — we only surface a tiny confirm chip.
 *  • Every question arrives before its options do. The ~500ms gap
 *    (`OPTIONS_DELAY`) is the beat where the screen is still and the user is
 *    reading; it is what makes this read as a conversation rather than a form
 *    that rendered.
 *  • …but not every question keeps that one tempo, or it is a quiz again. The
 *    three that open a chapter (goals, daily activity, health) HOLD the stage
 *    alone first, and their answers rise and push them up (`HELD_STEPS`,
 *    `QuestionStage`).
 *  • Every selection is acknowledged — the card settles, the siblings recede,
 *    and where it matters the flow says something back (`goalReaction`).
 *
 * ── WHAT THE SCREEN SHOWS IS WHAT GETS SAVED ──────────────────────────────
 * All plan numbers in the reveal are computed from the SAME bio that gets
 * persisted (`buildBio`), by the same engines the rest of the app uses. The
 * reveal animates the presentation of those numbers and never invents one.
 */

import {
  ActivityDeck,
  AnimatedQuestion,
  AnimatedText,
  Appear,
  BuildingAnimation,
  ChipField,
  CinematicExit,
  FoodPreferenceSelector,
  type GridOption,
  Gutter,
  HealthGroup,
  InputRow,
  MeasureMotif,
  MicroReaction,
  MultiSelectGrid,
  NoteField,
  NothingApplies,
  OnboardingActions,
  OnboardingContainer,
  OnboardingHeader,
  OnboardingTransition,
  OPTIONS_DELAY,
  Pace,
  PlanReveal,
  ProgressiveText,
  QuestionStage,
  Recede,
  SafetyMotif,
  SelectionCard,
  StaggerReveal,
  StepCentre,
  StepScroll,
  TrainingSelector,
  WelcomeVisual,
} from "@/components/onboarding/flow";
import { DisclaimerNote } from "@/components/legal";
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import * as Haptics from "@/utils/haptics";
import { detectRegion } from "@/utils/region";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, View, useWindowDimensions } from "react-native";
import { hasSeenNotificationPrimer } from "@/services/notifications/primer";
import { useProfile } from "../contexts/AppContext";
import { ensureDietLibraryLoaded } from "../constants/DietDatabase";
import { recommendDiets } from "../services/intelligence";
import { calculateNutritionTargets } from "../services/NutritionService";
import { currentWeekStart } from "../services/OfflineStorage";
import {
  ensureWorkoutExercisesLoaded,
  generateWorkoutPlan,
} from "../services/WorkoutGenerator";
import {
  ActivityLevel,
  CommonAllergy,
  CuisinePreference,
  DietaryRestriction,
  ExerciseLevel,
  MedicalCondition,
  PrimaryGoal,
  Sex,
  UserBio,
} from "../models/user";
import { Equipment } from "../models/workout";

type Step =
  | "welcome"
  | "goal"
  | "about"
  | "activity"
  | "training"
  | "food"
  | "health"
  | "building"
  | "plan";

/** Goals that imply the user wants structured training — presence of ANY of
 * these turns the training step (and in-plan workout card) on. */
const TRAINING_GOALS = new Set<PrimaryGoal>([
  "build_muscle",
  "improve_fitness",
  "athletic_performance",
]);

const SEX_OPTIONS: GridOption<Sex>[] = [
  { value: "male", label: "Male", glyph: "male" },
  { value: "female", label: "Female", glyph: "female" },
];

/**
 * Daily-activity levels — described by LIFESTYLE (job, errands, movement), not
 * by exercise, since training is captured separately. `level` drives the little
 * intensity meter on each card.
 */
const ACTIVITY_OPTIONS: {
  value: ActivityLevel;
  label: string;
  desc: string;
  level: number;
}[] = [
  { value: "sedentary", label: "Mostly sitting", desc: "Desk work, driving, screen time", level: 1 },
  { value: "light", label: "Lightly active", desc: "On my feet here and there", level: 2 },
  { value: "moderate", label: "Active", desc: "Moving for much of the day", level: 3 },
  { value: "active", label: "Very active", desc: "Physical job or hard training most days", level: 4 },
  { value: "very_active", label: "Extra active", desc: "Physical job AND daily training", level: 5 },
];

const EXERCISE_LEVEL_OPTIONS: GridOption<ExerciseLevel>[] = [
  { value: "beginner", label: "New to it", subtitle: "Just starting", glyph: "sprout" },
  { value: "intermediate", label: "Regular", subtitle: "Fairly often", glyph: "steady" },
  { value: "advanced", label: "Experienced", subtitle: "Second nature", glyph: "crest" },
];

const GOAL_OPTIONS: GridOption<PrimaryGoal>[] = [
  { value: "lose_weight", label: "Lose weight", glyph: "descend" },
  { value: "build_muscle", label: "Build muscle", glyph: "strength" },
  { value: "improve_fitness", label: "Get fit", glyph: "motion" },
  { value: "increase_energy", label: "More energy", glyph: "spark" },
  { value: "better_health", label: "Better health", glyph: "heart" },
  { value: "athletic_performance", label: "Perform better", glyph: "aim" },
];

/** Short verb phrase per goal for coach copy ("Built around your goal to …"). */
const GOAL_PHRASE: Record<PrimaryGoal, string> = {
  lose_weight: "lose weight",
  build_muscle: "build muscle",
  improve_fitness: "get fitter",
  increase_energy: "boost your energy",
  better_health: "feel healthier",
  athletic_performance: "perform at your best",
};

/**
 * What the flow says back when a goal is chosen. The FIRST goal picked becomes
 * `primaryGoal` and drives every engine, so the reaction names it out loud —
 * the rule was previously invisible, and a user who wanted a different one had
 * no way to know how to get it.
 */
const GOAL_REACTION: Record<PrimaryGoal, string> = {
  lose_weight: "Good. We'll shape your calories and meals around losing weight — steadily.",
  build_muscle: "Good. Protein and progressive training lead from here.",
  improve_fitness: "Good. We'll build a base you can actually keep.",
  increase_energy: "Good. Steady energy comes from how you eat and how you move — we'll do both.",
  better_health: "Good. Everything stays balanced, gentle and sustainable.",
  athletic_performance: "Good. We'll train for output and feed it properly.",
};

/** Sensible weekly training default per goal for users who skip the training step. */
const DEFAULT_DAYS_FOR_GOAL: Record<PrimaryGoal, number> = {
  lose_weight: 3,
  build_muscle: 4,
  improve_fitness: 4,
  increase_energy: 3,
  better_health: 3,
  athletic_performance: 5,
};

const DIETARY_RESTRICTION_OPTIONS: GridOption<DietaryRestriction>[] = [
  { value: "none", label: "No restrictions" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "halal", label: "Halal" },
  { value: "kosher", label: "Kosher" },
  { value: "gluten_free", label: "Gluten-free" },
  { value: "dairy_free", label: "Dairy-free" },
];

const CUISINE_OPTIONS: GridOption<CuisinePreference>[] = [
  { value: "mixed", label: "A bit of everything", subtitle: "Draw from all cuisines", glyph: "globe" },
  { value: "african", label: "African", subtitle: "Nigerian & West-African dishes", glyph: "leaf" },
  { value: "western", label: "European & Western", subtitle: "Classic Western meals", glyph: "plate" },
  { value: "mediterranean", label: "Mediterranean", subtitle: "Greek, Italian & coastal", glyph: "coast" },
];

/** Equipment the user can train with. Each unlocks real exercises in the DB. */
const EQUIPMENT_OPTIONS: GridOption<Equipment>[] = [
  { value: "none", label: "Bodyweight & mat", subtitle: "No gear — just you and the floor", glyph: "mat" },
  { value: "dumbbells", label: "Dumbbells", subtitle: "Adjustable or fixed", glyph: "strength" },
  { value: "resistance_bands", label: "Resistance bands", subtitle: "Loops or tubes", glyph: "band" },
  { value: "kettlebell", label: "Kettlebell", subtitle: "Any weight", glyph: "kettlebell" },
  { value: "pull_up_bar", label: "Pull-up bar", subtitle: "Doorway or wall-mounted", glyph: "bar" },
  { value: "bench", label: "Bench", subtitle: "Flat or adjustable", glyph: "bench" },
];

/** Short label for the equipment summary on the reveal. */
const EQUIPMENT_SHORT: Record<Equipment, string> = {
  none: "Bodyweight",
  dumbbells: "Dumbbells",
  resistance_bands: "Bands",
  pull_up_bar: "Pull-up bar",
  bench: "Bench",
  kettlebell: "Kettlebell",
};

/**
 * The bounds the About step accepts. They are shown in the field as a faint
 * scale — the user meets them before the alert does — and enforced on Continue
 * from these same numbers, so the guide can never promise a range the
 * validation then rejects.
 */
const HEIGHT_RANGE = { min: 100, max: 250 } as const;
const WEIGHT_RANGE = { min: 30, max: 300 } as const;

const WORKOUT_DAY_OPTIONS = [2, 3, 4, 5, 6];

const MEALS_OPTIONS: GridOption<string>[] = [
  { value: "3", label: "3 meals", subtitle: "Breakfast, lunch, dinner + a snack" },
  { value: "4", label: "4 meals", subtitle: "Three meals + two snacks" },
];

const ALLERGY_OPTIONS: { value: CommonAllergy; label: string }[] = [
  { value: "peanuts", label: "Peanuts" },
  { value: "tree_nuts", label: "Tree nuts" },
  { value: "dairy", label: "Dairy" },
  { value: "eggs", label: "Eggs" },
  { value: "shellfish", label: "Shellfish" },
  { value: "fish", label: "Fish" },
  { value: "wheat", label: "Wheat" },
  { value: "soy", label: "Soy" },
  { value: "gluten", label: "Gluten" },
];

/**
 * Medical conditions, GROUPED and COLLAPSED. Thirty flat pills read as an
 * intimidating wall; five closed rows that say how much they hold read as a
 * short scan with nothing hidden. "None" is lifted out into its own full-width
 * row above the groups rather than buried at the end.
 */
const MEDICAL_GROUPS: {
  title: string;
  items: GridOption<MedicalCondition>[];
}[] = [
  {
    title: "Heart & metabolic",
    items: [
      { value: "hypertension", label: "Hypertension" },
      { value: "high_cholesterol", label: "High cholesterol" },
      { value: "diabetes_type2", label: "Type 2 diabetes" },
      { value: "diabetes_type1", label: "Type 1 diabetes" },
      { value: "prediabetes", label: "Prediabetes" },
      { value: "metabolic_syndrome", label: "Metabolic syndrome" },
    ],
  },
  {
    title: "Digestive",
    items: [
      { value: "gerd", label: "Acid reflux / GERD" },
      { value: "ibs", label: "IBS" },
      { value: "ibd", label: "IBD (Crohn's / colitis)" },
      { value: "celiac", label: "Celiac / gluten" },
      { value: "diverticulitis", label: "Diverticulitis" },
      { value: "constipation", label: "Constipation" },
      { value: "lactose_intolerance", label: "Lactose intolerance" },
    ],
  },
  {
    title: "Liver, kidney & thyroid",
    items: [
      { value: "renal_issues", label: "Kidney issues" },
      { value: "fatty_liver", label: "Fatty liver" },
      { value: "gallbladder", label: "Gallbladder issues" },
      { value: "pancreatitis", label: "Pancreatitis" },
      { value: "hypothyroidism", label: "Hypothyroidism" },
      { value: "hyperthyroidism", label: "Hyperthyroidism" },
      { value: "gout", label: "Gout" },
    ],
  },
  {
    title: "Hormonal & life stage",
    items: [
      { value: "pcos", label: "PCOS" },
      { value: "endometriosis", label: "Endometriosis" },
      { value: "pregnancy", label: "Pregnancy" },
      { value: "postpartum", label: "Postpartum" },
      { value: "menopause", label: "Menopause" },
    ],
  },
  {
    title: "Bones, blood & other",
    items: [
      { value: "anemia", label: "Anemia (iron)" },
      { value: "arthritis", label: "Arthritis" },
      { value: "osteoporosis", label: "Osteoporosis" },
      { value: "migraine", label: "Migraine" },
    ],
  },
];

/** A short name for the beat the user is in — shown in the header so it says
 *  WHERE they are, not just how far along. */
const STEP_KICKER: Partial<Record<Step, string>> = {
  goal: "Your goals",
  about: "About you",
  activity: "Daily activity",
  training: "Training",
  food: "Food",
  health: "Health & safety",
};

/**
 * The questions that hold the stage alone before their answers rise (see
 * `QuestionStage`). Deliberately not all of them — a pause on every screen is
 * just a slower quiz. These three each open a chapter: what you want, how you
 * live, what could make a plan unsafe. "About you" is typing, and training and
 * food already unfold as sequences of their own.
 */
const HELD_STEPS = new Set<Step>(["goal", "activity", "health"]);

const BUILD_LINES = [
  "Calculating your calorie target…",
  "Matching you to the right diet…",
  "Designing your plan…",
  "Putting it all together…",
];

/** The welcome's score. The line finishes drawing at ~1350ms; type follows. */
const WELCOME = { title: 1350, support: 1500, chips: 1660, action: 2000 } as const;

/** Split by SENTENCE, never by line. Hard-wrapping the promise would read as
 *  a ragged three-line block on an SE and a short two-liner on a 15 Pro Max;
 *  whole sentences re-wrap correctly at every width. */
const WELCOME_LINES = [
  "A few quick questions and I’ll shape a diet and training plan around your life.",
  "About 2 minutes.",
];

const WELCOME_CHIPS = [
  "Meals for your goals",
  "Training that fits",
  "Safe by design",
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useProfile();
  const { colors } = useColors();
  const { width } = useWindowDimensions();
  /** Content width available to measured grids, inside the flow's gutters. */
  const contentWidth = width - Gutter * 2;

  // Preview mode (?preview=1): launched from the Profile "board" test button to
  // replay the whole flow. Everything looks identical to a new user, but the
  // final step DOESN'T persist or overwrite the real profile — it just exits.
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const isPreview = preview === "1";

  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [loading, setLoading] = useState(false);
  // The diet library + exercise pool are lazy-loaded (Phase D — bundle trim).
  // The plan preview reads both synchronously, so warm them up and recompute the
  // preview once ready (until then it would build from base diets / no exercises).
  const [plansReady, setPlansReady] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([ensureDietLibraryLoaded(), ensureWorkoutExercisesLoaded()]).then(
      () => {
        if (alive) setPlansReady(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const [goals, setGoals] = useState<PrimaryGoal[]>([]);
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [exerciseLevel, setExerciseLevel] = useState<ExerciseLevel>("beginner");
  const [dietaryRestriction, setDietaryRestriction] = useState<DietaryRestriction>("none");
  const [cuisinePreference, setCuisinePreference] = useState<CuisinePreference>("mixed");
  const [equipment, setEquipment] = useState<Equipment[]>(["none"]);
  const [workoutDaysPerWeek, setWorkoutDaysPerWeek] = useState<number>(4);
  const [mealsPerDay, setMealsPerDay] = useState<3 | 4>(3);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState("");
  const [medicalConditions, setMedicalConditions] = useState<MedicalCondition[]>([]);
  const [injuries, setInjuries] = useState("");
  const [medications, setMedications] = useState("");
  const [region, setRegion] = useState("");
  const [detectedRegion, setDetectedRegion] = useState<string | null>(null);

  /* ── Presentation-only state ──────────────────────────────────────────── */

  /** Which field on the "about" step holds the caret (the rest recede). */
  const [focusedField, setFocusedField] = useState<string | null>(null);
  /** How many of the training step's three questions are on screen (1–3). */
  const [trainingRevealed, setTrainingRevealed] = useState(1);
  /** Which of the food step's three questions is on screen (0–2). */
  const [foodQuestion, setFoodQuestion] = useState(0);
  /** Which medical group is open. Only one at a time — five open groups is
   *  the wall of thirty again, in a different shape. */
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  /** The final transition is running; the save may still be in flight. */
  const [exiting, setExiting] = useState(false);
  /**
   * The held step whose answers have not risen yet (see `HELD_STEPS`). The
   * action bar steps aside while a question has the stage to itself.
   */
  const [held, setHeld] = useState<Step | null>(null);
  const release = useCallback(() => setHeld(null), []);
  /** Steps already shown. A question holds the stage the first time only —
   *  coming back to it must never cost the pause twice. */
  const seen = useRef(new Set<Step>());
  /** The activity step's pending advance: a re-pick restarts it, leaving cancels it. */
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const primaryGoal = goals[0] ?? null;
  const trainingEnabled = useMemo(() => goals.some((g) => TRAINING_GOALS.has(g)), [goals]);

  // Ordered step machine + progress steps, both branching on `trainingEnabled`.
  const STEPS = useMemo<Step[]>(
    () => [
      "welcome",
      "goal",
      "about",
      "activity",
      ...(trainingEnabled ? (["training"] as Step[]) : []),
      "food",
      "health",
      "building",
      "plan",
    ],
    [trainingEnabled],
  );
  const FORM_STEPS = useMemo<Step[]>(
    () => STEPS.filter((s) => !["welcome", "building", "plan"].includes(s)),
    [STEPS],
  );

  // Detect region + a starting cuisine silently on mount — no screen, no prompt.
  useEffect(() => {
    const d = detectRegion();
    if (d.region) {
      setRegion(d.region);
      setDetectedRegion(d.region);
    }
    setCuisinePreference(d.cuisine);
  }, []);

  /* ── Step machine ─────────────────────────────────────────────────────── */

  const goTo = (step: Step, dir: "forward" | "back") => {
    // A pending activity advance belongs to the step being left. Without this,
    // tapping back before it fires would fire it from the PREVIOUS step and
    // skip the user two screens forward.
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    seen.current.add(currentStep);
    setHeld(HELD_STEPS.has(step) && !seen.current.has(step) ? step : null);
    setDirection(dir);
    setCurrentStep(step);
  };

  const nextStep = () => {
    const idx = STEPS.indexOf(currentStep);
    if (idx >= 0 && idx < STEPS.length - 1) {
      if (!validateCurrentStep()) return;
      goTo(STEPS[idx + 1], "forward");
    }
  };

  const prevStep = () => {
    const idx = STEPS.indexOf(currentStep);
    if (idx > 0) goTo(STEPS[idx - 1], "back");
  };

  // Advance from a KNOWN step without re-validating — used by tap-to-advance
  // selectors, where the value was just set this frame (so a validation read of
  // React state would still see the stale, pre-selection value).
  const advanceFrom = (step: Step) => {
    const idx = STEPS.indexOf(step);
    if (idx >= 0 && idx < STEPS.length - 1) goTo(STEPS[idx + 1], "forward");
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case "goal":
        if (goals.length === 0) {
          Alert.alert("One thing first", "Pick what brought you here — choose as many as you like.");
          return false;
        }
        return true;
      case "about":
        if (!age || parseInt(age) < 13 || parseInt(age) > 120) {
          Alert.alert("Quick check", "Enter a valid age between 13 and 120.");
          return false;
        }
        if (!sex) {
          Alert.alert("Quick check", "Select your biological sex — it sharpens your calorie math.");
          return false;
        }
        if (
          !heightCm ||
          parseInt(heightCm) < HEIGHT_RANGE.min ||
          parseInt(heightCm) > HEIGHT_RANGE.max
        ) {
          Alert.alert(
            "Quick check",
            `Enter a valid height (${HEIGHT_RANGE.min}–${HEIGHT_RANGE.max} cm).`,
          );
          return false;
        }
        if (
          !weightKg ||
          parseFloat(weightKg) < WEIGHT_RANGE.min ||
          parseFloat(weightKg) > WEIGHT_RANGE.max
        ) {
          Alert.alert(
            "Quick check",
            `Enter a valid weight (${WEIGHT_RANGE.min}–${WEIGHT_RANGE.max} kg).`,
          );
          return false;
        }
        return true;
      case "activity":
        if (!activityLevel) {
          Alert.alert("Quick check", "Pick how active your day usually is.");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  /* ── The bio, and the plan built from it ──────────────────────────────── */

  // Single source of truth for the bio — the reveal preview and the saved bio
  // are built from this exact function, so they can never drift.
  const buildBio = useCallback(
    (): UserBio => ({
      age: parseInt(age),
      sex: sex!,
      heightCm: parseInt(heightCm),
      weightKg: parseFloat(weightKg),
      activityLevel: activityLevel!,
      exerciseLevel,
      primaryGoal: primaryGoal!,
      goals,
      trainingEnabled,
      dietaryRestriction,
      cuisinePreference,
      equipment,
      workoutDaysPerWeek: trainingEnabled
        ? workoutDaysPerWeek
        : DEFAULT_DAYS_FOR_GOAL[primaryGoal ?? "better_health"],
      allergies: [
        ...allergies,
        ...(customAllergy ? customAllergy.split(",").map((a) => a.trim()).filter(Boolean) : []),
      ],
      medicalConditions: medicalConditions.filter((c) => c !== "none"),
      injuries: injuries ? injuries.split(",").map((i) => i.trim()).filter(Boolean) : undefined,
      medications: medications ? medications.split(",").map((m) => m.trim()).filter(Boolean) : undefined,
      region: region.trim() || undefined,
      mealsPerDay,
    }),
    [
      age,
      sex,
      heightCm,
      weightKg,
      activityLevel,
      exerciseLevel,
      primaryGoal,
      goals,
      trainingEnabled,
      dietaryRestriction,
      cuisinePreference,
      equipment,
      workoutDaysPerWeek,
      allergies,
      customAllergy,
      medicalConditions,
      injuries,
      medications,
      region,
      mealsPerDay,
    ],
  );

  // The personalized plan, computed only on the reveal step. Same engines the
  // app uses everywhere — no bespoke math here.
  const planPreview = useMemo(() => {
    if (currentStep !== "plan") return null;
    if (!sex || !activityLevel || !primaryGoal) return null;
    if (!age || !heightCm || !weightKg) return null;
    const bio = buildBio();
    const targets = calculateNutritionTargets(bio);
    const { recommended, safeOptions } = recommendDiets(bio, targets);
    const topDiet = recommended[0] ?? safeOptions[0] ?? null;
    const wp = generateWorkoutPlan(bio, currentWeekStart(), {
      equipment: bio.equipment,
      daysPerWeek: bio.workoutDaysPerWeek,
    });
    const trainingDays = wp.sessions.filter((s) => !s.isRestDay).length;
    const equipmentSummary =
      bio.equipment && bio.equipment.some((e) => e !== "none")
        ? bio.equipment.filter((e) => e !== "none").map((e) => EQUIPMENT_SHORT[e]).join(" · ")
        : "Bodyweight";
    return { bio, targets, topDiet, splitType: wp.splitType, trainingDays, equipmentSummary };
    // `plansReady` recomputes the preview once the lazy catalogs have loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, age, sex, heightCm, weightKg, activityLevel, primaryGoal, buildBio, plansReady]);

  /* ── Finishing ────────────────────────────────────────────────────────── */

  /**
   * The save and the cinematic run CONCURRENTLY. `saved` records the outcome of
   * the write; `covered` records that the exit has taken the screen. Routing
   * waits for both, so the user never sees a half-covered navigation and never
   * waits on an animation that has already finished.
   */
  const saved = useRef<"pending" | "ok" | "failed">("pending");
  const covered = useRef(false);
  const routed = useRef(false);

  const land = useCallback(async () => {
    if (routed.current) return;
    if (!covered.current || saved.current !== "ok") return;
    routed.current = true;
    if (isPreview) {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)" as any);
      return;
    }
    // Ask for reminders here, not at cold boot: the user has just seen their
    // plan, so "a nudge at the right time" is a concrete promise rather than an
    // abstract permission. The primer marks itself seen and lands on the tabs.
    if (await hasSeenNotificationPrimer()) router.replace("/(tabs)" as any);
    else router.replace("/notifications-setup?from=onboarding" as any);
  }, [isPreview, router]);

  const handleComplete = async () => {
    if (exiting) return;
    saved.current = "pending";
    covered.current = false;
    routed.current = false;
    setExiting(true);
    setLoading(true);

    // Preview: don't touch the real profile — just leave the flow.
    if (isPreview) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saved.current = "ok";
      land();
      return;
    }

    try {
      await completeOnboarding(buildBio());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saved.current = "ok";
      land();
    } catch (error) {
      console.error("Error completing onboarding:", error);
      saved.current = "failed";
      // Put the plan back before saying anything — an alert over a black
      // cover-screen would leave the user with nowhere to return to.
      setExiting(false);
      setLoading(false);
      Alert.alert("Error", "Failed to save your information. Please try again.");
    }
  };

  const onCovered = useCallback(() => {
    covered.current = true;
    land();
  }, [land]);

  /* ── Selection handlers (business rules live here, not in the UI) ─────── */

  const toggleGoal = (value: PrimaryGoal) => {
    setGoals((prev) =>
      prev.includes(value) ? prev.filter((g) => g !== value) : [...prev, value],
    );
  };
  const handleSexSelect = (value: Sex) => setSex(value);
  const handleActivitySelect = (value: ActivityLevel) => {
    setActivityLevel(value);
    // The established beat: long enough to see the card open and its meter
    // fill, short enough that it is never a wait. A different pick restarts it
    // rather than stacking a second advance.
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      advanceFrom("activity");
    }, Pace.advance);
  };
  const toggleEquipment = (value: Equipment) => {
    setEquipment((prev) => {
      if (value === "none") return ["none"];
      const withoutNone = prev.filter((e) => e !== "none");
      const next = withoutNone.includes(value)
        ? withoutNone.filter((e) => e !== value)
        : [...withoutNone, value];
      return next.length ? next : ["none"];
    });
  };
  const toggleAllergy = (allergy: string) => {
    setAllergies((prev) =>
      prev.includes(allergy) ? prev.filter((a) => a !== allergy) : [...prev, allergy],
    );
  };
  const toggleMedicalCondition = (condition: MedicalCondition) => {
    if (condition === "none") {
      // Un-tickable: tapping the row again clears it rather than locking the
      // user into a "None" they picked by accident.
      setMedicalConditions((prev) => (prev.includes("none") ? [] : ["none"]));
    } else {
      setMedicalConditions((prev) => {
        const filtered = prev.filter((c) => c !== "none");
        return filtered.includes(condition)
          ? filtered.filter((c) => c !== condition)
          : [...filtered, condition];
      });
    }
  };

  /* ── What the header and the action bar say on each step ──────────────── */

  const formIndex = FORM_STEPS.indexOf(currentStep);
  const isLastForm = formIndex === FORM_STEPS.length - 1;
  const showHeader = formIndex >= 0;
  const aboutComplete = Boolean(age && sex && heightCm && weightKg);

  // The header and the action bar stay mounted across every step and fade
  // their contents rather than unmounting, so on the three steps that have no
  // header we keep showing the LAST values while the bar fades — otherwise the
  // label would vanish a beat before the bar that holds it.
  const kicker = STEP_KICKER[currentStep];
  const lastKicker = useRef(kicker);
  if (kicker) lastKicker.current = kicker;
  const lastFormIndex = useRef(1);
  if (formIndex >= 0) lastFormIndex.current = formIndex + 1;

  const headerBack = () => {
    // Inside the food step the questions replace each other, so "back" means
    // the previous question before it means the previous step.
    if (currentStep === "food" && foodQuestion > 0) {
      setFoodQuestion((q) => q - 1);
      return;
    }
    prevStep();
  };

  const primaryAction = () => {
    if (currentStep === "training" && trainingRevealed < 3) {
      setTrainingRevealed((r) => Math.min(r + 1, 3));
      return;
    }
    if (currentStep === "food" && foodQuestion < 2) {
      setFoodQuestion((q) => q + 1);
      return;
    }
    nextStep();
  };

  const lastLabel = useRef("Let's go");
  const actionLabel = (() => {
    if (currentStep === "welcome") return "Let's go";
    // The build and the reveal have no action bar; hold the last wording so the
    // label does not re-cut to "Continue" underneath its own fade-out.
    if (currentStep === "building" || currentStep === "plan") return lastLabel.current;
    if (currentStep === "training" && trainingRevealed < 3) return "Continue";
    if (currentStep === "food" && foodQuestion < 2) return "Continue";
    return isLastForm ? "Build my plan" : "Continue";
  })();
  lastLabel.current = actionLabel;

  const actionReady = (() => {
    switch (currentStep) {
      case "goal":
        return goals.length > 0;
      case "about":
        return aboutComplete;
      case "activity":
        return activityLevel !== null;
      default:
        return true;
    }
  })();

  // The action bar mounts once, on the welcome, and persists for the rest of
  // the flow — so its entrance delay is the welcome score, full stop.
  const actionDelay = WELCOME.action;

  const goalReaction = (() => {
    if (!primaryGoal) return null;
    if (goals.length === 1) return GOAL_REACTION[primaryGoal];
    return `Good. ${GOAL_PHRASE[primaryGoal].replace(/^./, (c) => c.toUpperCase())} leads — the rest shapes the details.`;
  })();

  /* ── Step content ─────────────────────────────────────────────────────── */

  const renderStep = (step: Step): React.ReactNode => {
    switch (step) {
      case "welcome":
        return (
          <StepCentre>
            <WelcomeVisual width={width} />
            <AnimatedText
              variant="kicker"
              color="brand"
              uppercase
              align="center"
              delay={WELCOME.title}
              duration={400}
            >
              welliva
            </AnimatedText>
            <AnimatedText variant="statement" align="center" delay={WELCOME.title + 60}>
              Let&apos;s build your plan
            </AnimatedText>
            {/* The promise assembles a clause at a time — the one place in the
                flow where the user is reading rather than answering. */}
            <ProgressiveText
              lines={WELCOME_LINES}
              variant="support"
              color="secondary"
              align="center"
              delay={WELCOME.support}
              step={200}
              wrapperStyle={styles.welcomeSupport}
            />
            <StaggerReveal delay={WELCOME.chips} step={110} distance={8} style={styles.chips}>
              {WELCOME_CHIPS.map((text) => (
                <View
                  key={text}
                  style={[
                    styles.chip,
                    {
                      borderColor: alpha(colors.border, 0.9),
                      backgroundColor: alpha(colors.surface, 0.5),
                    },
                  ]}
                >
                  <AppText variant="footnote" color="secondary">
                    {text}
                  </AppText>
                </View>
              ))}
            </StaggerReveal>
          </StepCentre>
        );

      case "goal":
        return (
          <QuestionStage
            hold={held === "goal"}
            onRise={release}
            lead={
              <AnimatedQuestion
                title="What brings you here?"
                support="Pick everything that fits — the first one you choose leads your plan."
              />
            }
          >
            {(delay) => (
              <>
                <MultiSelectGrid
                  options={GOAL_OPTIONS}
                  selected={goals}
                  onToggle={toggleGoal}
                  width={contentWidth}
                  columns={2}
                  delay={delay}
                  primaryTag="Main focus"
                />
                <MicroReaction text={goalReaction} />
              </>
            )}
          </QuestionStage>
        );

      case "about":
        return (
          <StepScroll tail={Spacing.giant}>
            <AnimatedQuestion
              title="A little about you"
              support="The essentials for accurate calorie and macro targets."
              motif={<MeasureMotif tone={colors.primary} />}
            />
            <View style={styles.fields}>
              <InputRow
                label="Age"
                value={age}
                onChangeText={setAge}
                placeholder="—"
                unit="years"
                maxLength={3}
                delay={OPTIONS_DELAY}
                dimmed={focusedField !== null && focusedField !== "age"}
                onFocus={() => setFocusedField("age")}
                onBlur={() => setFocusedField(null)}
              />

              {/* Recedes with its neighbours: the field holding the caret is
                  the only thing at full strength, whichever kind it is. */}
              <Appear delay={OPTIONS_DELAY + 90}>
                <Recede active={focusedField !== null} style={styles.sexBlock}>
                  <AppText variant="caption" color="tertiary" uppercase>
                    Sex
                  </AppText>
                  <View style={styles.sexRow} accessibilityRole="radiogroup">
                    {SEX_OPTIONS.map((option) => (
                      <SelectionCard
                        key={option.value}
                        selected={sex === option.value}
                        onPress={() => handleSexSelect(option.value)}
                        title={option.label}
                        glyph={option.glyph}
                        layout="row"
                        role="radio"
                        showCheck={false}
                        recede={sex !== null && sex !== option.value}
                        style={styles.flex}
                      />
                    ))}
                  </View>
                  <AppText variant="footnote" color="tertiary">
                    Biological sex. It sharpens your calorie math.
                  </AppText>
                </Recede>
              </Appear>

              <InputRow
                label="Height"
                value={heightCm}
                onChangeText={setHeightCm}
                placeholder="—"
                unit="cm"
                range={HEIGHT_RANGE}
                maxLength={3}
                delay={OPTIONS_DELAY + 180}
                dimmed={focusedField !== null && focusedField !== "height"}
                onFocus={() => setFocusedField("height")}
                onBlur={() => setFocusedField(null)}
              />
              <InputRow
                label="Weight"
                value={weightKg}
                onChangeText={setWeightKg}
                placeholder="—"
                unit="kg"
                range={WEIGHT_RANGE}
                keyboardType="decimal-pad"
                maxLength={5}
                delay={OPTIONS_DELAY + 270}
                dimmed={focusedField !== null && focusedField !== "weight"}
                onFocus={() => setFocusedField("weight")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </StepScroll>
        );

      case "activity":
        return (
          <QuestionStage
            hold={held === "activity"}
            onRise={release}
            lead={
              <AnimatedQuestion
                title="How active is your day?"
                support="Just everyday life — work, errands, getting around. Not your workouts."
              />
            }
          >
            {(delay) => (
              <ActivityDeck
                options={ACTIVITY_OPTIONS}
                value={activityLevel}
                onSelect={handleActivitySelect}
                delay={delay}
              />
            )}
          </QuestionStage>
        );

      case "training":
        return (
          <StepScroll>
            <AnimatedQuestion
              kicker="Training"
              title="Let's set up your training"
              support="A few details so your workouts match you — nothing you can't change later."
            />
            <TrainingSelector
              experienceOptions={EXERCISE_LEVEL_OPTIONS}
              experience={exerciseLevel}
              onExperience={setExerciseLevel}
              equipmentOptions={EQUIPMENT_OPTIONS}
              equipment={equipment}
              onEquipment={toggleEquipment}
              dayOptions={WORKOUT_DAY_OPTIONS}
              days={workoutDaysPerWeek}
              onDays={setWorkoutDaysPerWeek}
              revealed={trainingRevealed}
              onRevealNext={() => setTrainingRevealed((r) => Math.min(r + 1, 3))}
              width={contentWidth}
              delay={OPTIONS_DELAY}
            />
          </StepScroll>
        );

      case "food":
        return (
          <StepScroll>
            <FoodPreferenceSelector
              dietOptions={DIETARY_RESTRICTION_OPTIONS}
              cuisineOptions={CUISINE_OPTIONS}
              mealOptions={MEALS_OPTIONS}
              diet={dietaryRestriction}
              onDiet={setDietaryRestriction}
              cuisine={cuisinePreference}
              onCuisine={setCuisinePreference}
              meals={mealsPerDay}
              onMeals={(v) => setMealsPerDay(v as 3 | 4)}
              question={foodQuestion}
              onJump={setFoodQuestion}
              onAnswered={() => setFoodQuestion((q) => Math.min(q + 1, 2))}
              detectedRegion={detectedRegion}
              width={contentWidth}
            />
          </StepScroll>
        );

      case "health": {
        const noneSelected = medicalConditions.includes("none");
        return (
          <QuestionStage
            hold={held === "health"}
            onRise={release}
            tail={Spacing.giant}
            lead={
              // The safety circle closes during the hold — the pause is spent
              // watching something protective complete itself.
              <AnimatedQuestion
                title="Anything I should know?"
                support="All optional — it just helps me keep your plan safe. Skip if nothing applies."
                motif={<SafetyMotif tone={colors.primary} />}
              />
            }
          >
            {(delay) => (
              <>
                {/* The most sensitive screen in the app. The reminder that this
                    shapes a plan, not a treatment, belongs right here. */}
                <Appear delay={delay}>
                  <DisclaimerNote compact />
                </Appear>

                <View style={styles.section}>
                  <AppText variant="caption" color="tertiary" uppercase>
                    Medical conditions
                  </AppText>
                  {/* Lifted out of the groups: the fastest honest answer on this
                      screen is "nothing", and it should be the first thing here. */}
                  <NothingApplies
                    selected={noneSelected}
                    onPress={() => toggleMedicalCondition("none")}
                    delay={delay + 80}
                  />
                  {MEDICAL_GROUPS.map((group, i) => {
                    const chosen = group.items.filter((item) =>
                      medicalConditions.includes(item.value),
                    ).length;
                    return (
                      <HealthGroup
                        key={group.title}
                        title={group.title}
                        count={group.items.length}
                        selectedCount={chosen}
                        open={openGroup === group.title}
                        onToggle={() =>
                          setOpenGroup((g) => (g === group.title ? null : group.title))
                        }
                        muted={noneSelected}
                        delay={delay + 160 + i * 60}
                      >
                        <MultiSelectGrid
                          options={group.items}
                          selected={medicalConditions}
                          onToggle={toggleMedicalCondition}
                          width={contentWidth - Spacing.md * 2}
                          columns={2}
                          delay={0}
                        />
                      </HealthGroup>
                    );
                  })}
                </View>

                <View style={styles.section}>
                  <NoteField
                    label="Injuries or pain"
                    value={injuries}
                    onChangeText={setInjuries}
                    placeholder="e.g. Knee pain, lower back"
                    delay={delay + 220}
                  />
                  <NoteField
                    label="Medications"
                    value={medications}
                    onChangeText={setMedications}
                    placeholder="e.g. Blood pressure medication"
                    delay={delay + 280}
                  />
                </View>

                <View style={styles.section}>
                  <AppText variant="caption" color="tertiary" uppercase>
                    Food allergies
                  </AppText>
                  <ChipField
                    options={ALLERGY_OPTIONS}
                    selected={allergies}
                    onToggle={toggleAllergy}
                    delay={delay + 320}
                  />
                  <NoteField
                    label="Anything else"
                    value={customAllergy}
                    onChangeText={setCustomAllergy}
                    placeholder="Other allergies, comma-separated"
                    multiline={false}
                    delay={delay + 400}
                  />
                </View>
              </>
            )}
          </QuestionStage>
        );
      }

      case "building":
        return (
          <StepCentre>
            <BuildingAnimation
              lines={BUILD_LINES}
              minimumMs={2000}
              ready={plansReady}
              onComplete={() => goTo("plan", "forward")}
            />
          </StepCentre>
        );

      case "plan":
        return (
          <StepScroll>
            {planPreview ? (
              <PlanReveal
                preview={planPreview}
                lede={
                  goals.length > 1
                    ? "Built around your goals. Everything below adapts as you go."
                    : `Built around your goal to ${GOAL_PHRASE[planPreview.bio.primaryGoal]}. Everything below adapts as you go.`
                }
                trainingEnabled={trainingEnabled}
                loading={loading}
                onStart={handleComplete}
              />
            ) : (
              <AnimatedText variant="support" color="secondary" align="center">
                Preparing your plan…
              </AnimatedText>
            )}
          </StepScroll>
        );
    }
  };

  /* ── Frame ────────────────────────────────────────────────────────────── */

  // A held question has the stage to itself; the bar comes back with its answers.
  const showActions =
    currentStep !== "building" && currentStep !== "plan" && held !== currentStep;

  return (
    <>
      {/* Header and action bar are mounted for the life of the flow and fade
          their contents per step. Unmounting either one would resize the canvas
          in the middle of a dissolve, which is the one jump a continuous canvas
          cannot hide. */}
      <OnboardingContainer
        header={
          <OnboardingHeader
            label={lastKicker.current}
            index={lastFormIndex.current}
            total={FORM_STEPS.length}
            onBack={headerBack}
            visible={showHeader}
          />
        }
        footer={
          <OnboardingActions
            label={actionLabel}
            onPress={primaryAction}
            ready={actionReady}
            visible={showActions}
            delay={actionDelay}
          />
        }
      >
        <OnboardingTransition step={currentStep} direction={direction} render={renderStep} />
      </OnboardingContainer>

      <CinematicExit active={exiting} onCovered={onCovered} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // `alignSelf` matters: ProgressiveText stretches by default, so a bare
  // maxWidth would leave the block anchored to the left gutter on a wide
  // display while its text centred inside it — off-centre by half the slack.
  welcomeSupport: { maxWidth: 360, alignSelf: "center" },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },

  fields: { gap: Spacing.md },
  sexBlock: { gap: Spacing.sm },
  sexRow: { flexDirection: "row", gap: Spacing.md },

  section: { gap: Spacing.md },
});
