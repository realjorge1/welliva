/**
 * MultiSelectGrid / OptionRail — measured grids of SelectionCards.
 *
 * Cells are MEASURED, not wrapped. The previous onboarding learned this the
 * hard way: a wrapping grid of seven options in two columns leaves the last
 * option hanging against the left margin, and the screen reads lopsided. Here
 * a short last row stretches its cells to share the full width, so every row is
 * flush with both gutters.
 *
 * `OptionRail` is the same contract for a single-column list.
 */
import { Spacing } from "@/constants/theme";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Appear } from "./Appear";
import { SelectionCard } from "./SelectionCard";
import type { GlyphName } from "./OnboardingGlyph";
import { Dur, Stagger, Travel } from "./onboardingMotion";
import { measureGrid } from "./gridLayout";

export interface GridOption<T extends string> {
  value: T;
  label: string;
  subtitle?: string;
  glyph?: GlyphName;
}

const GAP = Spacing.md;

export interface MultiSelectGridProps<T extends string> {
  options: GridOption<T>[];
  /** Currently-selected values. Order matters for `primaryTag`. */
  selected: readonly T[];
  onToggle: (value: T) => void;
  /** Total content width available to the grid. */
  width: number;
  columns?: number;
  /** Delay before the first card reveals. */
  delay?: number;
  /** Label shown on the FIRST-selected card — makes `goals[0]` visible. */
  primaryTag?: string;
  /** "radio" collapses the grid to single-select semantics for readers. */
  role?: "radio" | "checkbox";
  /** Dim the unselected cards once something is selected (single-select only). */
  recedeUnselected?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function MultiSelectGrid<T extends string>({
  options,
  selected,
  onToggle,
  width,
  columns = 2,
  delay = 0,
  primaryTag,
  role = "checkbox",
  recedeUnselected = false,
  style,
}: MultiSelectGridProps<T>) {
  // Measured up front: a short last row stretches to stay flush with both
  // gutters (see gridLayout.ts).
  const cells = measureGrid(options.length, columns, width, GAP);
  const hasSelection = selected.length > 0;

  return (
    <View style={[styles.grid, style]}>
      {options.map((option, i) => {
        const isSelected = selected.includes(option.value);
        return (
          <Appear
            key={option.value}
            delay={delay + i * Stagger.item}
            duration={Dur.content}
            distance={Travel.card}
            style={{ width: cells[i] }}
          >
            <SelectionCard
              selected={isSelected}
              onPress={() => onToggle(option.value)}
              title={option.label}
              subtitle={option.subtitle}
              glyph={option.glyph}
              layout="tile"
              role={role}
              recede={recedeUnselected && hasSelection && !isSelected}
              tag={primaryTag && selected[0] === option.value ? primaryTag : undefined}
            />
          </Appear>
        );
      })}
    </View>
  );
}

export interface OptionRailProps<T extends string> {
  options: GridOption<T>[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  delay?: number;
  role?: "radio" | "checkbox";
  recedeUnselected?: boolean;
  showCheck?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function OptionRail<T extends string>({
  options,
  selected,
  onToggle,
  delay = 0,
  role = "checkbox",
  recedeUnselected = false,
  showCheck = true,
  style,
}: OptionRailProps<T>) {
  const hasSelection = selected.length > 0;
  return (
    <View style={[styles.rail, style]}>
      {options.map((option, i) => {
        const isSelected = selected.includes(option.value);
        return (
          <Appear
            key={option.value}
            delay={delay + i * Stagger.item}
            duration={Dur.content}
            distance={Travel.card}
          >
            <SelectionCard
              selected={isSelected}
              onPress={() => onToggle(option.value)}
              title={option.label}
              subtitle={option.subtitle}
              glyph={option.glyph}
              layout="row"
              role={role}
              showCheck={showCheck}
              recede={recedeUnselected && hasSelection && !isSelected}
            />
          </Appear>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  rail: { gap: Spacing.md },
});
