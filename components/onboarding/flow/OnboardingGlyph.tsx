/**
 * OnboardingGlyph — the flow's own line-art vocabulary.
 *
 * The app runs on Ionicons, which is right for a dense product surface and
 * wrong here: a grid of six filled pictograms is the single fastest way to make
 * a screen read as a form. These are hand-authored single-weight strokes on a
 * 24pt box, drawn to sit QUIETLY next to their label — organic where the idea
 * is organic (a stem bending under its own leaf for "lose weight", a sprout for
 * "new to it") and geometric only where the object itself is (a dumbbell, a
 * bench).
 *
 * They never carry meaning alone: every glyph in the flow is paired with a
 * visible label, so all of them are hidden from assistive tech.
 */
import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

export type GlyphName =
  // Goals
  | "descend"
  | "strength"
  | "motion"
  | "spark"
  | "heart"
  | "aim"
  // Body
  | "male"
  | "female"
  // Training experience
  | "sprout"
  | "steady"
  | "crest"
  // Equipment
  | "mat"
  | "band"
  | "kettlebell"
  | "bar"
  | "bench"
  // Food
  | "globe"
  | "leaf"
  | "plate"
  | "coast"
  // Menu
  | "sunrise"
  | "moon"
  | "calendar"
  | "search";

/**
 * Each glyph is a list of paths plus optional circles, all in a 0 0 24 24 box.
 * Kept as data rather than JSX so every glyph is guaranteed the same stroke
 * weight, cap and join — the thing that makes a set look drawn by one hand.
 */
const GLYPHS: Record<GlyphName, { d?: string[]; c?: [number, number, number][] }> = {
  // ── Goals ──
  descend: {
    d: [
      "M3.6 6.4 C 9 6.6, 10.6 14.4, 20.4 15.4",
      "M20.4 15.4 C 17.3 16.3, 15.5 18.9, 16.3 21.5 C 19.3 20.8, 21.1 18.2, 20.4 15.4 Z",
    ],
  },
  strength: {
    d: ["M8.4 12 H15.6", "M6.6 8.9 V15.1", "M17.4 8.9 V15.1", "M3.9 10.5 V13.5", "M20.1 10.5 V13.5"],
  },
  motion: {
    d: ["M3.4 15.6 C 7.2 9.2, 10.8 9.2, 13.4 12.8 C 15.6 15.8, 18.2 15.6, 20.6 11.8"],
    c: [[6.2, 6.6, 1.5]],
  },
  spark: {
    d: [
      "M12 3.2 V5.5",
      "M12 18.5 V20.8",
      "M3.2 12 H5.5",
      "M18.5 12 H20.8",
      "M5.9 5.9 L7.5 7.5",
      "M16.5 16.5 L18.1 18.1",
      "M18.1 5.9 L16.5 7.5",
      "M7.5 16.5 L5.9 18.1",
    ],
    c: [[12, 12, 3.4]],
  },
  heart: {
    d: [
      "M12 19.6 C 4.8 15, 2.6 12.1, 3.1 9.1 C 3.6 6.3, 7.1 5, 9.4 6.6 C 10.6 7.4, 11.6 8.6, 12 9.4 C 12.4 8.6, 13.4 7.4, 14.6 6.6 C 16.9 5, 20.4 6.3, 20.9 9.1 C 21.4 12.1, 19.2 15, 12 19.6 Z",
    ],
  },
  aim: {
    c: [
      [12, 12, 8.2],
      [12, 12, 4.2],
      [12, 12, 1.3],
    ],
  },

  // ── Body ──
  male: {
    d: ["M14.6 9.4 L20.2 3.8", "M15.4 3.8 H20.2 V8.6"],
    c: [[9.6, 14.4, 4.5]],
  },
  female: {
    d: ["M12 13.9 V20.6", "M9 17.6 H15"],
    c: [[12, 9.4, 4.5]],
  },

  // ── Training experience ──
  sprout: {
    d: [
      "M12 20.4 V11.6",
      "M12 11.8 C 8.2 11.8, 6 9.4, 6 6.4 C 9.6 6.4, 12 8.7, 12 11.8 Z",
      "M12 12.6 C 15.8 12.6, 18 10.4, 18 7.8 C 14.6 7.8, 12 9.8, 12 12.6 Z",
    ],
  },
  steady: {
    d: ["M5.6 15.2 V18.6", "M12 11.4 V18.6", "M18.4 7.6 V18.6"],
  },
  crest: {
    d: ["M3 17.6 L8.8 8.8 L12.8 14 L16.4 9.4 L21 17.6"],
  },

  // ── Equipment ──
  mat: {
    d: ["M3.6 7.6 H16.8 A 4.4 4.4 0 0 1 16.8 16.4 H3.6 Z", "M16.8 7.6 A 4.4 4.4 0 0 0 16.8 16.4"],
  },
  band: {
    d: ["M3.4 12 C 6 7.4, 9.2 16.6, 12 12 C 14.8 7.4, 18 16.6, 20.6 12"],
  },
  kettlebell: {
    d: [
      "M9 8.8 A 3.2 3.2 0 0 1 15 8.8",
      "M12 8.8 C 16.4 8.8, 19 12.3, 19 15.4 C 19 17.5, 17.5 19, 15.4 19 H8.6 C 6.5 19, 5 17.5, 5 15.4 C 5 12.3, 7.6 8.8, 12 8.8 Z",
    ],
  },
  bar: {
    d: ["M3.4 7.6 H20.6", "M6.6 7.6 V16.4", "M17.4 7.6 V16.4", "M10.4 7.6 V11.4", "M13.6 7.6 V11.4"],
  },
  bench: {
    d: ["M3.6 9.6 H20.4 V12.2 H3.6 Z", "M6.4 12.2 V17.4", "M17.6 12.2 V17.4"],
  },

  // ── Food ──
  globe: {
    d: ["M3.7 12 H20.3", "M12 3.6 C 15.4 6.4, 15.4 17.6, 12 20.4 C 8.6 17.6, 8.6 6.4, 12 3.6"],
    c: [[12, 12, 8.3]],
  },
  leaf: {
    d: [
      "M19.6 4.4 C 19.6 13, 13.9 18.8, 5.3 19.6 C 4.7 11, 10.6 5, 19.6 4.4 Z",
      "M5.3 19.6 C 8.8 16, 12.8 12.4, 16.8 9.4",
    ],
  },
  plate: {
    c: [
      [12, 12, 8.2],
      [12, 12, 4.6],
    ],
  },
  coast: {
    d: ["M3.2 15.4 C 6.2 12.2, 9.2 18.2, 12.2 15.4 C 15.2 12.2, 18.2 18.2, 21 15.4"],
    c: [[16.6, 7.2, 2.7]],
  },

  // ── Menu ──
  /** Breakfast: a sun half over the horizon. (Lunch borrows `spark`, the full sun.) */
  sunrise: {
    d: [
      "M3.2 17.6 H20.8",
      "M7.2 17.6 A 4.8 4.8 0 0 1 16.8 17.6",
      "M12 8.2 V10.2",
      "M6.6 12.2 L5.3 10.9",
      "M17.4 12.2 L18.7 10.9",
    ],
  },
  /** Dinner. */
  moon: {
    d: ["M19.4 14.8 A 7.9 7.9 0 1 1 9.2 4.6 A 6.3 6.3 0 0 0 19.4 14.8 Z"],
  },
  calendar: {
    d: [
      "M6.4 5.6 H17.6 A 2 2 0 0 1 19.6 7.6 V17.8 A 2 2 0 0 1 17.6 19.8 H6.4 A 2 2 0 0 1 4.4 17.8 V7.6 A 2 2 0 0 1 6.4 5.6 Z",
      "M4.4 10 H19.6",
      "M8.4 3.6 V7.2",
      "M15.6 3.6 V7.2",
    ],
  },
  search: {
    d: ["M14.9 14.9 L19.8 19.8"],
    c: [[10.6, 10.6, 5.8]],
  },
};

export interface OnboardingGlyphProps {
  name: GlyphName;
  size?: number;
  tone: string;
  /** Stroke weight at a 24pt box; scales with `size`. */
  weight?: number;
  style?: StyleProp<ViewStyle>;
}

export function OnboardingGlyph({
  name,
  size = 26,
  tone,
  weight = 1.5,
  style,
}: OnboardingGlyphProps) {
  const g = GLYPHS[name];
  return (
    <View
      style={style}
      // Always labelled by adjacent text; announcing it would only duplicate.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {g.d?.map((d) => (
          <Path
            key={d}
            d={d}
            stroke={tone}
            strokeWidth={weight}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
        {g.c?.map(([cx, cy, r]) => (
          <Circle
            key={`${cx}-${cy}-${r}`}
            cx={cx}
            cy={cy}
            r={r}
            stroke={tone}
            strokeWidth={weight}
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}
