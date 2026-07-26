/**
 * FITNESS MODULE — shared types.
 *
 * The fitness module is a self-contained layer on top of the existing app:
 * it READS the app's single sources of truth (UserBio, workoutPlan,
 * workoutLog, sessionHistory from AppContext) and owns only its own
 * preference/UX state (FitnessProfile) plus pure derivations.
 *
 * Nothing in this module mutates AppContext state — completed workouts still
 * flow through the proven guided-session → session-summary → logWorkout path.
 */

import type { Difficulty } from "@/models/exercise";
import type { PrimaryGoal } from "@/models/user";

/* ────────────────────────────── Workouts ────────────────────────────── */

/** The training style a workout belongs to (drives filters + recs). */
export type WorkoutStyle =
  | "strength"
  | "hiit"
  | "cardio"
  | "core"
  | "mobility"
  | "recovery"
  | "endurance"
  | "power";

/** Which part of the body a workout centers on. */
export type BodyFocus =
  | "full_body"
  | "upper"
  | "lower"
  | "core"
  | "back"
  | "chest_arms"
  | "glutes_legs";

/** How demanding a session feels (independent of skill difficulty). */
export type EnergyLevel = "low" | "medium" | "high";

/** Named hue for the generated art tile (mapped to gradients in the UI). */
export type ArtHue =
  | "brand"
  | "ember"
  | "violet"
  | "gold"
  | "teal"
  | "sky"
  | "rose"
  | "forest"
  | "slate"
  | "midnight";

/** Decorative composition variant for the generated art tile. */
export type ArtPattern = "orbit" | "rings" | "dots" | "beams";

/**
 * One exercise inside a workout block. `exerciseId` must exist in
 * EXERCISE_DATABASE; sets/reps override the exercise defaults when present
 * (warm-ups run 1 short set, cool-downs hold longer, etc.).
 */
export interface WorkoutBlockItem {
  exerciseId: string;
  sets?: number;
  reps?: string;
}

/**
 * A complete authored workout: metadata + warm-up / main / cool-down blocks.
 * Kept declarative so the catalog can derive duration, calories, equipment
 * and muscle coverage — and so the guided-session player can run it as a
 * flat exercise list without any player changes.
 */
export interface WorkoutDefinition {
  id: string;
  name: string;
  /** One-line hook shown on cards ("Twelve minutes. Zero excuses."). */
  tagline: string;
  description: string;
  style: WorkoutStyle;
  focus: BodyFocus;
  difficulty: Difficulty;
  energy: EnergyLevel;
  /** Original Welliva coach persona leading this session. */
  coachId: string;
  /** Free-form searchable tags ("no jumping", "quiet", "morning"…). */
  tags: string[];
  /** Which primary goals this workout serves best (rec-engine signal). */
  goalFit: PrimaryGoal[];
  warmup: WorkoutBlockItem[];
  main: WorkoutBlockItem[];
  cooldown: WorkoutBlockItem[];
  /** Beat that matches the session's tempo (player preselects it). */
  suggestedBeatId?: string;
  /** Generated art tile: an icon on a themed gradient — original, code-drawn. */
  art: { icon: string; hue: ArtHue; pattern?: ArtPattern };
}

/** A workout enriched with everything derived from its exercises. */
export interface ResolvedWorkout extends WorkoutDefinition {
  durationMinutes: number;
  exerciseCount: number;
  /** Deduped equipment across all blocks; empty = bodyweight only. */
  equipment: string[];
  /** Deduped target muscles across all blocks. */
  targetMuscles: string[];
  /** kcal estimate for a given body weight (default 70 kg). */
  estimatedCalories: number;
}

/** Filters the library screen can combine. */
export interface WorkoutFilter {
  query?: string;
  style?: WorkoutStyle | "all";
  difficulty?: Difficulty | "all";
  focus?: BodyFocus | "all";
  energy?: EnergyLevel | "all";
  /** Max minutes ("show me something ≤ 20 min"). */
  maxMinutes?: number;
  /** Only workouts fully doable with this equipment (["none"] = bodyweight). */
  equipment?: string[];
  /** Goal lens (from the user's primary goal). */
  goal?: PrimaryGoal;
  favoritesOnly?: boolean;
  coachId?: string;
}

/* ─────────────────────────── Fitness profile ─────────────────────────── */

export type FitnessGoal =
  | "get_stronger"
  | "lose_fat"
  | "build_muscle"
  | "boost_endurance"
  | "move_more"
  | "reduce_stress";

export type WorkoutLocation = "home" | "gym" | "outdoors" | "anywhere";

/** Reminder preferences — consumed by FitnessNotifications. */
export interface ReminderPrefs {
  workouts: boolean;
  hydration: boolean;
  stretch: boolean;
  weeklySummary: boolean;
  /** Local hour (0–23) for the workout reminder. */
  hour: number;
}

/**
 * The evolving fitness profile — everything the module remembers about how
 * this user likes to train. UX/preference state only; body data (weight,
 * injuries, equipment, level) stays in UserBio, the app's single source of
 * truth, and is read alongside this.
 */
export interface FitnessProfile {
  version: 1;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  /** Whether the first-run fitness setup has been completed (or skipped). */
  setupComplete: boolean;

  goals: FitnessGoal[];
  location: WorkoutLocation;
  /** Typical session length the user wants, in minutes. */
  typicalDurationMin: number;
  preferredStyles: WorkoutStyle[];
  /** Days the user plans to train: 0 = Mon … 6 = Sun. */
  daysAvailable: number[];
  /** Free-text target milestone ("first full push-up", "5k under 30"). */
  milestone?: string;

  // Player experience
  musicEnabled: boolean;
  musicVolume: number; // 0..1
  preferredBeatId?: string;
  voiceGuidance: boolean;

  reminders: ReminderPrefs;

  // Evolving signals
  favorites: string[]; // workout ids
  /** Recommendation ids the user was shown but didn't do (adaptation memory). */
  recommendationHistory: RecommendationMemory[];
}

/** One day's recommendation outcome — lets the engine adapt to skips. */
export interface RecommendationMemory {
  date: string; // YYYY-MM-DD
  workoutId: string; // library id or "plan"
  completed: boolean;
}

/* ─────────────────────────── Recommendations ─────────────────────────── */

export type RecommendationKind = "plan_session" | "library_workout" | "rest";

export interface FitnessRecommendation {
  kind: RecommendationKind;
  /** Set when kind === "library_workout". */
  workoutId?: string;
  /** Human title of what's being recommended. */
  title: string;
  /** Plain-language, explainable reasons (max 4). */
  reasons: string[];
  /** One coach-voice insight line for the dashboard. */
  insight: string;
}

/* ─────────────────────────────── Beats ─────────────────────────────── */

export interface BeatMeta {
  id: string;
  title: string;
  bpm: number;
  energy: EnergyLevel;
  /** Short mood descriptor ("warm analog groove for winding down"). */
  mood: string;
}

/* ─────────────────────────────── Progress ─────────────────────────────── */

export interface WeekActivity {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  workouts: number;
  minutes: number;
}

export interface PersonalBests {
  longestSessionMin: number;
  mostRepsInSession: number;
  bestWeekWorkouts: number;
  longestStreakDays: number;
}

export interface ProgressSnapshot {
  totalWorkouts: number;
  totalMinutes: number;
  totalCalories: number;
  thisWeekWorkouts: number;
  thisWeekMinutes: number;
  thisMonthMinutes: number;
  currentStreakDays: number;
  /** Last 8 weeks, oldest first — powers the consistency bars. */
  weeklyHistory: WeekActivity[];
  personalBests: PersonalBests;
  /** 0..1 — workouts done this week vs. days the user planned to train. */
  weeklyGoalProgress: number;
}

/* ─────────────────────────────── Calendar ─────────────────────────────── */

export type CalendarDayStatus =
  | "completed"
  | "planned"
  | "missed"
  | "rest"
  | "future";

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  /** 1–31, or 0 for padding cells outside the month. */
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  status: CalendarDayStatus;
  /** Labels of workouts completed that day. */
  completedLabels: string[];
  /** Label of the planned session, when one exists. */
  plannedLabel?: string;
}

export interface CalendarMonth {
  year: number;
  month: number; // 1–12
  label: string; // "July 2026"
  /** Weeks of 7 CalendarDay cells, Monday-first. */
  weeks: CalendarDay[][];
  completedCount: number;
  plannedCount: number;
  missedCount: number;
}
