/**
 * HabitHeatmap — the GitHub-style consistency grid, in two sizes:
 *   • mini (list rows): bare grid, ~12 weeks, fixed tiny cells
 *   • full (detail history): month labels on top, M/W/F row labels left
 *
 * SIZING IS A CONTRACT, NOT A GUESS. The full grid used to take a hardcoded
 * `cellSize`, which meant its total width was `weeks × (cell + gap)` — a number
 * that had nothing to do with the screen it was drawn on. Twenty weeks at 12pt
 * needs 328pt; a 360pt phone offers about 280 inside a card, so the last month
 * of history simply hung off the right edge. Pass `fitWidth` instead and the
 * component solves for the cell size, so the grid ends exactly where its
 * container does on every device.
 *
 * Pure Views — hundreds of tiny rounded squares render cheaply and stay
 * theme-correct via useColors.
 */
import { alpha } from "@/constants/theme";
import React from "react";
import { StyleSheet, View } from "react-native";
import type { HeatWeek } from "../../models/habit";
import { AppText } from "../ui/Text";
import { useColors } from "../ui/useColors";

export interface HabitHeatmapProps {
  weeks: HeatWeek[];
  color: string;
  cellSize?: number;
  gap?: number;
  /**
   * Total width the grid must fit inside, in points. Overrides `cellSize`:
   * the cell is derived so the columns span exactly this width, labels
   * included. Measure it with `onLayout` on the parent.
   */
  fitWidth?: number;
  /** Month labels per week column (from monthLabels()); enables the top row. */
  months?: string[];
  /** Show M/W/F weekday labels on the left. */
  dayLabels?: boolean;
}

/**
 * Every weekday, Mon→Sun.
 *
 * This used to label only Monday, Wednesday and Friday — GitHub's convention,
 * borrowed without its reason. GitHub's grid is a year wide, so labelling every
 * row would crowd it; a habit's history is twenty weeks and the rows are the
 * thing you read it BY ("I always miss Thursdays"). Four unlabelled rows out of
 * seven means counting down from the nearest letter to answer that.
 */
const DAY_ROWS = ["M", "T", "W", "T", "F", "S", "S"];

const LABEL_W = 16;
/** Below this a cell stops reading as a square and starts reading as noise. */
const MIN_CELL = 5;

export function HabitHeatmap({
  weeks,
  color,
  cellSize = 7,
  gap = 2.5,
  fitWidth,
  months,
  dayLabels = false,
}: HabitHeatmapProps) {
  const { colors } = useColors();

  const doneColor = color;
  const missedColor = alpha(colors.text, 0.1);
  const restColor = alpha(colors.text, 0.045);

  const cellFor = (done: boolean, scheduled: boolean, outside: boolean) => {
    if (outside) return restColor;
    if (done) return doneColor;
    return scheduled ? missedColor : restColor;
  };

  // Solve for the cell. Each column occupies `cell + gap`, so the row's true
  // width is `labels + weeks × step − gap` (the last column's trailing gap
  // falls off the end) — inverting that is what makes the grid land flush.
  const labelW = dayLabels ? LABEL_W : 0;
  const size =
    fitWidth && weeks.length > 0
      ? Math.max(MIN_CELL, (fitWidth - labelW + gap) / weeks.length - gap)
      : cellSize;
  const step = size + gap;

  return (
    <View style={styles.wrap}>
      {months && (
        <View style={[styles.monthRow, dayLabels && { marginLeft: labelW }]}>
          {months.map((m, i) => (
            <View key={i} style={{ width: step }}>
              {m ? (
                <AppText variant="footnote" color="tertiary" numberOfLines={1} style={styles.monthText}>
                  {m}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      )}
      <View style={styles.gridRow}>
        {dayLabels && (
          <View style={[styles.dayCol, { width: labelW }]}>
            {DAY_ROWS.map((letter, r) => (
              // `caption` (15pt line box), not `footnote` (17pt) — a row is only
              // `step` tall, and now that EVERY row carries a letter any
              // overflow would show up seven times instead of three.
              <View key={r} style={{ height: step, justifyContent: "center" }}>
                <AppText variant="caption" color="tertiary">
                  {letter}
                </AppText>
              </View>
            ))}
          </View>
        )}
        {weeks.map((week, w) => (
          <View key={w} style={{ width: step }}>
            {week.map((cell) => (
              <View
                key={cell.date}
                style={{
                  width: size,
                  height: size,
                  marginBottom: gap,
                  borderRadius: size * 0.28,
                  backgroundColor: cellFor(cell.done, cell.scheduled, cell.outside),
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  monthRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  monthText: {
    // Let a month name spill over the next (empty) columns instead of clipping.
    width: 30,
  },
  gridRow: {
    flexDirection: "row",
  },
  dayCol: {
    justifyContent: "flex-start",
  },
});
