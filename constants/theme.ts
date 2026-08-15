/**
 * WELLIVA DESIGN SYSTEM
 * ──────────────────────────────────────────────────────────────────────────
 * A single source of truth for color, type, space, radius, elevation & motion.
 *
 * Principles
 *  1. Restraint — one confident brand (deep cyan-blue) + a small, fixed data-viz set.
 *     Every macro/metric maps to ONE hue, used identically on every screen.
 *  2. Depth through neutrals — layered surfaces + soft shadows, never harsh.
 *  3. Rhythm — all spacing/sizing lands on a 4pt grid; type follows one scale.
 *
 * Backwards-compat: every legacy `Colors[mode]` key is preserved so existing
 * screens keep compiling while they migrate to the new tokens.
 */

import { Platform, type TextStyle } from "react-native";

/* ────────────────────────────── Light mode kill-switch ───────────────────
 * Light mode is TEMPORARILY DISABLED — the app is locked to dark everywhere.
 * Nothing has been deleted: the full `Colors.light` palette, `lightGradient`,
 * `LightCard` and every `isDark ? … : …` branch stay exactly as they were.
 *
 * To re-enable light mode later:
 *   1. Flip this flag to `true`.
 *   2. Set `expo.userInterfaceStyle` back to "automatic" in app.json
 *      (needs a native rebuild to take effect).
 * That's it — the Settings → Appearance picker and system-scheme following
 * both come back on their own, and any theme a user had picked before the
 * lock is still stored and will be restored.
 */
export const LIGHT_MODE_ENABLED = false;

/** The scheme every consumer falls back to while light mode is disabled. */
export const FORCED_COLOR_SCHEME = "dark" as const;

/* ───────────────────────────── Brand & data-viz ──────────────────────────
 * Fixed semantic hues. Each metric owns exactly one color, app-wide.
 *
 * "Twilight" Calm system: a cool, serene teal brand on a deep indigo→teal
 * canvas, with a single warm accent (calories) for energy. Muted, restful,
 * dark-led — a wellbeing aesthetic, not a loud fitness one.
 */
export const Palette = {
  // Brand — a warm carrot orange (the light-mode app color). NOTE: the brand
  // now DIVERGES by theme — orange in light, gold-yellow in dark — so most UI
  // reads the theme-aware `colors.primary` / `colors.brandGradient` rather than
  // these raw values. These stay orange for the few fixed/neutral surfaces
  // (auth canvas, confetti) that aren't mode-toggled.
  brand: "#E67E22",
  brandStrong: "#C96A16",
  brandDeep: "#A85713",
  brandSoft: "#F2A15C",

  // Data-viz — one hue per metric, cool-leaning with one warm accent
  calories: "#F2A65A", // soft warm coral — the lone warm accent
  caloriesSoft: "#F6BC7E",
  protein: "#2DBE9F", // teal — distinct metric hue, kept apart from the cyan brand
  carbs: "#E6B860", // soft gold
  fat: "#8B93E6", // periwinkle
  water: "#5BB8E8", // serene sky
  waterSoft: "#83CDF1",

  // Status
  positive: "#34C7A4",
  warning: "#E6B860",
  danger: "#E8736B",
  gold: "#E9C16B",
} as const;

/* Gradient ramps used for the ambient app background + hero rings.
 * Dark is the primary experience: a true OLED black canvas that lifts to the
 * faintest teal vignette at the base — pure black, with just enough brand cast
 * to keep our identity. Light is a soft neutral-grey canvas (NOT pure white) so
 * the white content cards float and separate — a subtle top→bottom deepening
 * gives the page quiet life instead of a dead-flat fill. */
export const lightGradient = ["#F5F6F8", "#F1F2F5", "#EDEFF3", "#E9EBF0"] as const;
export const darkGradient = ["#000000", "#000000", "#000000", "#000000"] as const;

/* The brand gradient DIVERGES by theme:
 *   • light — a warm carrot-orange ramp around #E67E22.
 *   • dark  — a bright, sharp gold-yellow ramp (not high-intensity/neon).
 * Consumers read the theme-aware `colors.brandGradient`; these named ramps are
 * what the Colors light/dark blocks point at. `Gradients.brand` is kept as the
 * light ramp for the few fixed surfaces that still import it statically. */
export const brandGradientLight = ["#F08A38", "#E67E22", "#BF6011"] as const;
export const brandGradientDark = ["#F6CF54", "#EDB623", "#CE9914"] as const;

/* Brand & accent gradients for buttons, rings, hero surfaces. */
export const Gradients = {
  brand: brandGradientLight,
  // Fills deepened for real intensity — less pastel, more saturated, so a
  // filled ring/bar reads boldly (not washed) on the light canvas.
  calories: ["#FFA94D", "#F98A26"] as const,
  water: ["#54C1F2", "#1E90DB"] as const,
  carbs: ["#FBCB4C", "#E8A518"] as const,
  fat: ["#9B8FF6", "#6C5BE8"] as const,
  protein: ["#3DE0C4", "#10BB9B"] as const,
  heroDark: ["#0A1F23", "#0C2C30", "#0A3A38"] as const,
  heroLight: brandGradientLight,
} as const;

/* ──────────────────────────────── Colors ─────────────────────────────────
 * Semantic, theme-aware. New tokens up top; legacy aliases kept below.
 */
export type ColorScheme = "light" | "dark";

export interface ThemeColors {
  // Surfaces
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSunken: string;
  surfaceMuted: string;
  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  // Lines
  border: string;
  borderStrong: string;
  divider: string;
  /** Empty ring/bar track. Light: a dark charcoal so empty gauges read as bold
   *  dark outlines that fill with color. Dark: kept subtle (see components). */
  emptyTrack: string;
  // Brand
  primary: string;
  primaryStrong: string;
  onPrimary: string;
  primarySoft: string;
  /** Brand ramp — orange in light, gold-yellow in dark. */
  brandGradient: readonly [string, string, ...string[]];
  // Data-viz
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  water: string;
  // Status
  success: string;
  warning: string;
  error: string;
  gold: string;
  // Misc
  gradient: readonly [string, string, ...string[]];
  overlay: string;
  scrim: string;
  shadowColor: string;
  // Legacy aliases
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  headerText: string;
  secondaryText: string;
  cardBackground: string;
  cardBackgroundSecondary: string;
  cardBorder: string;
  primaryLight: string;
  secondary: string;
  secondaryLight: string;
  accent: string;
  accentLight: string;
  purple: string;
  purpleLight: string;
}

export const Colors: Record<ColorScheme, ThemeColors> = {
  light: {
    // ── Surfaces ──
    //  • Page background is a soft NEUTRAL GREY (not pure white) — see
    //    `lightGradient`. This lets the white content cards (LightCard below)
    //    float and separate, and makes every colored accent read more vividly
    //    than it did against maximum-white.
    //  • On-PAGE surface tokens back any chip/button/input/track that sits
    //    directly on the grey page: `surface`/`surfaceElevated` are white (they
    //    pop off the grey); `surfaceMuted`/`surfaceSunken` are recessed greys
    //    for tracks/insets that must read on BOTH the grey page and white cards.
    background: "#F1F2F5",
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",
    surfaceSunken: "#E3E5EA",
    surfaceMuted: "#EAECF0",

    // ── Text (neutral ink — no green/teal cast) ──
    text: "#16181C",
    textSecondary: "#5B616B",
    textTertiary: "#8A909A",
    textInverse: "#FFFFFF",

    // ── Lines (crisp neutral hairline — a touch deeper so white cards separate
    //    cleanly from the grey page) ──
    border: "#E1E4EA",
    borderStrong: "#D0D4DC",
    divider: "#E6E8EE",
    // Empty rings/bars are INVISIBLE — no track at all — so only the filled arc
    // (in its metric color) is ever drawn. The empty portion shows the surface
    // behind it.
    emptyTrack: "transparent",

    // ── Brand (carrot orange #E67E22) ──
    primary: "#E67E22",
    primaryStrong: "#C96A16",
    onPrimary: "#FFFFFF",
    primarySoft: "rgba(230,126,34,0.20)",
    brandGradient: brandGradientLight,

    // ── Data-viz (semantic) — deeper, more saturated than the shared Palette so
    //    macros/metrics read with real intensity on the light canvas. ──
    calories: "#EF9B4A",
    protein: "#15B394",
    carbs: "#DBA633",
    fat: "#6C77E0",
    water: "#33A6E4",

    // ── Status (punchier for clear at-a-glance signalling) ──
    success: "#1FB894",
    warning: "#E0A93C",
    error: "#E85A50",
    gold: Palette.gold,

    // ── Misc ──
    gradient: lightGradient,
    overlay: "rgba(18,20,24,0.45)",
    scrim: "rgba(18,20,24,0.04)",
    shadowColor: "#1A1D22",

    // ── Legacy aliases (do not remove until all screens migrate) ──
    tint: "#E67E22",
    icon: "#5B616B",
    tabIconDefault: "#9AA0A8",
    tabIconSelected: "#E67E22",
    headerText: "#16181C",
    secondaryText: "#5B616B",
    cardBackground: "#FFFFFF",
    cardBackgroundSecondary: "#F3F4F6",
    cardBorder: "#E1E4EA",
    primaryLight: "rgba(230,126,34,0.20)",
    secondary: "#DBA633",
    secondaryLight: "rgba(219,166,51,0.16)",
    accent: "#33A6E4",
    accentLight: "rgba(51,166,228,0.16)",
    purple: "#6C77E0",
    purpleLight: "rgba(108,119,224,0.16)",
  },
  dark: {
    // ── Surfaces (true OLED black canvas; cards lift just enough off pure
    //    black with a faint teal-petrol glass cast to read as distinct) ──
    background: "#000000",
    surface: "#0B1416",
    surfaceElevated: "#121F21",
    surfaceSunken: "#050B0C",
    surfaceMuted: "#0E191B",

    // ── Text (light with a faint cool-teal cast, restful) ──
    text: "#EAF4F1",
    textSecondary: "#9FB3AE",
    textTertiary: "#6E827D",
    textInverse: "#000000",

    // ── Lines (hairline, teal undertone — kept low so black stays pure) ──
    border: "#1A2A2C",
    borderStrong: "#243738",
    divider: "#152325",
    // Dark keeps its subtle per-metric track (rings/bars branch on isDark and
    // don't read this); value set for completeness only.
    emptyTrack: "#0B1416",

    // ── Brand (rich, sharp gold-yellow — the dark-mode app color) ──
    primary: "#EDB623",
    primaryStrong: "#D69F14",
    onPrimary: "#241C00",
    primarySoft: "rgba(237,182,35,0.14)",
    brandGradient: brandGradientDark,

    // ── Data-viz (semantic) ──
    calories: Palette.caloriesSoft,
    protein: "#4FD6B4",
    carbs: "#F0CC83",
    fat: "#A7AEEE",
    water: Palette.waterSoft,

    // ── Status ──
    success: "#4FD6B4",
    warning: "#F0CC83",
    error: "#F0918A",
    gold: Palette.gold,

    // ── Misc ──
    gradient: darkGradient,
    overlay: "rgba(2,12,14,0.6)",
    scrim: "rgba(255,255,255,0.04)",
    shadowColor: "#000000",

    // ── Legacy aliases ──
    tint: "#FFFFFF",
    icon: "#9FB3AE",
    tabIconDefault: "#6E827D",
    tabIconSelected: "#EDB623",
    headerText: "#EAF4F1",
    secondaryText: "#9FB3AE",
    cardBackground: "#0B1416",
    cardBackgroundSecondary: "#121F21",
    cardBorder: "#1A2A2C",
    primaryLight: "rgba(237,182,35,0.14)",
    secondary: "#F0CC83",
    secondaryLight: "rgba(240,204,131,0.14)",
    accent: Palette.waterSoft,
    accentLight: "rgba(131,205,241,0.14)",
    purple: "#A7AEEE",
    purpleLight: "rgba(167,174,238,0.14)",
  },
};

/* ───────────────────────────── Light-mode cards ──────────────────────────
 * In light mode, content cards are clean WHITE panels floating on the soft
 * grey page — the white/grey pair is what gives the UI depth (no color cast,
 * no inverted children; cards read dark-on-light exactly like the page). `base`
 * is the standard white card; `elevated` is ALSO white — it's used for
 * top-level "premium" cards (e.g. Gozlin's AI response cards) that must pop off
 * the grey canvas, so it can't be a recessed grey; the shared `border` (a touch
 * stronger than before) does the separating in the rare card-on-card case.
 */
export const LightCard = {
  base: "#FFFFFF",
  elevated: "#FFFFFF",
  border: "#E1E4EA",
} as const;

/* ──────────────────────────────── Spacing ────────────────────────────────
 * 4pt grid. Use these names, never raw numbers, in new code.
 */
export const Spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
  /** Standard horizontal screen gutter — thin edges so content runs near-edge-to-edge. */
  screen: 12,
} as const;

/* ──────────────────────────────── Radius ─────────────────────────────────*/
export const Radius = {
  xs: 5,
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 22,
  pill: 999,
} as const;

/* ─────────────────────────────── Typography ──────────────────────────────
 * One intentional scale. Negative tracking on large sizes = premium feel.
 */
export const Typography = {
  // Big type runs lighter + roomier for a calm, unhurried feel.
  displayLg: { fontSize: 34, lineHeight: 44, fontWeight: "700", letterSpacing: -0.4 },
  display: { fontSize: 28, lineHeight: 40, fontWeight: "700", letterSpacing: -0.4 },
  title: { fontSize: 22, lineHeight: 32, fontWeight: "700", letterSpacing: -0.3 },
  headline: { fontSize: 18, lineHeight: 26, fontWeight: "600", letterSpacing: -0.2 },
  bodyLg: { fontSize: 16, lineHeight: 26, fontWeight: "500", letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 24, fontWeight: "500", letterSpacing: 0 },
  callout: { fontSize: 14, lineHeight: 20, fontWeight: "600", letterSpacing: -0.1 },
  subhead: { fontSize: 13, lineHeight: 20, fontWeight: "500", letterSpacing: 0 },
  footnote: { fontSize: 12, lineHeight: 17, fontWeight: "500", letterSpacing: 0 },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: "600", letterSpacing: 0.6 },
  /** Tabular numerals for big metric readouts — stays bold for legibility. */
  metric: { fontSize: 32, lineHeight: 38, fontWeight: "700", letterSpacing: -0.6 },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof Typography;

/* ─────────────────────────────── Elevation ───────────────────────────────
 * Cross-platform shadow presets. Spread into a style object.
 */
type Elevation = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

/**
 * Flat, shadow-free aesthetic: depth comes from layered surfaces + hairline
 * borders, never drop shadows. Every preset is flat; the keys are kept so
 * callers (Card `elevation`, the nav, etc.) keep compiling and can be re-tuned
 * later from this single place.
 */
const FLAT: Elevation = {
  shadowColor: "transparent",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
};

export const Shadows: Record<"none" | "xs" | "sm" | "md" | "lg" | "xl", Elevation> = {
  none: FLAT,
  xs: FLAT,
  sm: FLAT,
  md: FLAT,
  lg: FLAT,
  xl: FLAT,
};

/* ──────────────────────────────── Motion ─────────────────────────────────
 * The single motion language. Every animation in the app derives its timing
 * from these tokens (via `components/motion`) — no screen invents its own
 * curves or durations.
 *
 *   fast   — micro feedback (a digit rolling, a chip state)
 *   base   — standard element changes (content swaps, reveals)
 *   slow   — screen/phase-level transitions
 *   hero   — one-off signature moments (rings drawing in, celebrations)
 *   breath — the calm ambient loop (breathing guide, resting pulses)
 */
export const Motion = {
  duration: { fast: 140, base: 220, slow: 360, hero: 900, breath: 4000 },
  spring: { tension: 280, friction: 18 },
  pressScale: 0.97,
  /** Cubic-bézier control points, consumed by Reanimated's Easing.bezier. */
  easing: {
    /** Default for most transitions — quick start, soft landing. */
    standard: [0.2, 0, 0, 1],
    /** Entrances — element decelerates into place. */
    decelerate: [0.05, 0.7, 0.1, 1],
    /** Exits — element accelerates away. */
    accelerate: [0.3, 0, 0.8, 0.15],
  },
} as const;

/* Convert a hex to an rgba string at the given alpha (for soft tint fills). */
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/* ──────────────────────────────── Fonts ──────────────────────────────────*/
export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
