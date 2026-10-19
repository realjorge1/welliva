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
 * Since the 2026-10-15 accuracy pass EVERY catalogued exercise is listed here
 * except the six whose own movement IS their pattern's shape (an overhead
 * press, a band pulldown, two squats, two Romanian deadlifts). The pattern
 * shapes are stand-ins, and the torso twist that started that pass was one: it
 * played the flexibility loop — a reach up into a forward fold — which is not a
 * twist. `__tests__/exerciseMotions.test.ts` holds the line.
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
  starJump: "cardio",
  fastFeet: "cardio",
  stepTouch: "cardio",
  toeTap: "cardio",
  squatThrust: "cardio",
  sprawl: "cardio",

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

  // Push
  lateralRaise: "push",
  kneePushup: "push",
  inclinePushup: "push",
  declinePushup: "push",
  pikePushup: "push",
  hinduPushup: "push",
  scapPushup: "push",
  spidermanPushup: "push",
  dip: "push",
  wallPushup: "push",
  handstandPushup: "push",
  chestPress: "push",

  // Pull
  pullApart: "pull",
  facePull: "pull",
  reverseFly: "pull",
  snowAngel: "pull",
  yRaise: "pull",
  pullUp: "pull",
  seatedRow: "pull",
  leanRow: "pull",
  invertedRow: "pull",

  // Legs
  hipAbduction: "squat",
  lateralLunge: "squat",
  cossackSquat: "squat",
  curtsyLunge: "squat",
  sumoSquat: "squat",
  singleLegBalance: "squat",
  gobletSquat: "squat",
  jumpSquat: "squat",
  squatPulse: "squat",
  deepSquat: "squat",
  singleCalfRaise: "squat",
  jumpLunge: "squat",
  splitSquat: "squat",
  stepUp: "squat",
  skaterSquat: "squat",
  pistolSquat: "squat",
  hamstringCurl: "squat",

  // Hinge
  singleLegBridge: "hinge",
  marchingBridge: "hinge",
  hipThrust: "hinge",
  nordicCurl: "hinge",
  singleLegRdl: "hinge",
  kbSwing: "hinge",
  goodMorning: "hinge",
  donkeyKick: "hinge",
  fireHydrant: "hinge",

  // Core
  sideCrunch: "core",
  crunch: "core",
  situp: "core",
  vUp: "core",
  toeTouch: "core",
  heelTap: "core",
  deadBug: "core",
  hollowHold: "core",
  hollowRock: "core",
  flutterKick: "core",
  reverseCrunch: "core",
  bicycleCrunch: "core",
  boatHold: "core",
  windshieldWiper: "core",
  forearmPlank: "core",
  kneePlank: "core",
  shoulderTap: "core",
  plankUpDown: "core",
  sidePlankDip: "core",

  // Flexibility
  torsoTwist: "flexibility",
  armCircles: "flexibility",
  neckRoll: "flexibility",
  doorwayStretch: "flexibility",
  cobra: "flexibility",
  figureFour: "flexibility",
  seatedFold: "flexibility",
  wheel: "flexibility",
  threadNeedle: "flexibility",
  downDog: "flexibility",
  pigeon: "flexibility",
  kneelingLunge: "flexibility",
  couchStretch: "flexibility",
  worldsGreatest: "flexibility",
  hamstringStretch: "flexibility",
  quadStretch: "flexibility",
  butterfly: "flexibility",
  ninetyNinety: "flexibility",
};

/**
 * Exercise id → the movement it actually performs.
 *
 * Absent ids play their pattern's shape, which is only right when that shape
 * IS the exercise: push_06 (the `push` overhead press), pull_15 (the `pull`
 * band pulldown), legs_01 and legs_13 (`squat`), hinge_04 and hinge_11
 * (`hinge`, a Romanian deadlift).
 */
export const EXERCISE_MOTIONS: Record<string, FigureMotion> = {
  /* ── Push ───────────────────────────────────────────────────────────── */
  push_01: "pushup", // Push-ups
  push_02: "inclinePushup", // Incline Push-ups
  push_03: "pushup", // Diamond Push-ups
  push_04: "pikePushup", // Pike Push-ups
  push_05: "declinePushup", // Decline Push-ups
  push_07: "chestPress", // Dumbbell Chest Press
  push_08: "pushup", // Archer Push-ups
  push_09: "dip", // Tricep Dips (chair)
  push_10: "wallPushup", // Wall Push-ups
  push_11: "lateralRaise", // Dumbbell Lateral Raises
  push_12: "pushup", // Wide Push-ups
  push_13: "kneePushup", // Kneeling Push-ups
  push_14: "scapPushup", // Scapular Push-ups
  push_15: "spidermanPushup", // Spiderman Push-ups
  push_16: "pushup", // Staggered Push-ups
  push_17: "hinduPushup", // Hindu Push-ups
  push_18: "pushup", // Pseudo Planche Push-ups
  push_19: "handstandPushup", // Wall Handstand Push-ups

  /* ── Pull ───────────────────────────────────────────────────────────── */
  pull_01: "superman", // Superman Hold
  pull_02: "snowAngel", // Reverse Snow Angels
  pull_03: "leanRow", // Doorframe Rows
  pull_04: "row", // Dumbbell Rows
  pull_05: "pullApart", // Resistance Band Pull-apart
  pull_06: "pullUp", // Pull-ups
  pull_07: "pullUp", // Chin-ups
  pull_08: "seatedRow", // Resistance Band Rows
  pull_09: "yRaise", // Prone Y-T Raises
  pull_10: "curl", // Dumbbell Bicep Curls
  pull_11: "reverseFly", // Dumbbell Reverse Fly
  pull_12: "facePull", // Band Face Pulls
  pull_13: "leanRow", // Towel Rows
  pull_14: "invertedRow", // Inverted Rows
  pull_16: "pullUp", // Negative Pull-ups
  pull_17: "pullUp", // Commando Pull-ups
  pull_18: "pullUp", // Archer Pull-ups

  /* ── Legs ───────────────────────────────────────────────────────────── */
  legs_02: "lunge", // Lunges
  legs_03: "wallSit", // Wall Sit
  legs_04: "splitSquat", // Bulgarian Split Squats
  legs_05: "jumpSquat", // Jump Squats
  legs_06: "gobletSquat", // Goblet Squats
  legs_07: "pistolSquat", // Pistol Squats
  legs_08: "lunge", // Reverse Lunges
  legs_09: "lateralLunge", // Lateral Lunges
  legs_10: "calfRaise", // Calf Raises
  legs_11: "stepUp", // Step-ups
  legs_12: "sumoSquat", // Sumo Squats
  legs_14: "singleLegBalance", // Single-Leg Balance Hold
  legs_15: "lunge", // Walking Lunges
  legs_16: "curtsyLunge", // Curtsy Lunges
  legs_17: "cossackSquat", // Cossack Squats
  legs_18: "jumpLunge", // Jumping Lunges
  legs_19: "squatPulse", // Squat Pulses
  legs_20: "singleCalfRaise", // Single-Leg Calf Raises
  legs_21: "skaterSquat", // Skater Squats
  legs_22: "skaterSquat", // Shrimp Squats
  legs_23: "hipAbduction", // Standing Hip Abduction
  legs_24: "hamstringCurl", // Standing Hamstring Curl

  /* ── Hinge ──────────────────────────────────────────────────────────── */
  hinge_01: "gluteBridge", // Glute Bridges
  hinge_02: "singleLegBridge", // Single-Leg Glute Bridge
  hinge_03: "goodMorning", // Good Mornings (bodyweight)
  hinge_05: "kbSwing", // Kettlebell Swings
  hinge_06: "singleLegRdl", // Single-Leg Romanian Deadlift
  hinge_07: "donkeyKick", // Donkey Kicks
  hinge_08: "fireHydrant", // Fire Hydrants
  hinge_09: "nordicCurl", // Nordic Hamstring Curl
  hinge_10: "hipThrust", // Hip Thrust
  hinge_12: "marchingBridge", // Marching Glute Bridge

  /* ── Core ───────────────────────────────────────────────────────────── */
  core_01: "forearmPlank", // Plank (forearm)
  core_02: "crunch", // Crunches
  core_03: "deadBug", // Dead Bug
  core_04: "bicycleCrunch", // Bicycle Crunches
  core_05: "russianTwist", // Russian Twists
  core_06: "legRaise", // Leg Raises
  core_07: "mountainClimber", // Mountain Climbers
  core_08: "sidePlank", // Side Plank
  core_09: "birdDog", // Bird Dog
  core_10: "hollowHold", // Hollow Body Hold
  core_11: "flutterKick", // Flutter Kicks
  core_12: "shoulderTap", // Plank Shoulder Taps
  core_13: "plankUpDown", // Plank Up-Downs
  core_14: "reverseCrunch", // Reverse Crunches
  core_15: "situp", // Sit-ups
  core_16: "vUp", // V-Ups
  core_17: "toeTouch", // Toe Touches
  core_18: "boatHold", // Boat Pose Hold
  core_19: "windshieldWiper", // Windshield Wipers
  core_20: "hollowRock", // Hollow Body Rocks
  core_21: "sidePlankDip", // Side Plank Hip Dips
  core_22: "kneePlank", // Knee Plank
  core_23: "heelTap", // Heel Taps
  core_24: "sideCrunch", // Standing Side Crunch

  /* ── Cardio ─────────────────────────────────────────────────────────── */
  cardio_01: "jumpingJack", // Jumping Jacks
  cardio_02: "highKnee", // High Knees
  cardio_03: "buttKick", // Butt Kicks
  cardio_04: "burpee", // Burpees
  cardio_05: "jumpRope", // Jump Rope (no rope)
  cardio_06: "lateralShuffle", // Lateral Shuffles
  cardio_07: "skater", // Skaters
  cardio_08: "march", // March in Place
  cardio_09: "boxing", // Shadow Boxing
  cardio_10: "starJump", // Star Jumps
  cardio_11: "bearCrawl", // Bear Crawl
  cardio_12: "inchworm", // Inchworms
  cardio_13: "fastFeet", // Fast Feet
  cardio_14: "squatThrust", // Squat Thrusts
  cardio_15: "mountainClimber", // Cross-Body Mountain Climbers
  cardio_16: "plankJack", // Plank Jacks
  cardio_17: "tuckJump", // Tuck Jumps
  cardio_18: "broadJump", // Broad Jumps
  cardio_19: "burpee", // Burpee Tuck Jumps
  cardio_20: "sprawl", // Sprawls
  cardio_21: "stepTouch", // Step Touch
  cardio_22: "toeTap", // Toe Taps

  /* ── Flexibility ────────────────────────────────────────────────────── */
  flex_01: "hamstringStretch", // Standing Hamstring Stretch
  flex_02: "kneelingLunge", // Hip Flexor Stretch
  flex_03: "catCow", // Cat-Cow Stretch
  flex_04: "childsPose", // Child's Pose
  flex_05: "worldsGreatest", // World's Greatest Stretch
  flex_06: "cobra", // Cobra Stretch
  flex_07: "figureFour", // Figure-4 Stretch
  flex_08: "seatedFold", // Seated Forward Fold
  flex_09: "quadStretch", // Standing Quad Stretch
  flex_10: "downDog", // Downward Dog
  flex_11: "threadNeedle", // Thread the Needle
  flex_12: "butterfly", // Butterfly Stretch
  flex_13: "armCircles", // Arm Circles
  flex_14: "torsoTwist", // Standing Torso Twists
  flex_15: "doorwayStretch", // Doorway Chest Stretch
  flex_16: "pigeon", // Pigeon Pose
  flex_17: "deepSquat", // Deep Squat Hold
  flex_18: "couchStretch", // Couch Stretch
  flex_19: "ninetyNinety", // 90/90 Hip Stretch
  flex_20: "wheel", // Full Bridge (Wheel)
  flex_21: "neckRoll", // Neck Rolls
};
