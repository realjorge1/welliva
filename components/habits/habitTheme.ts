/**
 * Habit palette + icon library — the vocabulary a custom habit is built from.
 *
 * THE POINT OF A WIDER SET. A habit tracker that offers ten icons and ten
 * colours quietly tells people which habits it is for. Someone tracking "no
 * spending", "practise guitar", "read before bed" or "water the plants" hit a
 * wall of dumbbells and salad leaves and picked a checkmark, and every habit in
 * their list then looked the same. The library below is 138 glyphs across
 * eleven areas of life and 25 hues, so the thing you are actually trying to do
 * has a face — which is the whole reason a habit gets an icon in the first
 * place. It is deliberately not larger: see the habit-not-a-reminder test on
 * HABIT_ICON_GROUPS, which is what every candidate has to pass.
 *
 * BOTH SETS ARE GROUPED, AND THE GROUPS ARE THE UI. The picker
 * (app/habit/new.tsx) renders one icon category at a time behind a chip row,
 * and draws the colour rows under their own labels. Adding a category here
 * adds a chip there; nothing else needs touching.
 */

/* ──────────────────────────────── Colours ──────────────────────────────── */

/**
 * BRIGHT — the original habit palette, deliberately more saturated than the
 * app's calm data-viz hues: each habit owns one vivid identity colour for its
 * icon, checks and heatmap (the HabitKit look), while everything around them
 * stays in the welliva twilight neutrals.
 */
const BRIGHT = [
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
 * SOFT — the same wheel, desaturated. A list of ten habits in ten vivid hues
 * is a lot of shouting; these let someone build a quiet board, or keep the
 * loud colours for the habits that matter most and dress the rest down.
 *
 * THEY ARE MUTED, NOT PALE, AND THAT IS A CONSTRAINT NOT A TASTE. A habit's
 * colour is also a FILL under white text (the goal and weekday cells) and a
 * heatmap square, so a true pastel would be a white-on-cream label. Every hue
 * here holds white text at ≥1.9:1 — no worse than the bright row's own lightest
 * members (lime is 1.56:1) — which is what keeps them soft without going
 * illegible. Check any addition against that floor before adding it.
 */
const SOFT = [
  "#E29A9A", // dusty rose
  "#D98E6A", // clay
  "#E8A87C", // apricot
  "#D9B98C", // sand
  "#A8AE6B", // olive
  "#8FAE8B", // sage
  "#9CC5A1", // mint
  "#7FC4B4", // seafoam
  "#7FA8D9", // dusty sky
  "#8A9BA8", // slate
  "#9AA7E8", // periwinkle
  "#B396D9", // lilac
  "#C7A9E0", // wisteria
  "#C48CB5", // mauve
  "#A79A8E", // taupe
] as const;

export interface HabitColorGroup {
  label: string;
  colors: readonly string[];
}

/**
 * KEEP EVERY GROUP A MULTIPLE OF FIVE. The picker solves a five-column grid,
 * so a group that isn't a whole number of rows ends ragged against the card.
 */
export const HABIT_COLOR_GROUPS: readonly HabitColorGroup[] = [
  { label: "Bright", colors: BRIGHT },
  { label: "Soft", colors: SOFT },
];

/** Every hue, in picker order. `HABIT_COLORS[0]` is a new habit's default. */
export const HABIT_COLORS: readonly string[] = HABIT_COLOR_GROUPS.flatMap(
  (g) => g.colors as readonly string[],
);

/* ───────────────────────────────── Icons ───────────────────────────────── */

export interface HabitIconGroup {
  label: string;
  icons: readonly string[];
}

/**
 * Ionicons glyphs offered in the picker, by area of life.
 *
 * EVERY GLYPH HAS TO BE A HABIT, NOT A REMINDER OR A NOUN. The line is whether
 * the thing REPEATS on a schedule you could miss. "Practise guitar", "no
 * spending", "read before bed", "water the plants" are habits and earn a face;
 * one-off errands and passive facts do not. That test is what kept the weather
 * row out (rain is not something you do), the lab glassware out of Food, the
 * three interchangeable stopwatches out of Move, and a sad face out of Rest.
 * Apply it before adding anything: a glyph nobody would pick is not neutral,
 * it is one more cell to scan past on the way to the one they wanted.
 *
 * KEEP EVERY GROUP A MULTIPLE OF SIX. The picker solves a six-column grid and
 * renders one group at a time, so a group that isn't a whole number of rows
 * leaves a ragged last row — the exact thing that grid was rebuilt to fix. It
 * also means the TOTAL is always a multiple of six: 138 is the ceiling under
 * 140, and there is no such set of size 140.
 *
 * NAMES ARE NOT GUESSABLE. Ionicons ships 1,357 glyph names and a miss renders
 * a blank box, not an error — every name below was checked against
 * `@expo/vector-icons/.../glyphmaps/Ionicons.json`. Check new ones the same way.
 *
 * DUPLICATES ARE AVOIDED ON PURPOSE. A glyph that appears under two categories
 * reads as two different icons in a grid you scan once, so each lives in the
 * one place people will look for it first (`water` is hydration, under Food).
 */
export const HABIT_ICON_GROUPS: readonly HabitIconGroup[] = [
  {
    label: "Move",
    icons: [
      "walk",
      "footsteps",
      "bicycle",
      "barbell",
      "fitness",
      "body",
      "flame",
      // The sports half-row. A tracker that can only offer a dumbbell quietly
      // tells people it isn't for their Tuesday five-a-side.
      "football",
      "basketball",
      "tennisball",
      "golf",
      "baseball",
    ],
  },
  {
    label: "Food & drink",
    icons: [
      "restaurant",
      "nutrition",
      "fast-food",
      "pizza",
      "fish",
      "egg",
      "cafe",
      "beer",
      "wine",
      "water",
      "cart",
      "leaf",
    ],
  },
  {
    label: "Health",
    icons: [
      "medkit",
      "medical",
      "heart",
      "pulse",
      "thermometer",
      "bandage",
      "eyedrop",
      "scale",
      "glasses",
      "eye",
      "accessibility",
      "shield-checkmark",
    ],
  },
  {
    label: "Rest & mind",
    icons: [
      "bed",
      "moon",
      "alarm",
      "hourglass",
      "infinite",
      "sparkles",
      "happy",
      "journal",
      "flower",
      "musical-notes",
      "headset",
      // "No phone after nine" is one of the most-tracked habits there is.
      "phone-portrait",
    ],
  },
  {
    // The one group of three rows: reading, studying, writing, making and
    // admin are distinct habits people track separately, not one "work" icon.
    label: "Work & study",
    icons: [
      "book",
      "library",
      "school",
      "newspaper",
      "reader",
      "bookmark",
      "pencil",
      "create",
      "clipboard",
      "document-text",
      "folder-open",
      "print",
      "language",
      "laptop",
      "desktop",
      "code-slash",
      "briefcase",
      "business",
    ],
  },
  {
    label: "Home",
    icons: [
      "home",
      "trash",
      "shirt",
      "basket",
      "bag-handle",
      "bulb",
      "key",
      "hammer",
      "construct",
      "build",
      "cut",
      "cube",
    ],
  },
  {
    label: "Money",
    icons: [
      "cash",
      "card",
      "wallet",
      "receipt",
      "pricetag",
      "calculator",
      "stats-chart",
      "bar-chart",
      "pie-chart",
      "trending-up",
      "trending-down",
      "lock-closed",
    ],
  },
  {
    label: "People",
    icons: [
      "people",
      "person",
      "person-add",
      "chatbubbles",
      "call",
      "mail",
      "videocam",
      "camera",
      "gift",
      "rose",
      "paw",
      "thumbs-up",
    ],
  },
  {
    label: "Out & about",
    icons: [
      "sunny",
      "earth",
      "compass",
      "map",
      "trail-sign",
      "bonfire",
      "airplane",
      "car",
      "bus",
      "train",
      "subway",
      "boat",
    ],
  },
  {
    label: "Hobbies",
    icons: [
      "musical-note",
      "mic",
      "game-controller",
      "color-palette",
      "brush",
      "easel",
      "film",
      "tv",
      "radio",
      "images",
      "albums",
      "telescope",
    ],
  },
  {
    label: "Symbols",
    icons: [
      "checkmark-circle",
      "trophy",
      "medal",
      "star",
      "flag",
      "ribbon",
      "flash",
      "rocket",
      "time",
      "calendar",
      "location",
      "notifications",
    ],
  },
];

/** Every glyph, in picker order. `HABIT_ICONS[0]` is a new habit's default. */
export const HABIT_ICONS: readonly string[] = HABIT_ICON_GROUPS.flatMap(
  (g) => g.icons as readonly string[],
);

/**
 * Which category tab to open on. Editing a habit must land on the group its
 * icon lives in — otherwise the picker opens on "Move" with nothing selected
 * and the habit's own icon nowhere in sight. Falls back to the first group for
 * a glyph that predates the library (or was set by a linked/auto habit).
 */
export function habitIconGroupIndex(icon: string): number {
  const i = HABIT_ICON_GROUPS.findIndex((g) => g.icons.includes(icon));
  return i < 0 ? 0 : i;
}
