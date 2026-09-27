/**
 * The habit library's invariants, which are all invisible at author time.
 *
 * A mistyped Ionicons name renders a BLANK BOX, not an error; a group that
 * isn't a whole number of rows leaves a ragged grid edge; a duplicate glyph
 * reads as two different icons; and a soft hue chosen by eye can end up under
 * white text it can't carry. Each of those is a silent defect you only find on
 * a device, and only if you happen to open that category. They're cheap to
 * assert here instead.
 */
import IoniconsGlyphs from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json";
import { describe, expect, it } from "vitest";
import {
  HABIT_COLOR_GROUPS,
  HABIT_COLORS,
  HABIT_ICON_GROUPS,
  HABIT_ICONS,
  habitIconGroupIndex,
} from "../habitTheme";

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

const contrastWithWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

describe("habit icon library", () => {
  it("only names glyphs Ionicons actually ships", () => {
    const shipped = new Set(Object.keys(IoniconsGlyphs));
    const missing = HABIT_ICONS.filter((name) => !shipped.has(name));
    expect(missing).toEqual([]);
  });

  it("keeps every category a whole number of six-column rows", () => {
    const ragged = HABIT_ICON_GROUPS.filter((g) => g.icons.length % 6 !== 0).map(
      (g) => `${g.label} (${g.icons.length})`,
    );
    expect(ragged).toEqual([]);
  });

  it("lists each glyph under exactly one category", () => {
    const seen = new Map<string, number>();
    for (const name of HABIT_ICONS) seen.set(name, (seen.get(name) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([name]) => name)).toEqual([]);
  });

  it("opens on the category holding the habit's own icon", () => {
    HABIT_ICON_GROUPS.forEach((group, i) => {
      for (const name of group.icons) expect(habitIconGroupIndex(name)).toBe(i);
    });
    // A glyph from outside the library (a legacy or linked habit) still lands
    // somewhere rather than crashing the picker.
    expect(habitIconGroupIndex("not-a-real-glyph")).toBe(0);
  });
});

describe("habit palette", () => {
  it("keeps every family a whole number of five-column rows", () => {
    const ragged = HABIT_COLOR_GROUPS.filter((g) => g.colors.length % 5 !== 0).map(
      (g) => `${g.label} (${g.colors.length})`,
    );
    expect(ragged).toEqual([]);
  });

  it("has no repeated hue", () => {
    expect(new Set(HABIT_COLORS).size).toBe(HABIT_COLORS.length);
  });

  it("holds white text at least as well as the brightest existing hue", () => {
    // Every habit colour is also a FILL under white text (the goal and weekday
    // cells). Lime is the weakest the app has always shipped, so it sets the
    // floor — nothing added may read worse than a hue already in people's
    // lists. The floor is derived, not typed, so retiring lime tightens it.
    const floor = contrastWithWhite("#A8E05F");
    const failures = HABIT_COLORS.filter((c) => contrastWithWhite(c) < floor);
    expect(failures).toEqual([]);
  });

  it("keeps the soft family genuinely muted, not pale", () => {
    // Pastels wash out under white text; these are desaturated mid-tones.
    const soft = HABIT_COLOR_GROUPS.find((g) => g.label === "Soft")!;
    for (const c of soft.colors) expect(contrastWithWhite(c)).toBeGreaterThanOrEqual(1.8);
  });
});
