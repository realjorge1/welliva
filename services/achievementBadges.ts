/**
 * BADGE FINISHES — what an unlocked achievement is actually made of.
 *
 * Every badge in the app used to be struck from the same metal. The grid tinted
 * each card by TIER, and the tiers are bronze/gold/platinum — so nearly the
 * whole trophy case came out one shade of orange, and the detail medallion
 * forced gold onto all forty-seven regardless. Forty-seven identical orange
 * discs is not a collection; it's a list with an icon column.
 *
 * A finish is a MATERIAL: a three-stop ramp (a lit edge, a body, a shadow —
 * which is what makes a disc read as struck rather than painted), the rim it
 * is cast in, the ink its glyph is cut in, and the light it throws. Copper,
 * steel, gold, ice, amethyst, emerald, sapphire, ruby, ember, jade, rose,
 * obsidian, brass, verdant, indigo, coral, mahogany, citrine — chosen per
 * achievement, so what you earned is recognisable across the room and two
 * badges side by side are never the same object.
 *
 * LOCKED BADGES DO NOT USE ANY OF THIS. An unearned trophy stays bare — the
 * material is the prize, and showing it before it's won gives the whole thing
 * away. `lockedFinish` is what the grid draws until then.
 *
 * Pure data + two lookups. No React, no theme: a finish looks the same in light
 * and dark mode on purpose, exactly as a real medal does.
 */

import type { AchievementDef, AchievementTier } from "./AchievementService";

export interface BadgeFinish {
  /** The material's name. Not shown — it is what the badge IS. */
  material: string;
  /** Lit edge → body → shadow. Three stops, because two is paint. */
  ramp: readonly [string, string, string];
  /** The single colour that stands for the badge away from the medallion. */
  accent: string;
  /** The glyph cut into the lit face. Dark on bright metal, light on deep. */
  ink: string;
  /** The light the badge throws — halo, sparks, confetti. */
  glow: string;
}

const finish = (
  material: string,
  light: string,
  body: string,
  deep: string,
  ink: string,
  accent = body,
): BadgeFinish => ({
  material,
  ramp: [light, body, deep],
  accent,
  ink,
  glow: body,
});

/**
 * THE MATERIALS.
 *
 * Ink is chosen against the LIT face, not against the app: a glyph on bright
 * gold has to be dark or it turns to mush, and a glyph on obsidian has to be
 * pale for the same reason in the other direction.
 */
export const MATERIALS = {
  copper: finish("Copper", "#F3C9A2", "#C67C42", "#7A3F16", "#2A1206"),
  mahogany: finish("Mahogany", "#E8CBA9", "#A0703F", "#4E2C10", "#FBF1E6"),
  brass: finish("Brass", "#F8E4AC", "#C9A227", "#77570A", "#241A02"),
  steel: finish("Steel", "#F2F6FA", "#AEB9C4", "#68757F", "#1C222A"),
  gold: finish("Gold", "#FBE7A8", "#E9C16B", "#A8761F", "#1A1206"),
  ice: finish("Ice", "#E4F5FF", "#8FC9EE", "#3B7EA8", "#082334"),
  amethyst: finish("Amethyst", "#EBD8FF", "#B57BE0", "#66309C", "#1B0A2C"),
  emerald: finish("Emerald", "#CBF4DA", "#42C489", "#12704A", "#042415"),
  jade: finish("Jade", "#D2F3EF", "#46BFAE", "#0E655C", "#032220"),
  verdant: finish("Verdant", "#EAF4BE", "#A6C049", "#556A11", "#1A2004"),
  sapphire: finish("Sapphire", "#D3E3FF", "#5B8DEF", "#22458E", "#F2F6FF"),
  indigo: finish("Indigo", "#DEDDFF", "#7B78E8", "#343093", "#F3F2FF"),
  aqua: finish("Aqua", "#D5F1FF", "#3FB6E0", "#0D5F7C", "#032331"),
  ruby: finish("Ruby", "#FFD2D8", "#EF5B72", "#8C1B31", "#FFF0F2"),
  coral: finish("Coral", "#FFE0CE", "#FF7A55", "#A63317", "#2E0C03"),
  ember: finish("Ember", "#FFDFAF", "#FF8A3D", "#AC3F0B", "#2B0D01"),
  rose: finish("Rose", "#FFDCE9", "#F177A8", "#93224D", "#FFF2F7"),
  citrine: finish("Citrine", "#FFF3C8", "#F5C842", "#A17205", "#2A1D01"),
  obsidian: finish("Obsidian", "#AEB8C8", "#4B5566", "#171B23", "#EAF0FA"),
} as const satisfies Record<string, BadgeFinish>;

export type MaterialName = keyof typeof MATERIALS;

/**
 * WHICH MATERIAL EACH TROPHY IS STRUCK IN.
 *
 * Read down a category and the material climbs the way the achievement does —
 * copper and verdant at the bottom, ice and amethyst and obsidian at the
 * summit — but the hue is chosen for the BADGE, not for the tier: hydration is
 * water-coloured all the way up, nutrition grows, dawn badges are lit like
 * sunrise. That is the whole point: two golds in a row would be a spreadsheet.
 */
const BADGE_MATERIAL: Record<string, MaterialName> = {
  // ── Consistency ──
  first_day: "verdant", // a first sprout
  streak_3: "ember",
  streak_7: "coral",
  streak_14: "ruby",
  streak_30: "gold",
  streak_60: "steel", // iron will
  streak_100: "ice",
  streak_180: "indigo",
  streak_365: "amethyst", // mythic
  days_10: "jade",
  days_50: "copper",
  days_100: "sapphire",
  days_365: "ice",
  best_streak_50: "brass",
  days_730: "obsidian", // mythic

  // ── Training ──
  workout_1: "copper",
  workout_10: "steel",
  workout_50: "gold",
  workout_100: "ice",
  workout_250: "sapphire",
  workout_500: "ruby", // mythic
  perfect_workout: "rose",
  early_bird: "citrine", // sunrise
  early_25: "ember",
  reps_500: "aqua",
  reps_5000: "brass",
  reps_25000: "indigo",
  reps_100000: "obsidian", // mythic
  hours_10: "steel",
  hours_50: "brass",
  hours_100: "amethyst",
  weekend_10: "coral",
  weekend_50: "gold",
  weekdays_7: "rose",
  night_10: "obsidian", // trained after dark

  // ── Nutrition ──
  meals_50: "mahogany",
  meals_250: "emerald",
  meals_500: "jade",
  meals_1500: "amethyst", // mythic
  perfect_day: "verdant",
  perfect_7: "citrine",
  perfect_30: "gold",
  protein_7: "coral",
  protein_30: "ruby",
  protein_100: "obsidian",
  perfect_100: "citrine",

  // ── Hydration ── water all the way up, deepening as it goes.
  hydrated_1: "aqua",
  hydrated_14: "ice",
  hydrated_50: "sapphire",
  hydrated_100: "indigo",
  hydrated_365: "amethyst", // mythic

  // ── The journey ── calendar reach, and the comeback.
  weeks_4: "verdant",
  consistent_4: "jade",
  months_3: "citrine",
  comeback_1: "ember",
  months_6: "coral",
  consistent_12: "emerald",
  comeback_3: "ruby",
  months_12: "sapphire",
  consistent_26: "ice",
  weeks_52: "indigo",

  // ── Body / progress ──
  weigh_1: "steel",
  weigh_10: "jade",
  weigh_50: "emerald",
  weigh_200: "obsidian", // mythic
  span_180: "jade",
  span_365: "sapphire",
};

/** Last resort for a badge added without a material — never a wrong colour. */
const TIER_MATERIAL: Record<AchievementTier, MaterialName> = {
  bronze: "copper",
  silver: "steel",
  gold: "gold",
  platinum: "ice",
  mythic: "amethyst",
};

/** The material an achievement is struck in. */
export function badgeFinish(def: Pick<AchievementDef, "id" | "tier">): BadgeFinish {
  return MATERIALS[BADGE_MATERIAL[def.id] ?? TIER_MATERIAL[def.tier]];
}

/**
 * The bare badge — what an achievement looks like before it is earned.
 *
 * Deliberately NOT a dimmed version of the real finish: a grey cast reads as
 * "there is a colour here you can't see yet", which is exactly the reveal the
 * unlock is for. Takes the surface's own muted tone so it disappears into the
 * card.
 */
export function lockedFinish(muted: string, faint: string): BadgeFinish {
  return {
    material: "Unstruck",
    ramp: [faint, faint, faint],
    accent: muted,
    ink: muted,
    glow: muted,
  };
}

/**
 * The confetti/spark palette for one badge: its own three stops plus a little
 * white foil, so a burst reads as that material catching the light rather than
 * as a bag of party colours.
 */
export function badgePalette(f: BadgeFinish): string[] {
  return [f.ramp[0], f.ramp[1], f.ramp[1], f.ramp[2], "#FFFFFF"];
}

/* ── Deriving a finish where there isn't a badge ─────────────────────────── */

/** #RGB / #RRGGBB → [r,g,b]. Anything unparseable comes back mid-grey. */
function toRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length < 6) return [128, 128, 128];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const hex2 = (n: number) => clamp255(n).toString(16).padStart(2, "0");

/** Mix toward white (t > 0) or black (t < 0). */
function shift(hex: string, t: number): string {
  const [r, g, b] = toRgb(hex);
  const to = t >= 0 ? 255 : 0;
  const k = Math.abs(t);
  return `#${hex2(r + (to - r) * k)}${hex2(g + (to - g) * k)}${hex2(b + (to - b) * k)}`;
}

/** Perceived lightness 0–1, for choosing ink that can actually be read. */
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * A struck finish built from ONE colour — for the celebrations that aren't
 * achievements (a chapter, a coach-noticed moment), which carry a tone rather
 * than a material. Same three-stop shape, so the medallion is the same object
 * whatever fired it.
 */
export function finishFromAccent(accent: string): BadgeFinish {
  return {
    material: "Accent",
    ramp: [shift(accent, 0.55), accent, shift(accent, -0.42)],
    accent,
    // Judged against the BODY stop, which is what sits behind a centred glyph
    // — the lit edge only ever touches one corner of the disc.
    ink: luminance(accent) > 0.58 ? "#141414" : "#FFFFFF",
    glow: accent,
  };
}
