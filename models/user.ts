/**
 * USER MODELS
 * Core user data types for bio info and profile
 */

import type { Equipment } from "./workout";

export type Sex = "male" | "female";

export type ActivityLevel =
  | "sedentary" // Little/no exercise
  | "light" // Light exercise 1-3 days/week
  | "moderate" // Moderate exercise 3-5 days/week
  | "very_active"; // Hard exercise 6-7 days/week

export type PrimaryGoal =
  | "lose_weight"
  | "build_muscle"
  | "improve_fitness"
  | "increase_energy"
  | "better_health"
  | "athletic_performance";

export type DietaryRestriction =
  | "none"
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "halal"
  | "kosher"
  | "gluten_free"
  | "dairy_free";

/**
 * CuisinePreference - The regional flavor a user wants their meals drawn from.
 * Maps to the `cuisine` tags on meals in DietDatabase. "mixed" = no preference
 * (draw from everything). The generator PREFERS the matching cuisine but always
 * falls back gracefully so a diet never runs out of meals.
 */
export type CuisinePreference =
  | "african" // Nigerian / West-African dishes
  | "western" // European & Western dishes
  | "mediterranean" // Mediterranean dishes
  | "mixed"; // No preference — all cuisines

export type ExerciseLevel =
  | "beginner" // New to exercise
  | "intermediate" // Regular exerciser
  | "advanced"; // Very experienced

/**
 * Health conditions the app can tailor diets to. Each maps to one or more
 * therapeutic diets in the library (see CONDITION_INFO in DietMatchService).
 * Values are stable storage keys — ADD new ones, never rename the originals
 * (existing saved profiles depend on the exact strings).
 */
export type MedicalCondition =
  // Heart & metabolic
  | "hypertension"
  | "high_cholesterol"
  | "diabetes_type2"
  | "diabetes_type1"
  | "prediabetes"
  | "metabolic_syndrome"
  // Digestive
  | "gerd"
  | "ibs"
  | "ibd"
  | "celiac"
  | "diverticulitis"
  | "constipation"
  | "lactose_intolerance"
  // Liver, kidney & endocrine
  | "renal_issues"
  | "fatty_liver"
  | "gallbladder"
  | "pancreatitis"
  | "hypothyroidism"
  | "hyperthyroidism"
  | "gout"
  // Hormonal & life-stage
  | "pcos"
  | "endometriosis"
  | "pregnancy"
  | "postpartum"
  | "menopause"
  // Immune, blood & musculoskeletal
  | "anemia"
  | "arthritis"
  | "osteoporosis"
  // Neurological
  | "migraine"
  | "none";

export type CommonAllergy =
  | "peanuts"
  | "tree_nuts"
  | "dairy"
  | "eggs"
  | "shellfish"
  | "fish"
  | "wheat"
  | "soy"
  | "gluten";

/**
 * BodyArea — where an injury/pain is, asked so the workout generator can avoid
 * loading it. Stored as the string tokens in `UserBio.injuries`; the generator
 * matches them (plus free-text) against movement patterns + target muscles.
 */
export type BodyArea =
  | "neck"
  | "shoulder"
  | "arm" // elbow / biceps / triceps
  | "wrist" // wrist / hand
  | "chest"
  | "back" // upper / lower back, spine
  | "core" // abs / obliques
  | "hip"
  | "leg" // quads / hamstrings / glutes
  | "knee"
  | "ankle"; // ankle / foot

/**
 * MedicationCategory — the KIND of medication a user takes (never drug names).
 * Used to surface food/nutrition interactions and advisories (e.g. blood
 * thinners ⇒ steady leafy-greens; corticosteroids/diuretics ⇒ lower sodium).
 */
export type MedicationCategory =
  | "antibiotics"
  | "antidepressants"
  | "blood_thinners"
  | "blood_pressure"
  | "corticosteroids"
  | "diabetes"
  | "diuretics"
  | "thyroid"
  | "nsaids" // anti-inflammatory / pain
  | "other";

/** Pregnancy stage — scales energy/hydration targets and exercise caution. */
export type PregnancyTrimester = 1 | 2 | 3;

/**
 * UserBio - Core bio information collected during onboarding
 * This is the single source of truth for user health data
 */
export interface UserBio {
  // Required fields
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  exerciseLevel: ExerciseLevel;
  /**
   * The single goal every engine keys off (nutrition target, diet match,
   * workout split). Derived from `goals[0]` when a user picks several — kept as
   * its own field so all existing consumers stay untouched.
   */
  primaryGoal: PrimaryGoal;
  /**
   * Everything the user said brought them here (onboarding is multi-select).
   * `primaryGoal` is `goals[0]`. Optional for back-compat with bios saved before
   * multi-goal existed. Used for copy ("built around your goals") + branching.
   */
  goals?: PrimaryGoal[];
  /**
   * Whether the user opted into structured training during onboarding. When
   * false we still keep a workout plan ready (defaults), but we don't front-load
   * training questions or push workouts — we wait until they show interest and
   * offer to set it up. Optional/undefined = treat as opted-in (legacy bios).
   */
  trainingEnabled?: boolean;
  dietaryRestriction: DietaryRestriction;

  // Health & Safety
  allergies: string[]; // CommonAllergy[] + custom strings
  medicalConditions: MedicalCondition[];
  injuries?: string[]; // Current injuries — BodyArea tokens + free text
  medications?: string[]; // Current medications (free text, optional)
  /** KIND of medications taken (categories, not names) — drives diet advisories. */
  medicationCategories?: MedicationCategory[];
  /** Which trimester, when `medicalConditions` includes "pregnancy". */
  pregnancyTrimester?: PregnancyTrimester;

  // Preferences (optional)
  foodDislikes?: string[];
  cuisinePreference?: CuisinePreference; // Default "mixed" if unset
  /**
   * Free-text country or region (e.g. "Nigeria", "Italy", "Philippines").
   * Sent to the AI backend so meals use foods realistically available where the
   * user lives — the signal that unlocks true cross-continent coverage. Optional.
   */
  region?: string;
  mealsPerDay: 3 | 4;
  waterTargetMl?: number; // Default calculated if not set

  // Training preferences (captured in onboarding; optional for back-compat)
  equipment?: Equipment[]; // Default ["none"] (bodyweight only)
  workoutDaysPerWeek?: number; // 2–6; falls back to goal-derived default
}

/**
 * UserProfile - Extended user data for display
 */
export interface UserProfile extends UserBio {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  isOnboardingComplete: boolean;
}

/**
 * UserGoals - Trackable goals set in profile
 */
export interface UserGoals {
  dailyCaloriesTarget?: number;
  weeklyWorkoutsTarget?: number;
  dailyWaterMl?: number;
  dietComplianceDaysPerWeek?: number; // e.g., "stick to plan 5 days/week"

  /**
   * Target body weight (kg). The destination the Transformation Forecast aims
   * at — required for an Expected Goal Date and a Likelihood-of-Success read.
   * Unset = no weight goal (forecast falls back to trajectory-only).
   */
  targetWeightKg?: number;
  /**
   * When the user's journey began (YYYY-MM-DD, local). Drives the briefing's
   * "Day N of your … Journey" header. Set at onboarding; for pre-existing users
   * we fall back to the earliest logged day.
   */
  journeyStartedAt?: string;
}

/**
 * Default bio values for new users
 */
export const DEFAULT_USER_BIO: Partial<UserBio> = {
  activityLevel: "moderate",
  exerciseLevel: "beginner",
  dietaryRestriction: "none",
  cuisinePreference: "mixed",
  mealsPerDay: 3,
  equipment: ["none"],
  allergies: [],
  medicalConditions: [],
  foodDislikes: [],
};

/**
 * Activity level multipliers for calorie calculations
 */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
};
