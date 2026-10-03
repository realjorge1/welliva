/**
 * TRAINING VOCABULARY — facts about exercises the planner needs and the
 * exercise database doesn't carry: which moves jump, which ones are explosive,
 * which train balance, which make honest warm-ups and cool-downs, and the
 * ladders a milestone climbs.
 *
 * Every id here is checked against EXERCISE_DATABASE by
 * services/training/__tests__/vocabulary.test.ts, and the jump list is checked
 * the other way round too: any exercise whose NAME says it jumps must be on it,
 * so adding "Jumping Split Squats" to the database without listing it here is a
 * red test rather than a jump quietly reaching someone with a bad knee.
 */

import type { MovementPattern } from "../../models/workout";

/**
 * Moves that leave the floor or land with impact. Out of the plan whenever it
 * runs low-impact (pregnancy, a lower-limb injury, 65+, or a heavier beginner).
 */
export const HIGH_IMPACT: ReadonlySet<string> = new Set([
  "cardio_01", // Jumping Jacks
  "cardio_02", // High Knees
  "cardio_03", // Butt Kicks
  "cardio_04", // Burpees
  "cardio_05", // Jump Rope (no rope)
  "cardio_06", // Lateral Shuffles
  "cardio_07", // Skaters
  "cardio_10", // Star Jumps
  "cardio_13", // Fast Feet
  "cardio_14", // Squat Thrusts
  "cardio_16", // Plank Jacks
  "cardio_17", // Tuck Jumps
  "cardio_18", // Broad Jumps
  "cardio_19", // Burpee Tuck Jumps
  "cardio_20", // Sprawls
  "legs_05", // Jump Squats
  "legs_18", // Jumping Lunges
]);

/** The explosive subset — what a Power day's lead movement is drawn from. */
export const PLYOMETRIC: ReadonlySet<string> = new Set([
  "legs_05",
  "legs_18",
  "cardio_04",
  "cardio_07",
  "cardio_10",
  "cardio_17",
  "cardio_18",
  "cardio_19",
]);

/**
 * Balance work, easiest first. WHO's guidance for adults over 65 is balance and
 * strength work on 3+ days a week, so from 65 every strength day carries one.
 */
export const BALANCE: readonly string[] = [
  "legs_14", // Single-Leg Balance Hold
  "core_09", // Bird Dog
  "legs_13", // Chair Sit-to-Stand
  "hinge_06", // Single-Leg Romanian Deadlift
];

/**
 * Moves done lying flat on the back or face down (side-lying is not on it).
 * From the second trimester ACOG advises against lying flat on the back, and
 * lying face down stops being practical — so these leave a pregnant user's
 * plan from trimester 2. Kept in sync with each exercise's setup text by the
 * vocabulary test.
 */
export const LYING_DOWN: ReadonlySet<string> = new Set([
  "push_07", // Dumbbell Chest Press (flat bench)
  "pull_01", // Superman Hold
  "pull_02", // Reverse Snow Angels
  "pull_09", // Prone Y-T Raises
  "pull_14", // Inverted Rows
  "hinge_01", // Glute Bridges
  "hinge_02", // Single-Leg Glute Bridge
  "hinge_12", // Marching Glute Bridge
  "core_02", // Crunches
  "core_03", // Dead Bug
  "core_04", // Bicycle Crunches
  "core_06", // Leg Raises
  "core_10", // Hollow Body Hold
  "core_11", // Flutter Kicks
  "core_14", // Reverse Crunches
  "core_15", // Sit-ups
  "core_16", // V-Ups
  "core_17", // Toe Touches
  "core_19", // Windshield Wipers
  "core_20", // Hollow Body Rocks
  "core_23", // Heel Taps
  "flex_06", // Cobra Stretch
  "flex_07", // Figure-4 Stretch
  "flex_20", // Bridge Pose
]);

/** Moves that travel — what open space outdoors is good for. */
export const LOCOMOTION: ReadonlySet<string> = new Set([
  "cardio_02",
  "cardio_03",
  "cardio_05",
  "cardio_06",
  "cardio_07",
  "cardio_11",
  "cardio_13",
  "cardio_18",
]);

/**
 * Warm-ups: a pulse raiser, then joint primers for what the day trains. Lists
 * are in preference order; the planner takes the first ones that are safe and
 * not already in the session, so an excluded move falls through to the next.
 */
export const WARMUP = {
  pulse: ["cardio_01", "cardio_08", "cardio_21"],
  /** Pulse raisers that never jump — used whenever the plan is low-impact. */
  pulseLowImpact: ["cardio_08", "cardio_21"],
  upper: ["flex_13", "flex_14", "flex_03"],
  lower: ["flex_05", "flex_03", "flex_14"],
  full: ["flex_13", "flex_03", "flex_14"],
  gentle: ["flex_03", "flex_14", "flex_13"],
} as const;

/** Cool-downs: static stretches for what the day trained, preference order. */
export const COOLDOWN = {
  upper: ["flex_15", "flex_04", "flex_11"],
  lower: ["flex_01", "flex_09", "flex_07"],
  full: ["flex_01", "flex_15", "flex_04"],
  conditioning: ["flex_02", "flex_01", "flex_04"],
  gentle: ["flex_04", "flex_12", "flex_08"],
} as const;

/**
 * A milestone the user can name, and the rungs that climb to it (easiest →
 * hardest). The planner puts the rung the user is on into their week; when it
 * is outgrown, progression moves them to the next.
 */
export interface MilestoneLadder {
  id: string;
  /** Matched against the user's free text. */
  keywords: RegExp;
  pattern: MovementPattern;
  rungs: readonly string[];
}

export const MILESTONE_LADDERS: readonly MilestoneLadder[] = [
  {
    id: "handstand",
    keywords: /hand\s?stand/i,
    pattern: "push",
    rungs: ["push_04", "push_19"],
  },
  {
    id: "push_up",
    keywords: /push[\s-]?ups?|press[\s-]?ups?/i,
    pattern: "push",
    rungs: ["push_10", "push_02", "push_13", "push_01", "push_03", "push_08"],
  },
  {
    id: "pull_up",
    keywords: /pull[\s-]?ups?|chin[\s-]?ups?/i,
    pattern: "pull",
    rungs: ["pull_03", "pull_13", "pull_14", "pull_16", "pull_07", "pull_06"],
  },
  {
    id: "squat",
    keywords: /pistol|squat/i,
    pattern: "squat",
    rungs: ["legs_13", "legs_01", "legs_04", "legs_21", "legs_07"],
  },
  {
    id: "plank",
    keywords: /plank/i,
    pattern: "core",
    rungs: ["core_22", "core_01", "core_10"],
  },
  {
    id: "flexibility",
    keywords: /toes|touch|splits|flexib|hamstring|forward fold/i,
    pattern: "flexibility",
    rungs: ["flex_01", "flex_08"],
  },
  {
    id: "running",
    keywords: /\b\d+\s?k\b|run|jog|marathon|sprint/i,
    pattern: "cardio",
    rungs: ["cardio_08", "cardio_02", "cardio_05"],
  },
];

/** Every id this file names, for the integrity test. */
export function vocabularyIds(): string[] {
  return [
    ...HIGH_IMPACT,
    ...PLYOMETRIC,
    ...BALANCE,
    ...LYING_DOWN,
    ...LOCOMOTION,
    ...Object.values(WARMUP).flat(),
    ...Object.values(COOLDOWN).flat(),
    ...MILESTONE_LADDERS.flatMap((l) => l.rungs),
  ];
}
