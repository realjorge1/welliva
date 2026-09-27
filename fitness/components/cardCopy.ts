/**
 * The words on Explore's workout and exercise cards.
 *
 * Pure (no React Native), so the wording is unit-tested in node and both cards
 * say the same thing the same way — one card's "No equipment" and the other's
 * "None" is exactly the drift two local helpers produce.
 */

import type { Difficulty } from "@/models/exercise";
import type { MovementPattern } from "@/models/workout";
import type { ArtHue, WorkoutStyle } from "../types";

export const LEVEL_LABEL: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/** How many of the three level bars a difficulty fills. */
export const LEVEL_RANK: Record<Difficulty, 1 | 2 | 3> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

export const STYLE_LABEL: Record<WorkoutStyle, string> = {
  strength: "Strength",
  hiit: "HIIT",
  cardio: "Cardio",
  core: "Core",
  endurance: "Endurance",
  power: "Power",
  mobility: "Mobility",
  recovery: "Recovery",
};

/** The Exercises filter calls the squat family "Legs"; the card agrees. */
export const PATTERN_LABEL: Record<MovementPattern, string> = {
  push: "Push",
  pull: "Pull",
  squat: "Legs",
  hinge: "Hinge",
  core: "Core",
  cardio: "Cardio",
  flexibility: "Flexibility",
};

/** Each movement family's signature hue — its figure, eyebrow and tint. */
export const PATTERN_HUE: Record<MovementPattern, ArtHue> = {
  push: "ember",
  pull: "sky",
  squat: "violet",
  hinge: "gold",
  core: "teal",
  cardio: "rose",
  flexibility: "forest",
};

const EQUIPMENT_LABEL: Record<string, string> = {
  dumbbells: "Dumbbells",
  resistance_bands: "Resistance bands",
  pull_up_bar: "Pull-up bar",
  bench: "Bench",
  kettlebell: "Kettlebell",
};

function equipmentName(id: string): string {
  const known = EQUIPMENT_LABEL[id];
  if (known) return known;
  const words = id.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * What a session needs, in the fewest words that still answer "can I do this
 * here?": nothing → "Bodyweight", one item → its name, two → both, more → the
 * first and a count, so the line never wraps.
 */
export function equipmentLabel(items: readonly string[]): string {
  const real = items.filter((i) => i && i !== "none");
  if (real.length === 0) return "Bodyweight";
  const [first, second] = real.map(equipmentName);
  if (real.length === 1) return first;
  if (real.length === 2) return `${first} + ${second.toLowerCase()}`;
  return `${first} +${real.length - 1}`;
}
