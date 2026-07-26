/**
 * HabitHeatmap — the GitHub-style consistency grid, in two sizes:
 *   • mini (list rows): bare grid, ~12 weeks
 *   • full (detail "History" card): month labels on top, M/W/F row labels left
 *
 * Pure Views — hundreds of tiny rounded squares render cheaply and stay
 * theme-correct via useColors (inside a light-mode cyan Card they invert
 * automatically).
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
  /** Month labels per week column (from monthLabels()); enables the top row. */
  months?: string[];
  /** Show M/W/F weekday labels on the left. */
  dayLabels?: boolean;
}

const DAY_ROWS: Record<number, string> = { 0: "M", 2: "W", 4: "F" };

export function HabitHeatmap({
  weeks,
  color,
  cellSize = 7,
  gap = 2.5,
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

  const step = cellSize + gap;

  return (
    <View style={styles.wrap}>
      {months && (
        <View style={[styles.monthRow, dayLabels && { marginLeft: LABEL_W }]}>
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
          <View style={[styles.dayCol, { width: LABEL_W }]}>
            {Array.from({ length: 7 }, (_, r) => (
              <View key={r} style={{ height: step, justifyContent: "center" }}>
                {DAY_ROWS[r] ? (
                  <AppText variant="footnote" color="tertiary">
                    {DAY_ROWS[r]}
                  </AppText>
                ) : null}
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
                  width: cellSize,
                  height: cellSize,
                  marginBottom: gap,
                  borderRadius: cellSize * 0.28,
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

const LABEL_W = 18;

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
