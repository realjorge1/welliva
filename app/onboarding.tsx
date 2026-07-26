/**
 * ONBOARDING — a short coaching consultation, not a questionnaire.
 *
 * A first-person coach captures only what the engines truly need, in as few
 * beats as possible: goals → you → daily activity → (training, only if wanted)
 * → food → safety, then *builds and reveals* a personalized plan before Home so
 * the user arrives already invested.
 *
 * Design rules that keep it from feeling like an exam:
 *  • Multi-select goals; the choices BRANCH the flow. Pick a movement goal and
 *    we ask about training; pick only diet/health goals and we skip it entirely
 *    (workouts stay available in-app, and we offer to set them up later —
 *    see `trainingEnabled`).
 *  • Merged steps: age+sex+body on one screen, diet+cuisine+meals on one screen,
 *    experience+equipment+days on one screen.
 *  • Region is DETECTED silently from the device time-zone (no "what world are
 *    you in?" screen, no permission) — we only surface a tiny confirm chip.
 *
 * All plan numbers shown in the reveal are computed from the SAME bio that gets
 * saved (`buildBio`), so what they see is exactly what they get.
 */

import {
  AmbientCanvas,
  AnimatedNumber,
  AppText,
  Button,
  Card,
  IconBadge,
  ProgressBar,
  Reveal,
  Ring,
  Stat,
  ThemedIcon,
  useColors,
} from "@/components/ui";
import AILogoBadge from "@/components/gozlin/AILogoBadge";
import { OrbField, useOrbTouch } from "@/components/OrbField";
import { HeroAura } from "@/components/onboarding/HeroAura";
import { hasSeenNotificationPrimer } from "@/services/notifications/primer";
import { Gradients, Radius, Spacing, alpha, brandGradientDark } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { detectRegion } from "@/utils/region";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

const { width } = Dimensions.get("window");

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

const SEX_OPTIONS: { value: Sex; label: string; icon: string }[] = [
  { value: "male", label: "Male", icon: "male" },
  { value: "female", label: "Female", icon: "female" },
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
  icon: string;
  level: number;
}[] = [
  { value: "sedentary", label: "Mostly sitting", desc: "Desk work, driving, screen time", icon: "desktop-outline", level: 1 },
  { value: "light", label: "Lightly active", desc: "On my feet here and there", icon: "walk-outline", level: 2 },
  { value: "moderate", label: "Active", desc: "Moving for much of the day", icon: "bicycle-outline", level: 3 },
  { value: "very_active", label: "Very active", desc: "Physical job or always on the go", icon: "flame-outline", level: 4 },
];

const EXERCISE_LEVEL_OPTIONS: {
  value: ExerciseLevel;
  label: string;
  desc: string;
  icon: string;
}[] = [
  { value: "beginner", label: "New to it", desc: "Just starting out", icon: "leaf-outline" },
  { value: "intermediate", label: "Regular", desc: "I train fairly often", icon: "fitness-outline" },
  { value: "advanced", label: "Experienced", desc: "Training is second nature", icon: "barbell-outline" },
];

const GOAL_OPTIONS: {
  value: PrimaryGoal;
  label: string;
  icon: string;
}[] = [
  { value: "lose_weight", label: "Lose weight", icon: "trending-down" },
  { value: "build_muscle", label: "Build muscle", icon: "barbell" },
  { value: "improve_fitness", label: "Get fit", icon: "fitness" },
  { value: "increase_energy", label: "More energy", icon: "flash" },
  { value: "better_health", label: "Better health", icon: "heart" },
  { value: "athletic_performance", label: "Perform better", icon: "trophy" },
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

/** Sensible weekly training default per goal for users who skip the training step. */
const DEFAULT_DAYS_FOR_GOAL: Record<PrimaryGoal, number> = {
  lose_weight: 3,
  build_muscle: 4,
  improve_fitness: 4,
  increase_energy: 3,
  better_health: 3,
  athletic_performance: 5,
};

const DIETARY_RESTRICTION_OPTIONS: { value: DietaryRestriction; label: string }[] = [
  { value: "none", label: "No restrictions" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "halal", label: "Halal" },
  { value: "kosher", label: "Kosher" },
  { value: "gluten_free", label: "Gluten-free" },
  { value: "dairy_free", label: "Dairy-free" },
];

const CUISINE_OPTIONS: {
  value: CuisinePreference;
  label: string;
  desc: string;
  icon: string;
}[] = [
  { value: "mixed", label: "A bit of everything", desc: "Draw from all cuisines", icon: "globe-outline" },
  { value: "african", label: "African", desc: "Nigerian & West-African dishes", icon: "leaf" },
  { value: "western", label: "European & Western", desc: "Classic Western meals", icon: "restaurant" },
  { value: "mediterranean", label: "Mediterranean", desc: "Greek, Italian & coastal", icon: "fish" },
];

/** Equipment the user can train with. Each unlocks real exercises in the DB. */
const EQUIPMENT_OPTIONS: {
  value: Equipment;
  label: string;
  desc: string;
  icon: string;
}[] = [
  { value: "none", label: "Bodyweight & mat", desc: "No gear — just you and the floor", icon: "body-outline" },
  { value: "dumbbells", label: "Dumbbells", desc: "Adjustable or fixed", icon: "barbell-outline" },
  { value: "resistance_bands", label: "Resistance bands", desc: "Loops or tubes", icon: "git-compare-outline" },
  { value: "kettlebell", label: "Kettlebell", desc: "Any weight", icon: "fitness-outline" },
  { value: "pull_up_bar", label: "Pull-up bar", desc: "Doorway or wall-mounted", icon: "reorder-four-outline" },
  { value: "bench", label: "Bench", desc: "Flat or adjustable", icon: "tablet-landscape-outline" },
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

const WORKOUT_DAY_OPTIONS = [2, 3, 4, 5, 6];

const MEALS_OPTIONS: { value: 3 | 4; label: string; desc: string }[] = [
  { value: 3, label: "3 meals", desc: "Breakfast, lunch, dinner + a snack" },
  { value: 4, label: "4 meals", desc: "Three meals + two snacks" },
];

const ALLERGY_OPTIONS: CommonAllergy[] = [
  "peanuts",
  "tree_nuts",
  "dairy",
  "eggs",
  "shellfish",
  "fish",
  "wheat",
  "soy",
  "gluten",
];

const MEDICAL_OPTIONS: { value: MedicalCondition; label: string }[] = [
  // Heart & metabolic
  { value: "hypertension", label: "Hypertension" },
  { value: "high_cholesterol", label: "High cholesterol" },
  { value: "diabetes_type2", label: "Type 2 diabetes" },
  { value: "diabetes_type1", label: "Type 1 diabetes" },
  { value: "prediabetes", label: "Prediabetes" },
  { value: "metabolic_syndrome", label: "Metabolic syndrome" },
  // Digestive
  { value: "gerd", label: "Acid reflux / GERD" },
  { value: "ibs", label: "IBS" },
  { value: "ibd", label: "IBD (Crohn's / colitis)" },
  { value: "celiac", label: "Celiac / gluten" },
  { value: "diverticulitis", label: "Diverticulitis" },
  { value: "constipation", label: "Constipation" },
  { value: "lactose_intolerance", label: "Lactose intolerance" },
  // Liver, kidney & endocrine
  { value: "renal_issues", label: "Kidney issues" },
  { value: "fatty_liver", label: "Fatty liver" },
  { value: "gallbladder", label: "Gallbladder issues" },
  { value: "pancreatitis", label: "Pancreatitis" },
  { value: "hypothyroidism", label: "Hypothyroidism" },
  { value: "hyperthyroidism", label: "Hyperthyroidism" },
  { value: "gout", label: "Gout" },
  // Hormonal & life-stage
  { value: "pcos", label: "PCOS" },
  { value: "endometriosis", label: "Endometriosis" },
  { value: "pregnancy", label: "Pregnancy" },
  { value: "postpartum", label: "Postpartum" },
  { value: "menopause", label: "Menopause" },
  // Immune, blood & musculoskeletal
  { value: "anemia", label: "Anemia (iron)" },
  { value: "arthritis", label: "Arthritis" },
  { value: "osteoporosis", label: "Osteoporosis" },
  // Neurological
  { value: "migraine", label: "Migraine" },
  { value: "none", label: "None" },
];

const BUILD_LINES = [
  "Calculating your calorie target…",
  "Matching you to the right diet…",
  "Designing your plan…",
  "Putting it all together…",
];

const tapHaptic = () => Haptics.selectionAsync().catch(() => {});

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useProfile();
  const { colors } = useColors();
  // Bubble-phase touch observers — any press or swipe landing on a background
  // orb bounces it off elastically, without interfering with the flow itself.
  const { touch, touchHandlers } = useOrbTouch();

  // Preview mode (?preview=1): launched from the Profile "board" test button to
  // replay the whole flow. Everything looks identical to a new user, but the
  // final step DOESN'T persist or overwrite the real profile — it just exits.
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const isPreview = preview === "1";

  const [currentStep, setCurrentStep] = useState<Step>("welcome");
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

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const buildPulse = useRef(new Animated.Value(1)).current;
  const [buildLineIdx, setBuildLineIdx] = useState(0);

  // Detect region + a starting cuisine silently on mount — no screen, no prompt.
  useEffect(() => {
    const d = detectRegion();
    if (d.region) {
      setRegion(d.region);
      setDetectedRegion(d.region);
    }
    setCuisinePreference(d.cuisine);
  }, []);

  const animateTransition = (direction: "forward" | "back") => {
    const slideValue = direction === "forward" ? -width : width;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: slideValue, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      slideAnim.setValue(direction === "forward" ? width : -width);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    });
  };

  const nextStep = () => {
    const idx = STEPS.indexOf(currentStep);
    if (idx >= 0 && idx < STEPS.length - 1) {
      if (!validateCurrentStep()) return;
      animateTransition("forward");
      setTimeout(() => setCurrentStep(STEPS[idx + 1]), 150);
    }
  };

  const prevStep = () => {
    const idx = STEPS.indexOf(currentStep);
    if (idx > 0) {
      animateTransition("back");
      setTimeout(() => setCurrentStep(STEPS[idx - 1]), 150);
    }
  };

  // Advance from a KNOWN step without re-validating — used by tap-to-advance
  // selectors, where the value was just set this frame (so a validation read of
  // React state would still see the stale, pre-selection value).
  const advanceFrom = (step: Step) => {
    const idx = STEPS.indexOf(step);
    if (idx >= 0 && idx < STEPS.length - 1) {
      animateTransition("forward");
      setTimeout(() => setCurrentStep(STEPS[idx + 1]), 150);
    }
  };

  // The "building" beat: pulse + rotating lines, then auto-advance to the reveal.
  useEffect(() => {
    if (currentStep !== "building") return;
    setBuildLineIdx(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(buildPulse, { toValue: 1.08, duration: 620, useNativeDriver: true }),
        Animated.timing(buildPulse, { toValue: 1, duration: 620, useNativeDriver: true }),
      ]),
    );
    loop.start();
    const lineTimer = setInterval(
      () => setBuildLineIdx((i) => Math.min(i + 1, BUILD_LINES.length - 1)),
      480,
    );
    const advance = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -width, duration: 150, useNativeDriver: true }),
      ]).start(() => {
        slideAnim.setValue(width);
        setCurrentStep("plan");
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start();
      });
    }, 2000);
    return () => {
      loop.stop();
      clearInterval(lineTimer);
      clearTimeout(advance);
    };
  }, [currentStep, buildPulse, fadeAnim, slideAnim]);

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
        if (!heightCm || parseInt(heightCm) < 100 || parseInt(heightCm) > 250) {
          Alert.alert("Quick check", "Enter a valid height (100–250 cm).");
          return false;
        }
        if (!weightKg || parseFloat(weightKg) < 30 || parseFloat(weightKg) > 300) {
          Alert.alert("Quick check", "Enter a valid weight (30–300 kg).");
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

  const handleComplete = async () => {
    // Preview: don't touch the real profile — just leave the flow.
    if (isPreview) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)" as any);
      return;
    }
    setLoading(true);
    try {
      await completeOnboarding(buildBio());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Ask for reminders here, not at cold boot: the user has just seen their
      // plan, so "a nudge at the right time" is a concrete promise rather than an
      // abstract permission. The primer marks itself seen and lands on the tabs.
      if (await hasSeenNotificationPrimer()) router.replace("/(tabs)" as any);
      else router.replace("/notifications-setup?from=onboarding" as any);
    } catch (error) {
      console.error("Error completing onboarding:", error);
      Alert.alert("Error", "Failed to save your information. Please try again.");
      setLoading(false);
    }
  };

  const toggleGoal = (value: PrimaryGoal) => {
    tapHaptic();
    setGoals((prev) =>
      prev.includes(value) ? prev.filter((g) => g !== value) : [...prev, value],
    );
  };
  const handleSexSelect = (value: Sex) => {
    tapHaptic();
    setSex(value);
  };
  const handleActivitySelect = (value: ActivityLevel) => {
    tapHaptic();
    setActivityLevel(value);
    setTimeout(() => advanceFrom("activity"), 380);
  };
  const toggleEquipment = (value: Equipment) => {
    tapHaptic();
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
    tapHaptic();
    setAllergies((prev) =>
      prev.includes(allergy) ? prev.filter((a) => a !== allergy) : [...prev, allergy],
    );
  };
  const toggleMedicalCondition = (condition: MedicalCondition) => {
    tapHaptic();
    if (condition === "none") {
      setMedicalConditions(["none"]);
    } else {
      setMedicalConditions((prev) => {
        const filtered = prev.filter((c) => c !== "none");
        return filtered.includes(condition)
          ? filtered.filter((c) => c !== condition)
          : [...filtered, condition];
      });
    }
  };

  const formIndex = FORM_STEPS.indexOf(currentStep);
  const showHeader = formIndex >= 0;
  const showNav = currentStep !== "building" && currentStep !== "plan";
  const progress = showHeader ? (formIndex + 1) / FORM_STEPS.length : 0;
  const currentStepIndex = STEPS.indexOf(currentStep);
  const isLastForm = formIndex === FORM_STEPS.length - 1;

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <View style={styles.welcomeWrap}>
            <View style={styles.welcomeHero}>
              <View style={styles.auraLayer} pointerEvents="none">
                <HeroAura mode="glow" size={260} />
              </View>
              <AILogoBadge size={68} />
            </View>
            <AppText variant="displayLg" align="center" style={styles.welcomeTitle}>
              Let&apos;s build your plan
            </AppText>
            <AppText variant="bodyLg" color="secondary" align="center" style={styles.welcomeSub}>
              A few quick questions and I&apos;ll shape a diet and training plan around your life. About 2 minutes.
            </AppText>
            <View style={styles.welcomeChips}>
              {[
                { icon: "restaurant-outline", text: "Meals for your goals" },
                { icon: "barbell-outline", text: "Training that fits" },
                { icon: "shield-checkmark-outline", text: "Safe by design" },
              ].map((p) => (
                <View
                  key={p.text}
                  style={[styles.welcomeChip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <Ionicons name={p.icon as any} size={16} color={colors.primary} />
                  <AppText variant="footnote" color="secondary">
                    {p.text}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        );

      case "goal":
        return (
          <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}>
            <View style={styles.step}>
              <StepHead
                title="What brings you here?"
                subtitle="Pick everything that fits — it shapes your whole plan."
              />
              <View style={styles.goalGrid}>
                {GOAL_OPTIONS.map((option) => {
                  const selected = goals.includes(option.value);
                  return (
                    <SelectableCard
                      key={option.value}
                      selected={selected}
                      onPress={() => toggleGoal(option.value)}
                      colors={colors}
                      style={styles.goalCard}
                    >
                      <IconBadge
                        name={option.icon as any}
                        tone={selected ? colors.primary : colors.textTertiary}
                        size={38}
                      />
                      <AppText
                        variant="callout"
                        color={selected ? "brand" : "secondary"}
                        style={styles.goalLabel}
                      >
                        {option.label}
                      </AppText>
                    </SelectableCard>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        );

      case "about":
        return (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.formScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <View style={[styles.step, styles.stepCompact]}>
              <StepHead
                title="A little about you"
                subtitle="The essentials for accurate calorie and macro targets."
              />
              <View style={[styles.group, styles.groupTight]}>
                <AppText variant="subhead" color="secondary">Age</AppText>
                <TextInput
                  style={inputStyle}
                  value={age}
                  onChangeText={setAge}
                  placeholder="Enter your age"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={[styles.group, styles.groupTight]}>
                <AppText variant="subhead" color="secondary">Sex</AppText>
                <View style={styles.row}>
                  {SEX_OPTIONS.map((option) => {
                    const selected = sex === option.value;
                    return (
                      <SelectableCard
                        key={option.value}
                        selected={selected}
                        onPress={() => handleSexSelect(option.value)}
                        colors={colors}
                        style={styles.sexCard}
                      >
                        <IconBadge
                          name={option.icon as any}
                          tone={selected ? colors.primary : colors.textTertiary}
                          size={40}
                        />
                        <AppText variant="callout" color={selected ? "brand" : "secondary"}>
                          {option.label}
                        </AppText>
                      </SelectableCard>
                    );
                  })}
                </View>
              </View>
              <View style={styles.row}>
                <View style={[styles.group, styles.groupTight, styles.flex]}>
                  <AppText variant="subhead" color="secondary">Height (cm)</AppText>
                  <TextInput
                    style={inputStyle}
                    value={heightCm}
                    onChangeText={setHeightCm}
                    placeholder="175"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <View style={[styles.group, styles.groupTight, styles.flex]}>
                  <AppText variant="subhead" color="secondary">Weight (kg)</AppText>
                  <TextInput
                    style={inputStyle}
                    value={weightKg}
                    onChangeText={setWeightKg}
                    placeholder="70"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        );

      case "activity":
        return (
          <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}>
            <View style={styles.step}>
              <StepHead
                title="How active is your day?"
                subtitle="Just everyday life — work, errands, getting around. Not your workouts."
              />
              <View style={styles.stack}>
                {ACTIVITY_OPTIONS.map((option) => {
                  const selected = activityLevel === option.value;
                  return (
                    <SelectableCard
                      key={option.value}
                      selected={selected}
                      onPress={() => handleActivitySelect(option.value)}
                      colors={colors}
                      style={styles.activityCard}
                    >
                      <IconBadge
                        name={option.icon as any}
                        tone={selected ? colors.primary : colors.textTertiary}
                        size={46}
                      />
                      <View style={styles.flex}>
                        <AppText variant="callout" color={selected ? "brand" : "secondary"}>
                          {option.label}
                        </AppText>
                        <AppText variant="footnote" color="tertiary" style={styles.activityDesc}>
                          {option.desc}
                        </AppText>
                        <IntensityMeter level={option.level} active={selected} colors={colors} />
                      </View>
                    </SelectableCard>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        );

      case "training":
        return (
          <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}>
            <View style={styles.step}>
              <StepHead
                title="Let's set up your training"
                subtitle="A few details so your workouts match you — nothing you can't change later."
              />

              <View style={styles.group}>
                <SectionLabel icon="ribbon-outline" text="Your experience" colors={colors} />
                <View style={styles.row}>
                  {EXERCISE_LEVEL_OPTIONS.map((option) => {
                    const selected = exerciseLevel === option.value;
                    return (
                      <SelectableCard
                        key={option.value}
                        selected={selected}
                        onPress={() => {
                          tapHaptic();
                          setExerciseLevel(option.value);
                        }}
                        colors={colors}
                        style={styles.expCard}
                      >
                        <IconBadge
                          name={option.icon as any}
                          tone={selected ? colors.primary : colors.textTertiary}
                          size={34}
                        />
                        <AppText variant="footnote" color={selected ? "brand" : "secondary"} align="center" weight="600">
                          {option.label}
                        </AppText>
                        <AppText variant="caption" color="tertiary" align="center" style={styles.expDesc}>
                          {option.desc}
                        </AppText>
                      </SelectableCard>
                    );
                  })}
                </View>
              </View>

              <View style={styles.group}>
                <SectionLabel icon="construct-outline" text="What can you train with?" colors={colors} />
                <View style={styles.stack}>
                  {EQUIPMENT_OPTIONS.map((option) => {
                    const selected = equipment.includes(option.value);
                    return (
                      <SelectableCard
                        key={option.value}
                        selected={selected}
                        onPress={() => toggleEquipment(option.value)}
                        colors={colors}
                        style={styles.largeOption}
                      >
                        <IconBadge
                          name={option.icon as any}
                          tone={selected ? colors.primary : colors.textTertiary}
                          size={40}
                        />
                        <View style={styles.flex}>
                          <AppText variant="callout" color={selected ? "brand" : "secondary"}>
                            {option.label}
                          </AppText>
                          <AppText variant="footnote" color="tertiary">
                            {option.desc}
                          </AppText>
                        </View>
                      </SelectableCard>
                    );
                  })}
                </View>
              </View>

              <View style={styles.group}>
                <SectionLabel icon="calendar-outline" text="Days per week" colors={colors} />
                <View style={styles.chips}>
                  {WORKOUT_DAY_OPTIONS.map((d) => (
                    <Chip
                      key={d}
                      label={`${d} days`}
                      selected={workoutDaysPerWeek === d}
                      onPress={() => {
                        tapHaptic();
                        setWorkoutDaysPerWeek(d);
                      }}
                      colors={colors}
                    />
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        );

      case "food":
        return (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.formScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.step}>
              <StepHead
                title="Your food preferences"
                subtitle="So your meals feel like food you'd actually choose."
              />

              {detectedRegion && (
                <View style={[styles.regionChip, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="location-outline" size={15} color={colors.primary} />
                  <AppText variant="footnote" color="secondary" style={styles.flex}>
                    Meals tuned for {detectedRegion} — change the cuisine anytime below.
                  </AppText>
                </View>
              )}

              <View style={styles.group}>
                <SectionLabel icon="nutrition-outline" text="Any dietary style?" colors={colors} />
                <View style={styles.chips}>
                  {DIETARY_RESTRICTION_OPTIONS.map((option) => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      selected={dietaryRestriction === option.value}
                      onPress={() => {
                        tapHaptic();
                        setDietaryRestriction(option.value);
                      }}
                      colors={colors}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.group}>
                <SectionLabel icon="globe-outline" text="Cuisine you enjoy most" colors={colors} />
                <View style={styles.stack}>
                  {CUISINE_OPTIONS.map((option) => {
                    const selected = cuisinePreference === option.value;
                    return (
                      <SelectableCard
                        key={option.value}
                        selected={selected}
                        onPress={() => {
                          tapHaptic();
                          setCuisinePreference(option.value);
                        }}
                        colors={colors}
                        style={styles.largeOption}
                      >
                        <IconBadge
                          name={option.icon as any}
                          tone={selected ? colors.primary : colors.textTertiary}
                          size={40}
                        />
                        <View style={styles.flex}>
                          <AppText variant="callout" color={selected ? "brand" : "secondary"}>
                            {option.label}
                          </AppText>
                          <AppText variant="footnote" color="tertiary">
                            {option.desc}
                          </AppText>
                        </View>
                      </SelectableCard>
                    );
                  })}
                </View>
              </View>

              <View style={styles.group}>
                <SectionLabel icon="time-outline" text="Meals per day" colors={colors} />
                <View style={styles.row}>
                  {MEALS_OPTIONS.map((option) => {
                    const selected = mealsPerDay === option.value;
                    return (
                      <SelectableCard
                        key={option.value}
                        selected={selected}
                        onPress={() => {
                          tapHaptic();
                          setMealsPerDay(option.value);
                        }}
                        colors={colors}
                        style={styles.mealCard}
                      >
                        <AppText variant="callout" color={selected ? "brand" : "secondary"}>
                          {option.label}
                        </AppText>
                        <AppText variant="caption" color="tertiary" align="center">
                          {option.desc}
                        </AppText>
                      </SelectableCard>
                    );
                  })}
                </View>
              </View>
            </View>
          </ScrollView>
        );

      case "health":
        return (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.formScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.step}>
              <StepHead
                title="Anything I should know?"
                subtitle="All optional — it just helps me keep your plan safe. Skip if nothing applies."
              />
              <View style={styles.group}>
                <AppText variant="callout">Medical conditions</AppText>
                <View style={styles.chips}>
                  {MEDICAL_OPTIONS.map((option) => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      selected={medicalConditions.includes(option.value)}
                      onPress={() => toggleMedicalCondition(option.value)}
                      colors={colors}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.group}>
                <AppText variant="callout">Injuries or pain</AppText>
                <TextInput
                  style={[inputStyle, styles.textArea]}
                  value={injuries}
                  onChangeText={setInjuries}
                  placeholder="e.g. Knee pain, lower back"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                />
              </View>
              <View style={styles.group}>
                <AppText variant="callout">Medications</AppText>
                <TextInput
                  style={[inputStyle, styles.textArea]}
                  value={medications}
                  onChangeText={setMedications}
                  placeholder="e.g. Blood pressure medication"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                />
              </View>
              <View style={styles.group}>
                <AppText variant="callout">Food allergies</AppText>
                <View style={styles.chips}>
                  {ALLERGY_OPTIONS.map((allergy) => (
                    <Chip
                      key={allergy}
                      label={allergy.replace("_", " ")}
                      selected={allergies.includes(allergy)}
                      onPress={() => toggleAllergy(allergy)}
                      colors={colors}
                      capitalize
                    />
                  ))}
                </View>
                <TextInput
                  style={inputStyle}
                  value={customAllergy}
                  onChangeText={setCustomAllergy}
                  placeholder="Other allergies (comma-separated)"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>
          </ScrollView>
        );

      case "building":
        return (
          <View style={styles.buildingWrap}>
            <View style={styles.buildingHero}>
              <View style={styles.auraLayer} pointerEvents="none">
                <HeroAura size={300} />
              </View>
              <Animated.View style={{ transform: [{ scale: buildPulse }] }}>
                <AILogoBadge size={84} />
              </Animated.View>
            </View>
            <AppText variant="display" align="center" style={styles.buildingTitle}>
              Building your plan
            </AppText>
            <AppText variant="bodyLg" color="secondary" align="center">
              {BUILD_LINES[buildLineIdx]}
            </AppText>
          </View>
        );

      case "plan":
        return renderPlan();
    }
  };

  const renderPlan = () => {
    if (!planPreview) {
      return (
        <View style={styles.buildingWrap}>
          <AppText variant="bodyLg" color="secondary" align="center">
            Preparing your plan…
          </AppText>
        </View>
      );
    }
    const { targets, topDiet, splitType, trainingDays, equipmentSummary, bio } = planPreview;
    const goalLede =
      goals.length > 1
        ? "Built around your goals. Everything below adapts as you go."
        : `Built around your goal to ${GOAL_PHRASE[bio.primaryGoal]}. Everything below adapts as you go.`;
    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.planContent}
        showsVerticalScrollIndicator={false}
      >
        <Reveal index={0}>
          <View style={styles.planHero}>
            <View style={styles.auraLayer} pointerEvents="none">
              <HeroAura size={260} animated={false} />
            </View>
            <AppText variant="caption" color="brand" uppercase align="center">
              Your personalized plan
            </AppText>
            <AppText variant="display" align="center" style={styles.planTitle}>
              Here&apos;s where we start
            </AppText>
            <AppText variant="body" color="secondary" align="center" style={styles.planLede}>
              {goalLede}
            </AppText>
          </View>
        </Reveal>

        {/* Calorie + macro hero */}
        <Reveal index={1}>
          <Card style={styles.planCard}>
            <View style={styles.ringWrap}>
              <Ring progress={1} size={150} strokeWidth={13} gradient={Gradients.calories}>
                <AnimatedNumber value={targets.calories} variant="metric" />
                <AppText variant="caption" color="tertiary" uppercase>
                  kcal / day
                </AppText>
              </Ring>
            </View>
            <View style={styles.macroRow}>
              <Stat value={`${targets.proteinG}g`} label="Protein" tone={colors.protein} />
              <Stat value={`${targets.carbsG}g`} label="Carbs" tone={colors.carbs} />
              <Stat value={`${targets.fatG}g`} label="Fat" tone={colors.fat} />
              <Stat value={`${(targets.waterMl / 1000).toFixed(1)}L`} label="Water" tone={colors.water} />
            </View>
          </Card>
        </Reveal>

        {/* Best-match diet */}
        {topDiet && (
          <Reveal index={2}>
            <Card style={styles.planCard}>
              <View style={styles.cardHead}>
                <IconBadge name="restaurant" tone={colors.primary} size={42} />
                <View style={styles.flex}>
                  <AppText variant="caption" color="tertiary" uppercase>
                    Best diet match
                  </AppText>
                  <AppText variant="headline">{topDiet.diet.name}</AppText>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: colors.primarySoft }]}>
                  <AppText variant="callout" color="brand">
                    {topDiet.score}%
                  </AppText>
                </View>
              </View>
              <View style={styles.reasonList}>
                {topDiet.reasons.slice(0, 3).map((reason) => (
                  <View key={reason} style={styles.reasonRow}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    <AppText variant="subhead" color="secondary" style={styles.flex}>
                      {reason}
                    </AppText>
                  </View>
                ))}
              </View>
            </Card>
          </Reveal>
        )}

        {/* Training — shown when the user opted into it; otherwise a soft,
            no-pressure note that workouts are ready whenever they want them. */}
        <Reveal index={3}>
          {trainingEnabled ? (
            <Card style={styles.planCard}>
              <View style={styles.cardHead}>
                <IconBadge name="barbell" tone={colors.primary} size={42} />
                <View style={styles.flex}>
                  <AppText variant="caption" color="tertiary" uppercase>
                    Your training
                  </AppText>
                  <AppText variant="headline">{splitType}</AppText>
                </View>
              </View>
              <View style={styles.trainRow}>
                <View style={[styles.trainPill, { backgroundColor: alpha(colors.primary, 0.12) }]}>
                  <ThemedIcon name="calendar-outline" size={16} role="textSecondary" />
                  <AppText variant="subhead" color="secondary">
                    {trainingDays} days / week
                  </AppText>
                </View>
                <View style={[styles.trainPill, { backgroundColor: alpha(colors.primary, 0.12) }]}>
                  <ThemedIcon name="construct-outline" size={16} role="textSecondary" />
                  <AppText variant="subhead" color="secondary">
                    {equipmentSummary}
                  </AppText>
                </View>
              </View>
            </Card>
          ) : (
            <View style={[styles.signoff, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
              <IconBadge name="barbell-outline" tone={colors.primary} size={38} />
              <AppText variant="subhead" color="secondary" style={styles.flex}>
                Whenever you feel like moving, I&apos;ve got workouts ready — no pressure.
              </AppText>
            </View>
          )}
        </Reveal>

        {/* Coach sign-off */}
        <Reveal index={4}>
          <View style={[styles.signoff, { backgroundColor: colors.primarySoft }]}>
            <AILogoBadge size={36} />
            <AppText variant="body" color="secondary" style={styles.flex}>
              This is your starting point — I&apos;ll adjust it as I learn how you eat and move. Let&apos;s get going.
            </AppText>
          </View>
        </Reveal>

        <Reveal index={5}>
          <Button
            label={loading ? "Setting up…" : "Start my journey"}
            icon="arrow-forward"
            iconRight
            loading={loading}
            disabled={loading}
            onPress={handleComplete}
            style={styles.startBtn}
          />
        </Reveal>
      </ScrollView>
    );
  };

  return (
    <View style={styles.flex} {...touchHandlers}>
      <AmbientCanvas />
      {/* The exact drifting orbs from the sign-in screen, softened to sit gently
          over the onboarding background. Persists across every onboarding step;
          above the base gradient, below content. */}
      <OrbField color={brandGradientDark[0]} opacityScale={0.65} touch={touch} />
      <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          {showHeader && (
            <View style={styles.header}>
              <ProgressBar progress={progress} gradient={colors.brandGradient} height={6} />
              <AppText variant="footnote" color="tertiary" align="center" style={styles.progressText}>
                Step {formIndex + 1} of {FORM_STEPS.length}
              </AppText>
            </View>
          )}

          {/* Content */}
          <Animated.View
            style={[
              styles.content,
              { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
            ]}
          >
            {renderStepContent()}
          </Animated.View>

          {/* Navigation */}
          {showNav && (
            <View style={styles.nav}>
              {currentStepIndex > 0 ? (
                <Button label="Back" icon="arrow-back" variant="tonal" fullWidth={false} onPress={prevStep} />
              ) : (
                <View />
              )}
              <View style={styles.flex} />
              <Button
                label={currentStep === "welcome" ? "Let's go" : isLastForm ? "Build my plan" : "Continue"}
                icon="arrow-forward"
                iconRight
                fullWidth={false}
                onPress={nextStep}
              />
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* ───────────────────────────── Sub-components ──────────────────────────── */

function StepHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.stepHead}>
      <AppText variant="title" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="body" color="secondary" style={styles.subtitle}>
        {subtitle}
      </AppText>
    </View>
  );
}

function SectionLabel({
  icon,
  text,
  colors,
}: {
  icon: string;
  text: string;
  colors: ReturnType<typeof useColors>["colors"];
}) {
  return (
    <View style={styles.sectionLabel}>
      <Ionicons name={icon as any} size={16} color={colors.primary} />
      <AppText variant="callout">{text}</AppText>
    </View>
  );
}

/** Four little bars that fill to `level` — a quick visual read of intensity. */
function IntensityMeter({
  level,
  active,
  colors,
}: {
  level: number;
  active: boolean;
  colors: ReturnType<typeof useColors>["colors"];
}) {
  return (
    <View style={styles.meter}>
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            styles.meterBar,
            {
              backgroundColor:
                i <= level ? (active ? colors.primary : colors.textTertiary) : colors.border,
              height: 4 + i * 2,
            },
          ]}
        />
      ))}
    </View>
  );
}

function SelectableCard({
  selected,
  onPress,
  colors,
  style,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>["colors"];
  style?: any;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectable,
        {
          // De-boxed: soft filled surface, no hard outline. Only the SELECTED
          // state draws a brand ring, so the screen reads calm, not form-y.
          backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted,
          borderColor: selected ? colors.primary : "transparent",
        },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

function Chip({
  label,
  selected,
  onPress,
  colors,
  capitalize,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>["colors"];
  capitalize?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <AppText
        variant="subhead"
        color={selected ? colors.onPrimary : "secondary"}
        style={[styles.chipText, capitalize && styles.cap]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  header: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  progressText: {},

  content: { flex: 1, paddingHorizontal: Spacing.screen },

  step: { gap: Spacing.xxl, paddingBottom: Spacing.xl, paddingTop: Spacing.xs },
  /** Denser rhythm for form-heavy steps (e.g. the basics screen). */
  stepCompact: { gap: Spacing.lg },
  /** Extra scroll room on input screens so the last field always clears the keyboard. */
  formScroll: { paddingBottom: Spacing.giant },
  stepHead: { gap: Spacing.sm },
  title: {},
  subtitle: {},

  // Welcome
  welcomeWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.lg, paddingHorizontal: Spacing.lg },
  welcomeHero: { alignItems: "center", justifyContent: "center", height: 140 },
  /** Centered, non-interactive glow layer — symmetric centering keeps the aura
   *  behind the hero content regardless of the container's width. */
  auraLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeTitle: { marginTop: Spacing.sm },
  welcomeSub: { paddingHorizontal: Spacing.md },
  welcomeChips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: Spacing.sm, marginTop: Spacing.sm },
  welcomeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },

  group: { gap: Spacing.md },
  /** Tighter label→field pairing for compact forms. */
  groupTight: { gap: Spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    fontSize: 16,
  },
  textArea: { height: 72, textAlignVertical: "top" },

  row: { flexDirection: "row", gap: Spacing.md },
  stack: { gap: Spacing.md },

  sectionLabel: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },

  selectable: {
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  sexCard: { flex: 1, alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.lg },
  largeOption: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  activityCard: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  activityDesc: { marginTop: 1 },
  expCard: { flex: 1, alignItems: "center", gap: Spacing.xs, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.sm },
  expDesc: { marginTop: 1 },
  mealCard: { flex: 1, alignItems: "center", gap: Spacing.xs, paddingVertical: Spacing.lg },

  // Intensity meter
  meter: { flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: Spacing.sm, height: 12 },
  meterBar: { width: 16, borderRadius: 2 },

  // Region confirm chip
  regionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipText: { fontWeight: "600" },
  cap: { textTransform: "capitalize" },

  goalGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  goalCard: {
    width: (width - Spacing.screen * 2 - Spacing.md) / 2,
    gap: Spacing.sm,
    alignItems: "flex-start",
  },
  goalLabel: { marginTop: 2 },

  // Building beat
  buildingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing.screen,
  },
  buildingHero: { alignItems: "center", justifyContent: "center", height: 150 },
  buildingTitle: { marginTop: Spacing.sm },

  // Plan reveal
  planContent: { paddingBottom: Spacing.xxxl, gap: Spacing.lg },
  planHero: { alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm },
  planTitle: { marginTop: Spacing.xs },
  planLede: { paddingHorizontal: Spacing.md, marginTop: Spacing.xs },
  planCard: { gap: Spacing.lg },
  ringWrap: { alignItems: "center" },
  macroRow: { flexDirection: "row", justifyContent: "space-between" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  scoreBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  reasonList: { gap: Spacing.sm },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  trainRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  trainPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  signoff: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
  },
  startBtn: { marginTop: Spacing.sm },

  nav: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
});
