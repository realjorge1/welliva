/**
 * EXERCISE → MOVEMENT MAP.
 *
 * The demonstration figure used to resolve straight to an exercise's
 * `movementPattern`, which meant 140 catalogued exercises shared 8 animations.
 * Butt kicks, high knees and jumping jacks all played the same loop — three
 * obviously different movements drawn identically, which reads as a broken app
 * rather than a stylised one.
 *
 * This is the precise rung above that fallback: an exercise id resolves to the
 * movement IT actually performs. Anything absent still falls back to its
 * pattern (see resolveFigureMotion), so an AI-invented move or a newly added
 * catalogue entry is never left without a demonstration — it just gets the
 * family shape until someone authors it.
 *
 * Pure data (types only, no runtime imports) so it can be read from anywhere,
 * including the fitness test suite.
 */
import type { BaseMotion, FigureMotion, SpecificMotion } from "./movementProfiles";

/**
 * Which pattern each authored movement belongs to.
 *
 * The specialised profiles are refinements, not new families: a push-up is
 * still a `push`. Anything that reasons about movement families (the legacy
 * side-profile library, tests, future analytics) collapses through this rather
 * than growing a parallel taxonomy.
 */
export const SPECIFIC_MOTION_FAMILY: Record<SpecificMotion, BaseMotion> = {
  idle: "neutral",

  // Cardio
  jumpingJack: "cardio",
  highKnee: "cardio",
  buttKick: "cardio",
  burpee: "cardio",
  jumpRope: "cardio",
  lateralShuffle: "cardio",
  skater: "cardio",
  march: "cardio",
  boxing: "cardio",
  bearCrawl: "cardio",
  inchworm: "cardio",
  mountainClimber: "cardio",
  tuckJump: "cardio",
  broadJump: "cardio",
  plankJack: "cardio",

  // Strength & floor work
  pushup: "push",
  lunge: "squat",
  plank: "core",
  gluteBridge: "hinge",
  legRaise: "core",
  calfRaise: "squat",
  row: "pull",
  curl: "pull",
  superman: "pull",
  sidePlank: "core",
  russianTwist: "core",
  wallSit: "squat",
  birdDog: "core",
  catCow: "flexibility",
  childsPose: "flexibility",
};

/**
 * Exercise id → the movement it actually performs.
 *
 * Only entries that would otherwise be drawn WRONG are listed. A crunch
 * resolving to the `core` profile is already a crunch, so it isn't here; a
 * push-up resolving to `push` was drawing an overhead press, so it is.
 */
export const EXERCISE_MOTIONS: Record<string, FigureMotion> = {
  /* ── Cardio: the family that shared one loop for all 22 moves ────────── */
  cardio_01: "jumpingJack", // Jumping Jacks
  cardio_02: "highKnee", // High Knees
  cardio_03: "buttKick", // Butt Kicks
  cardio_04: "burpee", // Burpees
  cardio_05: "jumpRope", // Jump Rope (no rope)
  cardio_06: "lateralShuffle", // Lateral Shuffles
  cardio_07: "skater", // Skaters
  cardio_08: "march", // March in Place
  cardio_09: "boxing", // Shadow Boxing
  cardio_10: "jumpingJack", // Star Jumps
  cardio_11: "bearCrawl", // Bear Crawl
  cardio_12: "inchworm", // Inchworms
  cardio_13: "highKnee", // Fast Feet
  cardio_14: "burpee", // Squat Thrusts
  cardio_15: "mountainClimber", // Cross-Body Mountain Climbers
  cardio_16: "plankJack", // Plank Jacks
  cardio_17: "tuckJump", // Tuck Jumps
  cardio_18: "broadJump", // Broad Jumps
  cardio_19: "burpee", // Burpee Tuck Jumps
  cardio_20: "burpee", // Sprawls
  cardio_21: "lateralShuffle", // Step Touch
  cardio_22: "march", // Toe Taps

  /* ── Push: `push` is an overhead press, so every actual push-up moved ── */
  push_01: "pushup", // Push-ups
  push_02: "pushup", // Incline Push-ups
  push_03: "pushup", // Diamond Push-ups
  push_04: "pushup", // Pike Push-ups
  push_05: "pushup", // Decline Push-ups
  push_07: "pushup", // Dumbbell Chest Press
  push_08: "pushup", // Archer Push-ups
  push_09: "pushup", // Tricep Dips (chair)
  push_10: "pushup", // Wall Push-ups
  push_12: "pushup", // Wide Push-ups
  push_13: "pushup", // Kneeling Push-ups
  push_14: "pushup", // Scapular Push-ups
  push_15: "pushup", // Spiderman Push-ups
  push_16: "pushup", // Staggered Push-ups
  push_17: "pushup", // Hindu Push-ups
  push_18: "pushup", // Pseudo Planche Push-ups

  /* ── Pull: rows and prone lifts are not pulldowns ────────────────────── */
  pull_01: "superman", // Superman Hold
  pull_02: "superman", // Reverse Snow Angels
  pull_03: "row", // Doorframe Rows
  pull_04: "row", // Dumbbell Rows
  pull_08: "row", // Resistance Band Rows
  pull_09: "superman", // Prone Y-T Raises
  pull_10: "curl", // Dumbbell Bicep Curls
  pull_11: "row", // Dumbbell Reverse Fly
  pull_12: "row", // Band Face Pulls
  pull_13: "row", // Towel Rows
  pull_14: "row", // Inverted Rows

  /* ── Legs: a lunge is a split stance, not a squat ────────────────────── */
  legs_02: "lunge", // Lunges
  legs_03: "wallSit", // Wall Sit
  legs_04: "lunge", // Bulgarian Split Squats
  legs_08: "lunge", // Reverse Lunges
  legs_09: "lunge", // Lateral Lunges
  legs_10: "calfRaise", // Calf Raises
  legs_11: "lunge", // Step-ups
  legs_15: "lunge", // Walking Lunges
  legs_16: "lunge", // Curtsy Lunges
  legs_18: "lunge", // Jumping Lunges
  legs_20: "calfRaise", // Single-Leg Calf Raises
  legs_21: "lunge", // Skater Squats
  legs_22: "lunge", // Shrimp Squats
  legs_24: "buttKick", // Standing Hamstring Curl

  /* ── Hinge: a bridge is supine, not a standing fold ──────────────────── */
  hinge_01: "gluteBridge", // Glute Bridges
  hinge_02: "gluteBridge", // Single-Leg Glute Bridge
  hinge_07: "birdDog", // Donkey Kicks
  hinge_08: "birdDog", // Fire Hydrants
  hinge_10: "gluteBridge", // Hip Thrust
  hinge_12: "gluteBridge", // Marching Glute Bridge

  /* ── Core: `core` is a knee tuck — planks and leg raises are not ─────── */
  core_01: "plank", // Plank
  core_03: "birdDog", // Dead Bug
  core_05: "russianTwist", // Russian Twists
  core_06: "legRaise", // Leg Raises
  core_07: "mountainClimber", // Mountain Climbers
  core_08: "sidePlank", // Side Plank
  core_09: "birdDog", // Bird Dog
  core_10: "legRaise", // Hollow Body Hold
  core_11: "legRaise", // Flutter Kicks
  core_12: "plank", // Plank Shoulder Taps
  core_13: "pushup", // Plank Up-Downs
  core_14: "legRaise", // Reverse Crunches
  core_18: "russianTwist", // Boat Pose Hold
  core_19: "russianTwist", // Windshield Wipers
  core_20: "legRaise", // Hollow Body Rocks
  core_21: "sidePlank", // Side Plank Hip Dips
  core_22: "plank", // Knee Plank

  /* ── Flexibility: the two everyone recognises on sight ───────────────── */
  flex_03: "catCow", // Cat-Cow Stretch
  flex_04: "childsPose", // Child's Pose
  flex_08: "childsPose", // Seated Forward Fold
  flex_20: "gluteBridge", // Bridge Pose
};
