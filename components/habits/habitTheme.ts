/**
 * Habit palette + icon set. Colors are deliberately more saturated than the
 * app's calm data-viz hues — each habit owns one vivid identity color for its
 * icon, checks and heatmap (the HabitKit look), while everything around them
 * stays in the Welliva twilight neutrals.
 */

export const HABIT_COLORS = [
  "#3FDD78", // green
  "#FF5D55", // red
  "#3E9BFF", // blue
  "#8B7CFF", // violet
  "#FFA13B", // orange
  "#2DD0B0", // teal
  "#FF6FA5", // pink
  "#F5C542", // yellow
  "#38C6ED", // cyan
  "#A8E05F", // lime
] as const;

/**
 * Ionicons glyphs offered in the picker — health/diet/fitness-leaning.
 *
 * KEEP THE COUNT A MULTIPLE OF SIX. The picker solves a six-column grid
 * (app/habit/new.tsx), so a set that isn't a whole number of rows leaves a
 * ragged last row — the exact thing that grid was rebuilt to fix. 36 = six rows.
 */
export const HABIT_ICONS = [
  "walk",
  "barbell",
  "bicycle",
  "fitness",
  // The sports row. A tracker that can only offer a dumbbell quietly tells
  // people it isn't for their Tuesday five-a-side.
  "football",
  "tennisball",
  "golf",
  "basketball",
  "water",
  "restaurant",
  "nutrition",
  "cafe",
  "bed",
  "moon",
  "book",
  "school",
  "medkit",
  "medical",
  "heart",
  "leaf",
  "sunny",
  "flame",
  "footsteps",
  "body",
  "musical-notes",
  "brush",
  "code-slash",
  "call",
  "people",
  "paw",
  "trash",
  "cash",
  "time",
  "checkmark-circle",
  "trophy",
  "sparkles",
] as const;
