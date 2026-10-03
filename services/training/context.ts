/**
 * TRAINING CONTEXT — everything the planner decides ONCE about a person,
 * before it chooses a single exercise.
 *
 * Every field here is derived from something the user told the app, and every
 * one that changes the plan also produces the plain line that says so (see
 * `weekReasons` in week.ts). That pairing is the point of the module: a choice
 * the app cannot explain from the user's own data does not get made.
 *
 * What feeds it:
 *   goals        → the training EMPHASIS (strength, muscle, fat loss, …), which
 *                  sets the dose rules: sets, rep range, rest, caps
 *   level        → difficulty ceiling and starting volume
 *   conditions   → a lower ceiling where pregnancy / postpartum / blood
 *                  pressure cap intensity
 *   injuries     → movement patterns and muscles kept out (safety.ts)
 *   age, height,
 *   weight       → low-impact (no jumping) and balance work, where the
 *                  guidance says so — never a different program by sex
 *   activity     → a gentler start for a mostly-seated beginner
 *   equipment,
 *   location     → what the moves may use ("gym" brings the gym's kit)
 *   days, length,
 *   styles,
 *   milestone    → the week's shape, the time budget, the extras
 */

import type { FitnessGoal, WorkoutLocation, WorkoutStyle } from "../../fitness/types";
import type { Difficulty } from "../../models/exercise";
import type { PrimaryGoal, UserBio } from "../../models/user";
import type { Equipment } from "../../models/workout";
import type { TrainingPrefs } from "./prefs";
import {
  buildContraindications,
  ceilingLabel,
  difficultyIndex,
  DIFFICULTY_ORDER,
  type Contraindications,
} from "./safety";

/** What the user wants training to DO, in training terms. */
export type Emphasis =
  | "strength"
  | "muscle"
  | "fat_loss"
  | "endurance"
  | "general"
  | "everyday"
  | "calm";

/** The dose rules an emphasis implies. */
export interface Scheme {
  /** Sets on a day's main lifts, and on everything that supports them. */
  mainSets: number;
  accSets: number;
  /** Multiplies the database's rep counts / timed seconds. */
  repFactor: number;
  timedFactor: number;
  /** Seconds of rest between sets. */
  mainRest: number;
  accRest: number;
  /** Most reps per set before a move is outgrown (per side: 60% of it). */
  repCap: number;
  /** Longest timed set, in seconds. */
  holdCap: number;
}

export const EMPHASIS_LABEL: Record<Emphasis, string> = {
  strength: "strength",
  muscle: "muscle",
  fat_loss: "fat loss",
  endurance: "endurance",
  general: "all-round fitness",
  everyday: "moving more",
  calm: "lower stress",
};

/** How each emphasis doses work — and how that reads in the week's reasons. */
const SCHEMES: Record<Emphasis, Scheme & { phrase: string }> = {
  strength: {
    mainSets: 4, accSets: 3, repFactor: 0.75, timedFactor: 1,
    mainRest: 90, accRest: 60, repCap: 12, holdCap: 45,
    phrase: "fewer, harder reps with longer rests",
  },
  muscle: {
    mainSets: 4, accSets: 3, repFactor: 1, timedFactor: 1,
    mainRest: 75, accRest: 60, repCap: 15, holdCap: 60,
    phrase: "more sets per muscle, moderate rests",
  },
  fat_loss: {
    mainSets: 3, accSets: 2, repFactor: 1.25, timedFactor: 1.25,
    mainRest: 40, accRest: 30, repCap: 20, holdCap: 60,
    phrase: "higher reps and short rests to keep your heart rate up",
  },
  endurance: {
    mainSets: 3, accSets: 2, repFactor: 1.4, timedFactor: 1.5,
    mainRest: 45, accRest: 30, repCap: 25, holdCap: 90,
    phrase: "longer sets and holds at a steady pace",
  },
  general: {
    mainSets: 3, accSets: 2, repFactor: 1.1, timedFactor: 1.1,
    mainRest: 60, accRest: 45, repCap: 15, holdCap: 60,
    phrase: "a balance of strength and conditioning",
  },
  everyday: {
    mainSets: 2, accSets: 2, repFactor: 1, timedFactor: 1,
    mainRest: 45, accRest: 30, repCap: 15, holdCap: 60,
    phrase: "short, steady sessions that are easy to keep up",
  },
  calm: {
    mainSets: 2, accSets: 2, repFactor: 1, timedFactor: 1.25,
    mainRest: 45, accRest: 30, repCap: 15, holdCap: 90,
    phrase: "low intensity with longer, breath-led holds",
  },
};

export function schemePhrase(e: Emphasis): string {
  return SCHEMES[e].phrase;
}

const TRAINING_GOAL_EMPHASIS: Record<FitnessGoal, Emphasis> = {
  get_stronger: "strength",
  build_muscle: "muscle",
  lose_fat: "fat_loss",
  boost_endurance: "endurance",
  move_more: "everyday",
  reduce_stress: "calm",
};

/**
 * One emphasis per profile goal, never two goals sharing one: two people who
 * came for different things must not get the same week. "More energy" is
 * steady aerobic work — the training most consistently shown to lift fatigue —
 * while "better health" is the gentle, balanced week.
 */
const PROFILE_GOAL_EMPHASIS: Record<PrimaryGoal, Emphasis> = {
  athletic_performance: "strength",
  build_muscle: "muscle",
  lose_weight: "fat_loss",
  improve_fitness: "general",
  increase_energy: "endurance",
  better_health: "everyday",
};

/** Why jumping is out of the plan, when it is. */
export interface LowImpact {
  why: "pregnancy" | "postpartum" | "injury" | "age" | "joints";
  /** The sentence fragment the week's reasons use. */
  label: string;
}

const LOWER_LIMB = ["knee", "ankle", "foot", "feet", "hip", "shin", "achilles", "leg"];

const ALL_EQUIPMENT: Equipment[] = [
  "none",
  "dumbbells",
  "resistance_bands",
  "pull_up_bar",
  "bench",
  "kettlebell",
];

/** Session length when the user never chose one: by level, shorter for gentle goals. */
const DEFAULT_MINUTES: Record<Difficulty, number> = {
  beginner: 30,
  intermediate: 40,
  advanced: 50,
};

export interface TrainingContext {
  bio: UserBio;
  level: Difficulty;
  /** Hardest difficulty the plan may use: the level, or lower under a condition cap. */
  ceiling: Difficulty;
  /** Why the ceiling sits below the level, when it does ("pregnancy, trimester 3"). */
  ceilingWhy: string | null;
  emphasis: Emphasis;
  /** Further goals, after the first — each adds its own extra (finisher, set…). */
  secondary: Emphasis[];
  /** Where the goals came from: setup's training goals, or the profile's goals. */
  goalSource: "training" | "profile";
  scheme: Scheme;
  /** Fingerprint of the dose rules — a change means doses start fresh. */
  schemeKey: string;
  equipment: Equipment[];
  /** True when "I train at the gym" put the gym's kit on the list. */
  gymKit: boolean;
  contra: Contraindications;
  lowImpact: LowImpact | null;
  /** WHO: balance work on 3+ days a week from 65. */
  balance: boolean;
  age: number;
  /** A mostly-seated beginner starts at two sets — said once, in the reasons. */
  gentleStart: boolean;
  warmupMoves: number;
  cooldownMoves: number;
  days: number[];
  daysSource: "you" | "derived";
  sessionMinutes: number;
  minutesSource: "you" | "level";
  styles: WorkoutStyle[];
  location: WorkoutLocation;
  milestoneText: string | null;
  prefs: TrainingPrefs;
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function emphasesFrom(bio: UserBio, prefs: TrainingPrefs): { list: Emphasis[]; source: "training" | "profile" } {
  if (prefs.goals.length > 0) {
    return { list: uniq(prefs.goals.map((g) => TRAINING_GOAL_EMPHASIS[g])), source: "training" };
  }
  const goals = bio.goals && bio.goals.length > 0 ? bio.goals : [bio.primaryGoal];
  return { list: uniq(goals.map((g) => PROFILE_GOAL_EMPHASIS[g] ?? "general")), source: "profile" };
}

function lowImpactFor(bio: UserBio, level: Difficulty): LowImpact | null {
  const conditions = bio.medicalConditions ?? [];
  if (conditions.includes("pregnancy")) return { why: "pregnancy", label: "pregnancy-safe" };
  if (conditions.includes("postpartum")) return { why: "postpartum", label: "a gentle postpartum return" };
  const injury = (bio.injuries ?? [])
    .map((s) => s.trim())
    .find((s) => LOWER_LIMB.some((k) => s.toLowerCase().includes(k)));
  if (injury) return { why: "injury", label: `protects your ${injury.toLowerCase()}` };
  if (bio.age >= 65 && level !== "advanced") return { why: "age", label: "easier on joints past 65" };
  const m = bio.heightCm / 100;
  const bmi = m > 0 ? bio.weightKg / (m * m) : 0;
  if (bmi >= 30 && level === "beginner") return { why: "joints", label: "kinder to your joints" };
  return null;
}

function schemeFor(
  emphasis: Emphasis,
  secondary: Emphasis[],
  level: Difficulty,
  gentleStart: boolean,
): Scheme {
  const { phrase: _phrase, ...base } = SCHEMES[emphasis];
  const s: Scheme = { ...base };
  if (level === "beginner") {
    s.mainSets = Math.max(2, s.mainSets - 1);
    s.accSets = Math.max(2, s.accSets - 1);
    // The database's defaults are already beginner doses: a beginner gets half
    // the goal's shift on top of them, and never more than 15 reps a set.
    s.repFactor = 1 + (s.repFactor - 1) / 2;
    s.timedFactor = 1 + (s.timedFactor - 1) / 2;
    s.repCap = Math.min(s.repCap, 15);
  } else if (level === "advanced" && (emphasis === "strength" || emphasis === "muscle")) {
    s.mainSets = Math.min(5, s.mainSets + 1);
  }
  // A second goal of building muscle or strength earns the main lifts a set.
  if (
    emphasis !== "strength" &&
    emphasis !== "muscle" &&
    (secondary.includes("muscle") || secondary.includes("strength"))
  ) {
    s.mainSets = Math.min(5, s.mainSets + 1);
  }
  if (gentleStart) {
    s.mainSets = 2;
    s.accSets = 2;
  }
  return s;
}

export function deriveContext(bio: UserBio, prefs: TrainingPrefs): TrainingContext {
  const level: Difficulty = DIFFICULTY_ORDER.includes(bio.exerciseLevel)
    ? bio.exerciseLevel
    : "beginner";
  const contra = buildContraindications(bio);
  const ceiling =
    contra.maxDifficulty && difficultyIndex(contra.maxDifficulty) < difficultyIndex(level)
      ? contra.maxDifficulty
      : level;

  const { list, source } = emphasesFrom(bio, prefs);
  const emphasis = list[0] ?? "general";
  const secondary = list.slice(1, 3);
  const gentleStart = level === "beginner" && bio.activityLevel === "sedentary";
  const scheme = schemeFor(emphasis, secondary, level, gentleStart);

  const gymKit = prefs.location === "gym";
  const own = bio.equipment && bio.equipment.length > 0 ? bio.equipment : (["none"] as Equipment[]);
  const equipment = gymKit ? ALL_EQUIPMENT : uniq<Equipment>(["none", ...own]);

  const minutesSource = prefs.sessionMinutes !== null ? "you" : "level";
  const gentle = emphasis === "everyday" || emphasis === "calm";
  const sessionMinutes =
    prefs.sessionMinutes ?? Math.max(15, DEFAULT_MINUTES[level] - (gentle ? 5 : 0));
  const short = sessionMinutes <= 15;

  return {
    bio,
    level,
    ceiling,
    ceilingWhy: ceiling !== level ? ceilingLabel(bio, level) : null,
    emphasis,
    secondary,
    goalSource: source,
    scheme,
    schemeKey: [emphasis, scheme.mainSets, scheme.accSets, scheme.repFactor, scheme.timedFactor].join(":"),
    equipment,
    gymKit,
    contra,
    lowImpact: lowImpactFor(bio, level),
    balance: bio.age >= 65,
    age: bio.age,
    gentleStart,
    warmupMoves: short ? 1 : bio.age >= 50 ? 3 : 2,
    cooldownMoves: short ? 1 : emphasis === "calm" ? 3 : 2,
    days: prefs.days,
    daysSource: prefs.daysSource,
    sessionMinutes,
    minutesSource,
    styles: prefs.styles,
    location: prefs.location,
    milestoneText: prefs.milestone,
    prefs,
  };
}
