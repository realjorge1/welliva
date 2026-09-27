/**
 * EXERCISE FAMILIES — what counts as "the same movement" for the question
 * "would this feel new tomorrow?".
 *
 * ── WHY A HAND-WRITTEN TABLE ────────────────────────────────────────────────
 * The catalog already carries two groupings and neither answers this question:
 *
 *   · `movementPattern` has seven values. Anyone who trains has done a push, a
 *     pull and a squat in their first week, so a "new pattern" essentially
 *     never happens — novelty at that level is silence.
 *   · The demo figure's motion map (fitness/animation/exerciseMotions.ts) says
 *     how a move is DRAWN. Tricep dips and the dumbbell chest press are drawn
 *     as push-ups; they do not feel like push-ups the next morning.
 *
 * A family here is a set of variants that load the same tissue the same way,
 * so the first one teaches the body what the rest will ask. Incline, diamond
 * and decline push-ups are one family; a Nordic curl is its own, because
 * nothing else in the catalog loads a hamstring eccentrically like it, and it
 * is exactly the one that leaves someone walking stiffly on day two.
 *
 * Every catalog id must appear here — a test holds that, so an exercise added
 * to the catalog without a family fails the suite rather than quietly becoming
 * its own family.
 *
 * Pure data. No imports at runtime, so it is safe to read from anywhere.
 */

export const EXERCISE_FAMILY: Readonly<Record<string, string>> = {
  // ── Push ──
  push_01: "push-up", // Push-ups
  push_02: "push-up", // Incline Push-ups
  push_03: "push-up", // Diamond Push-ups
  push_04: "overhead-press", // Pike Push-ups — the shoulders take it, not the chest
  push_05: "push-up", // Decline Push-ups
  push_06: "overhead-press", // Dumbbell Shoulder Press
  push_07: "chest-press", // Dumbbell Chest Press
  push_08: "push-up", // Archer Push-ups
  push_09: "dip", // Tricep Dips (chair)
  push_10: "push-up", // Wall Push-ups
  push_11: "lateral-raise", // Dumbbell Lateral Raises
  push_12: "push-up", // Wide Push-ups
  push_13: "push-up", // Kneeling Push-ups
  push_14: "push-up", // Scapular Push-ups
  push_15: "push-up", // Spiderman Push-ups
  push_16: "push-up", // Staggered Push-ups
  push_17: "push-up", // Hindu Push-ups
  push_18: "push-up", // Pseudo Planche Push-ups
  push_19: "overhead-press", // Wall Handstand Push-ups

  // ── Pull ──
  pull_01: "prone-raise", // Superman Hold
  pull_02: "prone-raise", // Reverse Snow Angels
  pull_03: "row", // Doorframe Rows
  pull_04: "row", // Dumbbell Rows
  pull_05: "rear-delt", // Resistance Band Pull-apart
  pull_06: "pull-up", // Pull-ups
  pull_07: "pull-up", // Chin-ups
  pull_08: "row", // Resistance Band Rows
  pull_09: "prone-raise", // Prone Y-T Raises
  pull_10: "biceps-curl", // Dumbbell Bicep Curls
  pull_11: "rear-delt", // Dumbbell Reverse Fly
  pull_12: "rear-delt", // Band Face Pulls
  pull_13: "row", // Towel Rows
  pull_14: "row", // Inverted Rows
  pull_15: "lat-pulldown", // Resistance Band Lat Pulldown
  pull_16: "pull-up", // Negative Pull-ups
  pull_17: "pull-up", // Commando Pull-ups
  pull_18: "pull-up", // Archer Pull-ups

  // ── Legs (squat pattern) ──
  legs_01: "squat", // Bodyweight Squats
  legs_02: "lunge", // Lunges
  legs_03: "wall-sit", // Wall Sit
  legs_04: "split-squat", // Bulgarian Split Squats
  legs_05: "jump-squat", // Jump Squats — the landing is the new load
  legs_06: "squat", // Goblet Squats
  legs_07: "single-leg-squat", // Pistol Squats
  legs_08: "lunge", // Reverse Lunges
  legs_09: "lateral-lunge", // Lateral Lunges — adductors, a different plane
  legs_10: "calf-raise", // Calf Raises
  legs_11: "step-up", // Step-ups
  legs_12: "squat", // Sumo Squats
  legs_13: "squat", // Chair Sit-to-Stand
  legs_14: "balance", // Single-Leg Balance Hold
  legs_15: "lunge", // Walking Lunges
  legs_16: "lunge", // Curtsy Lunges
  legs_17: "lateral-lunge", // Cossack Squats
  legs_18: "jump-lunge", // Jumping Lunges
  legs_19: "squat", // Squat Pulses
  legs_20: "calf-raise", // Single-Leg Calf Raises
  legs_21: "single-leg-squat", // Skater Squats
  legs_22: "single-leg-squat", // Shrimp Squats
  legs_23: "hip-abduction", // Standing Hip Abduction
  legs_24: "hamstring-curl", // Standing Hamstring Curl

  // ── Legs (hinge pattern) ──
  hinge_01: "glute-bridge", // Glute Bridges
  hinge_02: "glute-bridge", // Single-Leg Glute Bridge
  hinge_03: "good-morning", // Good Mornings (bodyweight)
  hinge_04: "romanian-deadlift", // Dumbbell Romanian Deadlifts
  hinge_05: "kettlebell-swing", // Kettlebell Swings
  hinge_06: "romanian-deadlift", // Single-Leg Romanian Deadlift
  hinge_07: "donkey-kick", // Donkey Kicks
  hinge_08: "hip-abduction", // Fire Hydrants
  hinge_09: "nordic-curl", // Nordic Hamstring Curl
  hinge_10: "glute-bridge", // Hip Thrust
  hinge_11: "romanian-deadlift", // B-Stance Romanian Deadlift
  hinge_12: "glute-bridge", // Marching Glute Bridge

  // ── Core ──
  core_01: "plank", // Plank
  core_02: "crunch", // Crunches
  core_03: "dead-bug", // Dead Bug
  core_04: "crunch", // Bicycle Crunches
  core_05: "russian-twist", // Russian Twists
  core_06: "leg-raise", // Leg Raises
  core_07: "mountain-climber", // Mountain Climbers
  core_08: "side-plank", // Side Plank
  core_09: "bird-dog", // Bird Dog
  core_10: "hollow-body", // Hollow Body Hold
  core_11: "leg-raise", // Flutter Kicks
  core_12: "plank", // Plank Shoulder Taps
  core_13: "plank", // Plank Up-Downs
  core_14: "crunch", // Reverse Crunches
  core_15: "crunch", // Sit-ups
  core_16: "hollow-body", // V-Ups
  core_17: "crunch", // Toe Touches
  core_18: "hollow-body", // Boat Pose Hold
  core_19: "leg-raise", // Windshield Wipers
  core_20: "hollow-body", // Hollow Body Rocks
  core_21: "side-plank", // Side Plank Hip Dips
  core_22: "plank", // Knee Plank
  core_23: "crunch", // Heel Taps
  core_24: "standing-crunch", // Standing Side Crunch

  // ── Cardio ──
  cardio_01: "jumping-jack", // Jumping Jacks
  cardio_02: "high-knees", // High Knees
  cardio_03: "butt-kick", // Butt Kicks
  cardio_04: "burpee", // Burpees
  cardio_05: "jump-rope", // Jump Rope (no rope)
  cardio_06: "lateral-shuffle", // Lateral Shuffles
  cardio_07: "skater", // Skaters
  cardio_08: "high-knees", // March in Place
  cardio_09: "shadow-boxing", // Shadow Boxing
  cardio_10: "jumping-jack", // Star Jumps
  cardio_11: "bear-crawl", // Bear Crawl
  cardio_12: "inchworm", // Inchworms
  cardio_13: "high-knees", // Fast Feet
  cardio_14: "burpee", // Squat Thrusts
  cardio_15: "mountain-climber", // Cross-Body Mountain Climbers
  cardio_16: "plank-jack", // Plank Jacks
  cardio_17: "tuck-jump", // Tuck Jumps
  cardio_18: "broad-jump", // Broad Jumps
  cardio_19: "burpee", // Burpee Tuck Jumps
  cardio_20: "burpee", // Sprawls
  cardio_21: "lateral-shuffle", // Step Touch
  cardio_22: "toe-tap", // Toe Taps

  // ── Flexibility (never asked about; families still keep the ledger honest) ──
  flex_01: "hamstring-stretch", // Standing Hamstring Stretch
  flex_02: "hip-flexor-stretch", // Hip Flexor Stretch
  flex_03: "cat-cow", // Cat-Cow Stretch
  flex_04: "childs-pose", // Child's Pose
  flex_05: "worlds-greatest-stretch", // World's Greatest Stretch
  flex_06: "cobra", // Cobra Stretch
  flex_07: "glute-stretch", // Figure-4 Stretch
  flex_08: "hamstring-stretch", // Seated Forward Fold
  flex_09: "quad-stretch", // Standing Quad Stretch
  flex_10: "downward-dog", // Downward Dog
  flex_11: "thread-the-needle", // Thread the Needle
  flex_12: "butterfly-stretch", // Butterfly Stretch
  flex_13: "arm-circles", // Arm Circles
  flex_14: "torso-twist", // Standing Torso Twists
  flex_15: "chest-stretch", // Doorway Chest Stretch
  flex_16: "glute-stretch", // Pigeon Pose
  flex_17: "deep-squat-hold", // Deep Squat Hold
  flex_18: "hip-flexor-stretch", // Couch Stretch
  flex_19: "glute-stretch", // 90/90 Hip Stretch
  flex_20: "bridge-pose", // Bridge Pose
  flex_21: "neck-rolls", // Neck Rolls
};

/**
 * Families for a movement the catalog has never seen — an AI plan's
 * "Dumbbell Goblet Squat", "Tempo Push-Up" — matched on the words of its name.
 *
 * ORDER IS THE DESIGN: specific before general. "jump squat" must be tested
 * before "squat", "side plank" before "plank", "nordic" before "curl",
 * "burpee" before "tuck jump" (a burpee tuck jump is a burpee). A name that
 * matches nothing becomes its own family — never the movement pattern, which
 * is too coarse to mean anything (see the header).
 *
 * Tested against the table above: for the catalog's own names, these rules
 * land on the family the table gives, so the two cannot quietly disagree.
 */
export const FAMILY_RULES: readonly (readonly [RegExp, string])[] = [
  // Whole-body and floor moves whose names contain another family's word
  // ("side plank hip DIP", "plank JACK", "burpee TUCK JUMP", "deep SQUAT hold").
  [/\bnordic\b/, "nordic-curl"],
  [/\b(burpee|squat thrust|sprawl)\b/, "burpee"],
  [/\bside plank\b/, "side-plank"],
  [/\bplank jack\b/, "plank-jack"],
  [/\bmountain climber\b/, "mountain-climber"],
  [/\bdeep squat hold\b/, "deep-squat-hold"],
  [/\b(glute bridge|hip thrust)\b/, "glute-bridge"],
  [/\bstanding (side )?crunch\b/, "standing-crunch"],
  // Legs.
  [/\b(pistol|shrimp|skater squat)\b/, "single-leg-squat"],
  [/\b(bulgarian|split squat)\b/, "split-squat"],
  [/\b(jump(ing)? squat|squat jump)\b/, "jump-squat"],
  [/\b(jump(ing)? lunge|lunge jump|split jump)\b/, "jump-lunge"],
  [/\b(lateral lunge|side lunge|cossack)\b/, "lateral-lunge"],
  [/\blunge\b/, "lunge"],
  [/\bwall sit\b/, "wall-sit"],
  [/\b(abduction|fire hydrant|clamshell)\b/, "hip-abduction"],
  [/\bdonkey kick\b/, "donkey-kick"],
  [/\bcalf raise\b/, "calf-raise"],
  [/\bstep up\b/, "step-up"],
  // Upper body.
  [/\b(handstand|pike push up|overhead press|shoulder press|military press)\b/, "overhead-press"],
  [/\b(chest press|bench press|floor press)\b/, "chest-press"],
  [/\b(push up|press up)\b/, "push-up"],
  [/\bdip\b/, "dip"],
  [/\b(lateral raise|side raise)\b/, "lateral-raise"],
  [/\b(pull up|chin up)\b/, "pull-up"],
  [/\b(pulldown|pull down)\b/, "lat-pulldown"],
  [/\b(face pull|pull apart|reverse fly|rear delt)\b/, "rear-delt"],
  [/\b(superman|snow angel|prone)\b/, "prone-raise"],
  [/\brow\b/, "row"],
  // Hinge.
  [/\b(romanian|rdl|stiff leg)\b/, "romanian-deadlift"],
  [/\bdeadlift\b/, "deadlift"],
  [/\bgood morning\b/, "good-morning"],
  [/\bswing\b/, "kettlebell-swing"],
  [/\bhamstring curl\b/, "hamstring-curl"],
  [/\bcurl\b/, "biceps-curl"],
  // Core.
  [/\bplank\b/, "plank"],
  [/\b(hollow|v up|boat)\b/, "hollow-body"],
  [/\b(leg raise|flutter|windshield)\b/, "leg-raise"],
  [/\brussian twist\b/, "russian-twist"],
  [/\b(crunch|sit up|heel tap)\b/, "crunch"],
  [/\bdead bug\b/, "dead-bug"],
  [/\bbird dog\b/, "bird-dog"],
  // Cardio.
  [/\b(jumping jack|star jump)\b/, "jumping-jack"],
  [/\b(high knee|fast feet|march)\b/, "high-knees"],
  [/\bbutt kick\b/, "butt-kick"],
  [/\btuck jump\b/, "tuck-jump"],
  [/\bbroad jump\b/, "broad-jump"],
  [/\b(jump rope|skipping)\b/, "jump-rope"],
  [/\b(lateral shuffle|step touch)\b/, "lateral-shuffle"],
  [/\bskater\b/, "skater"],
  [/\bshadow box/, "shadow-boxing"],
  [/\bbear crawl\b/, "bear-crawl"],
  [/\binchworm\b/, "inchworm"],
  [/\btoe tap\b/, "toe-tap"],
  // Last: the bare word, once every compound above has had its turn.
  [/\bsquat\b/, "squat"],
];
