/**
 * ChipGrid — a set of chips laid out as JUSTIFIED rows.
 *
 * ── WHAT WAS WRONG WITH WRAPPING ────────────────────────────────────────────
 * `flexWrap` puts as many chips on a line as happen to fit and leaves whatever
 * is left hanging on the last one. On a form like the profile editor — where
 * one group holds two-character options ("3", "4") and the next holds "Moderate
 * — active job or 3–4 sessions" — that produces a column of ragged, left-piled
 * blocks with a different empty gutter on every row. Every group looks
 * one-sided, and no two groups agree with each other.
 *
 * ── WHAT THIS DOES INSTEAD ──────────────────────────────────────────────────
 * Two passes, the same way a typesetter sets a paragraph:
 *
 *   1. BREAK. Chips are packed into rows greedily against the measured width,
 *      using an estimate of how wide each label wants to be. So a row of short
 *      options takes four, a row of medium ones takes three, and one long
 *      option takes the row to itself — the column count follows the WORDS,
 *      which is the only thing that should decide it.
 *
 *   2. JUSTIFY. Each row's leftover space is then shared out in proportion to
 *      the labels in it, so every row ends flush with both margins. A long chip
 *      still looks longer than a short one; the row just has no ragged edge.
 *
 * A BALANCE pass runs between the two. Greedy breaking fills every row to the
 * brim and dumps the remainder on the last one — six short options come out as
 * four-then-two, and a widowed single chip under a full row is worse still. So
 * once the greedy pass has established how many rows are needed, the chips are
 * re-dealt as evenly as those rows allow (3+3, 4+3), and the even deal is kept
 * only if every one of its rows still fits. It is the same instinct as balanced
 * line-breaking in a headline: the row count is the constraint, evenness is the
 * goal.
 *
 * The arithmetic for both passes lives in ./chipGridLayout, with no React in
 * it, so the row-breaking can be checked exhaustively in a test runner instead
 * of by squinting at a phone.
 *
 * The width is MEASURED, never assumed — these grids sit inside cards, inside a
 * sheet, at whatever the user's font scale is, and a constant would be wrong in
 * all three directions at once. Nothing renders on the first pass; that is one
 * frame, and it is the price of never guessing at a size.
 */
import { Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Chip } from "./Chip";
import { estimateChipWidth, justifyRow, packRows } from "./chipGridLayout";

export interface ChipGridOption<T extends string = string> {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface ChipGridProps<T extends string = string> {
  options: readonly ChipGridOption<T>[];
  selected: (value: T) => boolean;
  onToggle: (value: T) => void;
  /** Most chips one row may hold. Four is the readable ceiling on a phone. */
  maxPerRow?: number;
  gap?: number;
  size?: "sm" | "md";
  /** Selected fill, passed through to each chip. */
  tone?: string;
  style?: StyleProp<ViewStyle>;
}

export function ChipGrid<T extends string = string>({
  options,
  selected,
  onToggle,
  maxPerRow = 4,
  gap = Spacing.sm,
  size = "md",
  tone,
  style,
}: ChipGridProps<T>) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    // Sub-pixel jitter from a re-layout must not re-break every row.
    setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
  };

  const wants = options.map((o) =>
    estimateChipWidth({ label: o.label, hasIcon: !!o.icon }, size),
  );
  const rows = width > 0 ? packRows(wants, width, gap, maxPerRow) : [];

  return (
    <View onLayout={onLayout} style={[{ gap }, style]}>
      {rows.map((row, r) => {
        // Justify: share the row's real width in proportion to what its chips
        // asked for, so the row ends flush at both margins.
        const cells = justifyRow(wants, row, width, gap);
        return (
          <View key={r} style={[styles.row, { gap }]}>
            {row.map((i, k) => (
              <Chip
                key={options[i].value}
                label={options[i].label}
                icon={options[i].icon}
                active={selected(options[i].value)}
                onPress={() => onToggle(options[i].value)}
                size={size}
                tone={tone}
                style={{ width: cells[k], justifyContent: "center" }}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "stretch" },
});
