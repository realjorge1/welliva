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

/** Ionicons glyphs offered in the picker — health/diet/fitness-leaning. */
export const HABIT_ICONS = [
  "walk",
  "barbell",
  "bicycle",
  "fitness",
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
] as const;
